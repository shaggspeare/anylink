import Foundation
import Observation
import Models
import QueryLanguage
import Networking
import Persistence

public enum SyncState: Equatable, Sendable { case idle, syncing, failed(AppError), offline }

/// Single source of truth for library data. Intents update local state synchronously, then sync in a Task;
/// on failure they roll back and show a toast.
@MainActor @Observable
public final class LibraryStore {
    public internal(set) var links: [LinkItem.ID: LinkItem] = [:] { didSet { cachedIndex = nil; scheduleSave() } }
    public private(set) var order: [LinkItem.ID] = []
    public private(set) var collections: [LinkCollection] = [] { didSet { scheduleSave() } }
    /// Calls waiting for the network, oldest first. Persisted with the cache.
    public private(set) var outbox: [OutboxItem] = []
    /// Set by the app: a 401 signs the user out.
    @ObservationIgnored public var onUnauthorized: (@MainActor () -> Void)?
    /// Set by the app for a guest: true once they've used their free saves. Every save checks it.
    @ObservationIgnored public var saveLimitReached: (@MainActor () -> Bool)?
    /// What a save does instead when the limit is reached (the app asks them to sign up).
    @ObservationIgnored public var onSaveLimit: (@MainActor () -> Void)?
    /// First retry delay for a failing outbox call; doubles each attempt, 5 attempts.
    @ObservationIgnored public var retryBase: Duration = .milliseconds(500)
    @ObservationIgnored let cache: LocalCache?
    @ObservationIgnored private var saveTask: Task<Void, Never>?
    public private(set) var syncState: SyncState = .idle
    public private(set) var lastSynced: Date?
    public var clipboardHasURL = false

    public let toasts: ToastCenter
    public let undo: UndoCenter
    public let signals: SignalLogger
    @ObservationIgnored public let api: any AnyLinkAPI
    /// `/api/crawl` client. Defaults to `api.crawl`; the app swaps in `LiveCrawler` when a backend is configured.
    @ObservationIgnored public let crawl: @Sendable (URL) async -> AsyncThrowingStream<CrawlEvent, Error>
    @ObservationIgnored private var inflight: [Task<Void, Never>] = []
    @ObservationIgnored private var tail: Task<Void, Never>?
    @ObservationIgnored private var cachedIndex: LibraryIndex?
    /// When links were trashed on this device (the API has no `deletedAt`).
    public private(set) var trashedAt: [LinkItem.ID: Date] = [:]

    public init(api: any AnyLinkAPI, toasts: ToastCenter = ToastCenter(), snapshot: LibrarySnapshot? = nil,
                crawl: (@Sendable (URL) async -> AsyncThrowingStream<CrawlEvent, Error>)? = nil,
                cache: LocalCache? = nil) {
        self.api = api
        self.cache = cache
        self.crawl = crawl ?? { await api.crawl($0) }
        self.toasts = toasts
        self.undo = UndoCenter(toasts: toasts)
        self.signals = SignalLogger(api: api)
        // Cold launch: the cached library shows before the network answers.
        if let s = snapshot ?? cache?.loadSnapshot() { apply(s) }
        outbox = cache?.loadOutbox().flatMap { try? JSONDecoder().decode([OutboxItem].self, from: $0) } ?? []
    }

    // MARK: - Derived

    public var index: LibraryIndex {
        if let cachedIndex { return cachedIndex }
        let i = LibraryIndex(links: Array(links.values))
        cachedIndex = i
        return i
    }

    public var inboxID: LinkCollection.ID { collections.first { $0.isInbox == true }?.id ?? "unsorted" }

    private var ordered: [LinkItem] { order.compactMap { links[$0] } }
    public var live: [LinkItem] { ordered.filter { $0.deleted != true && $0.archived != true } }
    public var trash: [LinkItem] { ordered.filter { $0.deleted == true } }

    public func link(_ id: LinkItem.ID) -> LinkItem? { links[id] }
    public func collection(_ id: LinkCollection.ID) -> LinkCollection? { collections.first { $0.id == id } }
    public func name(of id: LinkCollection.ID) -> String { collection(id)?.name ?? "Unsorted" }

    public func links(matching query: Query) -> [LinkItem] {
        let idx = index
        return LibrarySort.newest.apply(ordered.filter { query.matches($0, in: idx) })
    }

    public func links(in id: LinkCollection.ID) -> [LinkItem] {
        if let c = collection(id), c.isSmart == true { return links(matching: Query(c.smartQuery ?? "")) }
        return LibrarySort.newest.apply(live.filter { $0.collectionId == id })
    }

    public func count(in id: LinkCollection.ID) -> Int { links(in: id).count }

    /// The collection whose links share the most tags with these, ties broken by domain overlap. Never the inbox or a filter.
    public func suggestedCollection(tags: [String], domain: String, excluding linkID: LinkItem.ID? = nil) -> LinkCollection? {
        let wanted = Set(tags.map { $0.lowercased() })
        var best: (score: (Int, Int), c: LinkCollection)?
        for c in collections where c.isInbox != true && c.isSmart != true {
            var shared = 0, sameSite = 0
            for l in live where l.collectionId == c.id && l.id != linkID {
                shared += l.tags.reduce(0) { $0 + (wanted.contains($1.lowercased()) ? 1 : 0) }
                if l.domain == domain { sameSite += 1 }
            }
            let score = (shared, sameSite)
            if score > (0, 0), score > (best?.score ?? (0, 0)) { best = (score, c) }
        }
        return best?.c
    }

    public func suggestedCollection(for link: LinkItem) -> LinkCollection? {
        suggestedCollection(tags: link.tags, domain: link.domain, excluding: link.id)
    }

    /// All tags in the live library, most used first.
    public var tagsByUse: [String] {
        var counts: [String: Int] = [:]
        for l in live { for t in l.tags { counts[t, default: 0] += 1 } }
        return counts.keys.sorted { (counts[$0]!, $1) > (counts[$1]!, $0) }
    }

    // MARK: - Sync plumbing

    public static func message(for error: Error) -> String {
        if (error as? AppError) == .pinLimit { return "You can pin up to 2 links. Unpin one first." }
        return (error as? AppError) == .offline
            ? "You're offline. Changes are saved and will sync when you're back."
            : "That didn't go through. Try again."
    }

    /// Awaits every in-flight API call. Tests and pull-to-refresh use it.
    public func settle() async {
        while !inflight.isEmpty {
            let tasks = inflight
            inflight.removeAll()
            for t in tasks { await t.value }
        }
    }

    /// API calls run strictly in intent order, so an Undo can never overtake the change it reverts.
    private func enqueue(_ work: @escaping @MainActor () async -> Void) {
        let previous = tail
        let task = Task { @MainActor in
            await previous?.value
            await work()
        }
        tail = task
        inflight.append(task)
    }

    /// Runs `op` in order. Offline: the optimistic change stays and `op` waits in the outbox. A 401 signs out.
    /// Anything else rolls back with a toast. While the outbox has items, new ops queue behind them.
    private func sync(_ op: PendingOp, rollback: @escaping @MainActor () -> Void) {
        let api = api
        enqueue { [weak self] in
            guard let self else { return }
            if !self.outbox.isEmpty {
                self.queue(op)
                await self.drain()
                return
            }
            do {
                try await op.run(api)
            } catch AppError.offline {
                self.queue(op)
            } catch AppError.unauthorized {
                rollback()
                self.onUnauthorized?()
            } catch {
                rollback()
                self.toasts.show(Self.message(for: error))
            }
        }
    }

    private func queue(_ op: PendingOp) {
        outbox.append(OutboxItem(op: op, attempts: 0))
        persistOutbox()
        if syncState != .offline {
            syncState = .offline
            toasts.show(Self.message(for: AppError.offline))
        }
    }

    private func persistOutbox() {
        if let data = try? JSONEncoder().encode(outbox) { cache?.saveOutbox(data) }
    }

    /// Sends queued calls in order. The app calls it when the network comes back and when it becomes active.
    public func drainOutbox() {
        guard !outbox.isEmpty else { return }
        enqueue { [weak self] in await self?.drain() }
    }

    private func drain() async {
        while let item = outbox.first {
            do {
                try await item.op.run(api)
                outbox.removeFirst()
                persistOutbox()
            } catch AppError.offline {
                syncState = .offline
                return
            } catch AppError.unauthorized {
                onUnauthorized?()
                return
            } catch AppError.pinLimit {
                if case .pin(let id, true) = item.op,
                   !outbox.dropFirst().contains(where: { if case .pin(let other, _) = $0.op { return other == id }; return false }) {
                    links[id]?.pinned = false
                }
                outbox.removeFirst()
                persistOutbox()
                toasts.show(Self.message(for: AppError.pinLimit))
            } catch {
                outbox[0].attempts += 1
                if outbox[0].attempts >= 5 {
                    outbox.removeFirst()
                    toasts.show(Self.message(for: error))
                }
                persistOutbox()
                try? await Task.sleep(for: retryBase * (1 << min(item.attempts, 4)))
            }
        }
        if syncState == .offline { syncState = .idle }
    }

    private func scheduleSave() {
        guard cache != nil else { return }
        saveTask?.cancel()
        saveTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(300))
            guard !Task.isCancelled, let self else { return }
            self.cache?.save(self.snapshot)
        }
    }

    public var snapshot: LibrarySnapshot {
        LibrarySnapshot(links: ordered.filter { $0.deleted != true }, trashed: trash, collections: collections)
    }

    @discardableResult
    private func change(_ ids: [LinkItem.ID], _ edit: (inout LinkItem) -> Void) -> [LinkItem] {
        let before = ids.compactMap { links[$0] }
        for var l in before { edit(&l); links[l.id] = l }
        return before
    }

    private func put(_ before: [LinkItem]) { for l in before { links[l.id] = l } }

    // MARK: - Loading

    /// Signing out: nothing of this account stays on the device for the next one, queued calls included.
    public func reset() {
        apply(LibrarySnapshot(links: [], trashed: [], collections: []))
        outbox = []
        persistOutbox()
        lastSynced = nil
    }

    public func apply(_ snapshot: LibrarySnapshot) {
        var all: [LinkItem.ID: LinkItem] = [:]
        for l in snapshot.links { all[l.id] = l }
        for var l in snapshot.trashed { l.deleted = true; all[l.id] = l }
        links = all
        order = all.values.sorted { $0.createdAt > $1.createdAt }.map(\.id)
        collections = snapshot.collections
    }

    /// Full fetch, then merge: the server wins, except while local changes are still queued — then local stays.
    public func refresh() async {
        if !outbox.isEmpty {
            drainOutbox()
            await settle()
            if !outbox.isEmpty { syncState = .offline; return }
        }
        syncState = .syncing
        do {
            let snap = try await api.library(since: nil)
            guard outbox.isEmpty else { syncState = .offline; return }
            apply(snap)
            syncState = .idle
            lastSynced = .now
        } catch AppError.offline {
            syncState = .offline
        } catch AppError.unauthorized {
            syncState = .failed(.unauthorized)
            onUnauthorized?()
        } catch {
            syncState = .failed(error as? AppError ?? .unknown)
        }
    }

    #if DEBUG
    /// Previews only: show loading/offline states without a network round trip.
    public func previewSyncState(_ state: SyncState) { syncState = state }
    #endif

    // MARK: - Link intents

    /// Shows the link at once, then replaces it with the server's copy.
    @discardableResult
    public func save(_ draft: LinkDraft, stillReading: Bool = false) async -> LinkItem? {
        let cr = draft.crawl
        let host = URL(string: draft.url)?.host() ?? draft.url
        let temp = LinkItem(
            id: "local-\(UUID().uuidString)", url: draft.url, domain: cr?.domain ?? host,
            title: draft.title ?? cr?.title ?? host, excerpt: draft.excerpt ?? cr?.excerpt ?? "",
            articleText: cr?.articleText, heroImage: cr?.heroImage,
            tint: cr?.tint ?? "#9AA3AD", stripe: cr?.stripe ?? "#FFFFFF",
            initial: cr?.initial ?? String(host.prefix(1)).uppercased(),
            contentType: cr?.contentType ?? .article, readingTimeMinutes: cr?.readingTimeMinutes,
            collectionId: draft.collectionId ?? inboxID, tags: draft.tags, size: draft.size,
            status: cr == nil ? .crawling : .ready, createdAt: Date().formatted(.iso8601),
            source: "ios", note: draft.note, product: cr?.product
        )
        return await insert(temp, suffix: stillReading ? " — still reading the page" : "") { try await self.api.createLink(draft) }
    }

    /// Shows `temp` at once, swaps in the server's copy, or takes it back out and says why.
    private func insert(_ temp: LinkItem, suffix: String = "", create: () async throws -> LinkItem) async -> LinkItem? {
        if saveLimitReached?() == true {
            onSaveLimit?()
            return nil
        }
        links[temp.id] = temp
        order.insert(temp.id, at: 0)
        do {
            let saved = try await create()
            links[temp.id] = nil
            links[saved.id] = saved
            if let i = order.firstIndex(of: temp.id) { order[i] = saved.id }
            undo.register("Saved to \(name(of: saved.collectionId))" + suffix) { [weak self] in self?.trash([saved.id], announce: false) }
            return saved
        } catch {
            links[temp.id] = nil
            order.removeAll { $0 == temp.id }
            toasts.show(Self.message(for: error))
            return nil
        }
    }

    // MARK: - Notes and images

    @discardableResult
    public func saveNote(_ text: String, collectionId: LinkCollection.ID? = nil) async -> LinkItem? {
        let text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return nil }
        let temp = LinkItem(
            id: "local-\(UUID().uuidString)", url: "", domain: "", title: noteTitle(text), excerpt: text,
            tint: "#D6F24B", stripe: "#17181B", initial: "✎", contentType: .note,
            collectionId: collectionId ?? inboxID, tags: [], size: .M, status: .ready,
            createdAt: Date().formatted(.iso8601), source: "ios"
        )
        return await insert(temp) { try await self.api.createNote(text, collectionId: collectionId) }
    }

    /// Keeps a JPEG on the device first, so the card shows instantly and stays viewable offline,
    /// then uploads it. The local file follows the link to its server id.
    @discardableResult
    public func saveImage(_ raw: Data, caption: String? = nil, collectionId: LinkCollection.ID? = nil) async -> LinkItem? {
        guard let jpeg = LocalImages.prepare(raw) else {
            toasts.show("That image couldn't be read.")
            return nil
        }
        let tempID = "local-\(UUID().uuidString)"
        LocalImages.write(jpeg, id: tempID)
        let caption = caption?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
        let temp = LinkItem(
            id: tempID, url: "", domain: "", title: caption ?? "Image", excerpt: "",
            tint: "#17181B", stripe: "#FFFFFF", initial: "▣", contentType: .image,
            collectionId: collectionId ?? inboxID, tags: [], size: .M, status: .crawling,
            createdAt: Date().formatted(.iso8601), source: "ios"
        )
        let saved = await insert(temp) { try await self.api.createImage(jpeg, collectionId: collectionId, caption: caption) }
        if let saved { LocalImages.rename(tempID, to: saved.id) } else { LocalImages.remove(tempID) }
        return saved
    }

    /// A note's text is the note: the title follows its first line.
    public func setNoteText(_ id: LinkItem.ID, _ text: String) {
        let text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, links[id]?.excerpt != text else { return }
        let before = change([id]) { $0.excerpt = text; $0.title = noteTitle(text) }
        sync(.noteText(id, text)) { [weak self] in self?.put(before) }
    }

    public func move(_ ids: Set<LinkItem.ID>, to target: LinkCollection.ID) {
        let ids = Array(ids)
        let before = change(ids) { $0.collectionId = target }
        sync(.move(ids, to: target)) { [weak self] in self?.put(before) }
        signals.log("move", linkIds: ids, collectionId: target)
        undo.register("Moved to \(name(of: target))") { [weak self] in self?.revertCollections(before) }
    }

    private func revertCollections(_ before: [LinkItem]) {
        let now = before.compactMap { links[$0.id] }
        for l in before { links[l.id]?.collectionId = l.collectionId }
        for (cid, group) in Dictionary(grouping: before, by: \.collectionId) {
            let ids = group.map(\.id)
            sync(.move(ids, to: cid)) { [weak self] in self?.put(now) }
        }
    }

    public func setPinned(_ id: LinkItem.ID, _ pinned: Bool) {
        guard let link = links[id], link.deleted != true, link.archived != true else { return }
        guard !pinned || link.pinned == true || live.filter({ $0.pinned == true }).count < 2 else {
            toasts.show(Self.message(for: AppError.pinLimit))
            return
        }
        links[id]?.pinned = pinned
        sync(.pin(id, pinned)) { [weak self] in
            // Restore only this field; other edits may have happened while syncing.
            if self?.links[id]?.pinned == pinned { self?.links[id]?.pinned = link.pinned }
        }
        toasts.show(pinned ? "Pinned to top" : "Unpinned")
    }

    public func setFavorite(_ id: LinkItem.ID, _ on: Bool) {
        let before = change([id]) { $0.favorite = on }
        sync(.patch(id, note: nil, favorite: on)) { [weak self] in self?.put(before) }
        toasts.show(on ? "Added to favorites" : "Removed from favorites")
    }

    public func setNote(_ id: LinkItem.ID, _ text: String) {
        let before = change([id]) { $0.note = text.isEmpty ? nil : text }
        sync(.patch(id, note: text, favorite: nil)) { [weak self] in self?.put(before) }
        toasts.show("Note saved")
    }

    public func addHighlight(_ id: LinkItem.ID, quote: String) {
        let before = change([id]) { $0.highlights = ($0.highlights ?? []) + [Highlight(id: "local-\(UUID().uuidString)", quote: quote)] }
        sync(.highlight(id, quote: quote)) { [weak self] in self?.put(before) }
        toasts.show("Highlighted")
    }

    public func tag(_ ids: Set<LinkItem.ID>, _ tag: String) {
        let tag = tag.hasPrefix("#") ? String(tag.dropFirst()) : tag
        guard !tag.isEmpty else { return }
        let ids = Array(ids)
        let before = change(ids) { if !$0.tags.contains(tag) { $0.tags.append(tag) } }
        sync(.tag(ids, tag)) { [weak self] in self?.put(before) }
        toasts.show("Tagged \(ids.count.linkCount) #\(tag)")
    }

    public func archive(_ ids: Set<LinkItem.ID>) {
        let ids = Array(ids)
        let before = change(ids) { $0.archived = true; if $0.pinned == true { $0.pinned = false } }
        sync(.archive(ids)) { [weak self] in self?.put(before) }
        undo.register("Archived \(ids.count.linkCount)") { [weak self] in
            // BACKEND: no unarchive endpoint (10-decisions open question 4); Undo is local until one exists.
            self?.put(before.map { var link = $0; if link.pinned == true { link.pinned = false }; return link })
        }
    }

    public func trash(_ ids: Set<LinkItem.ID>, announce: Bool = true) {
        let ids = Array(ids)
        let before = change(ids) { $0.deleted = true; if $0.pinned == true { $0.pinned = false } }
        let now = Date()
        for id in ids { trashedAt[id] = now }
        sync(.trash(ids)) { [weak self] in self?.put(before) }
        guard announce else { return }
        undo.register(ids.count == 1 ? "Moved to Trash" : "\(ids.count) links moved to Trash") { [weak self] in
            self?.restore(Set(ids), announce: false)
        }
    }

    public func restore(_ ids: Set<LinkItem.ID>, announce: Bool = true) {
        let ids = Array(ids)
        let before = change(ids) { $0.deleted = false }
        sync(.restore(ids)) { [weak self] in self?.put(before) }
        if announce, let first = before.first { toasts.show("Restored to \(name(of: first.collectionId))") }
    }

    /// Final. The caller has already confirmed.
    public func purge(_ ids: Set<LinkItem.ID>) {
        let ids = Array(ids)
        let before = ids.compactMap { links[$0] }
        let oldOrder = order
        for id in ids { links[id] = nil; LocalImages.remove(id) }
        order.removeAll { ids.contains($0) }
        sync(.purge(ids)) { [weak self] in self?.put(before); self?.order = oldOrder }
    }

    public func emptyTrash() {
        purge(Set(trash.map(\.id)))
        toasts.show("Trash emptied")
    }

    func syncPriceAlert(id: LinkItem.ID, threshold: Double, currency: String, before: [LinkItem]) {
        sync(.priceAlert(id, threshold: threshold, currency: currency)) { [weak self] in self?.put(before) }
    }

    // MARK: - Collection intents

    public func createCollection(name: String, color: String) async -> LinkCollection? {
        do {
            let c = try await api.createCollection(name: name, color: color)
            collections.append(c)
            return c
        } catch {
            toasts.show(Self.message(for: error))
            return nil
        }
    }

    public func createFilter(name: String, query: String) async -> LinkCollection? {
        do {
            let c = try await api.createFilter(name: name, query: query)
            collections.append(c)
            toasts.show("Saved as a filter in Collections")
            return c
        } catch {
            toasts.show(Self.message(for: error))
            return nil
        }
    }

    public func rename(_ id: LinkCollection.ID, to newName: String) {
        guard let i = collections.firstIndex(where: { $0.id == id }) else { return }
        let old = collections[i]
        collections[i].name = newName
        sync(.rename(id, name: newName)) { [weak self] in self?.replaceCollection(id, with: old) }
    }

    private func replaceCollection(_ id: LinkCollection.ID, with c: LinkCollection) {
        if let i = collections.firstIndex(where: { $0.id == id }) { collections[i] = c }
    }

    /// Moves the collection's links to Unsorted and deletes it. Undo recreates it.
    public func dissolve(_ id: LinkCollection.ID) {
        guard let i = collections.firstIndex(where: { $0.id == id }), collections[i].isInbox != true else { return }
        let c = collections[i]
        let inbox = inboxID
        let memberIDs = ordered.filter { $0.collectionId == id && $0.deleted != true }.map(\.id)
        let before = change(memberIDs) { $0.collectionId = inbox }
        collections.remove(at: i)
        sync(.dissolve(id, members: memberIDs, inbox: inbox)) { [weak self] in self?.collections.insert(c, at: i); self?.put(before) }
        undo.register("\(c.name) dissolved — \(memberIDs.count.linkCount) back in Unsorted") { [weak self] in
            self?.undissolve(c, at: i, before: before)
        }
    }

    private func undissolve(_ c: LinkCollection, at i: Int, before: [LinkItem]) {
        collections.insert(c, at: min(i, collections.count))
        put(before.map { var l = links[$0.id] ?? $0; l.collectionId = c.id; return l })
        let ids = before.map(\.id)
        let api = api
        // BACKEND: no restore-collection endpoint; Undo recreates it with a new id and loses `reasoning`/`createdBy`.
        enqueue { [weak self] in
            do {
                let new = try await api.createCollection(name: c.name, color: c.color)
                self?.remapCollection(c.id, to: new.id)
                if !ids.isEmpty { try await api.bulk(.move(to: new.id), ids: ids) }
            } catch {
                self?.toasts.show(Self.message(for: error))
            }
        }
    }

    private func remapCollection(_ old: LinkCollection.ID, to new: LinkCollection.ID) {
        guard let i = collections.firstIndex(where: { $0.id == old }) else { return }
        let c = collections[i]
        collections[i] = LinkCollection(id: new, name: c.name, color: c.color, isSmart: c.isSmart, smartQuery: c.smartQuery,
                                        isInbox: c.isInbox, reasoning: c.reasoning, createdBy: c.createdBy)
        for l in ordered where l.collectionId == old { links[l.id]?.collectionId = new }
    }

    /// Mock only until the backend adds `DELETE /api/account`.
    public func deleteAccount() async -> Bool {
        do {
            try await api.deleteAccount()
            reset()
            return true
        } catch {
            toasts.show(Self.message(for: error))
            return false
        }
    }

    public func deleteEmptyCollections() async {
        do {
            let ids = try await api.deleteEmptyCollections()
            collections.removeAll { ids.contains($0.id) }
            toasts.show("Removed \(ids.count) empty collections")
        } catch {
            toasts.show(Self.message(for: error))
        }
    }
}
