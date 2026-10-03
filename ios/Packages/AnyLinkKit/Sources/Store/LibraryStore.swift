import Foundation
import Observation
import Models
import QueryLanguage
import Networking

public enum SyncState: Equatable, Sendable { case idle, syncing, failed(AppError), offline }

/// Single source of truth for library data. Intents update local state synchronously, then sync in a Task;
/// on failure they roll back and show a toast.
@MainActor @Observable
public final class LibraryStore {
    public private(set) var links: [LinkItem.ID: LinkItem] = [:] { didSet { cachedIndex = nil } }
    public private(set) var order: [LinkItem.ID] = []
    public private(set) var collections: [LinkCollection] = []
    public private(set) var syncState: SyncState = .idle
    public var clipboardHasURL = false

    public let toasts: ToastCenter
    public let undo: UndoCenter
    public let signals: SignalLogger
    @ObservationIgnored public let api: any AnyLinkAPI
    @ObservationIgnored private var inflight: [Task<Void, Never>] = []
    @ObservationIgnored private var tail: Task<Void, Never>?
    @ObservationIgnored private var cachedIndex: LibraryIndex?

    public init(api: any AnyLinkAPI, toasts: ToastCenter = ToastCenter(), snapshot: LibrarySnapshot? = nil) {
        self.api = api
        self.toasts = toasts
        self.undo = UndoCenter(toasts: toasts)
        self.signals = SignalLogger(api: api)
        if let snapshot { apply(snapshot) }
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
        return ordered.filter { query.matches($0, in: idx) }
    }

    public func links(in id: LinkCollection.ID) -> [LinkItem] {
        if let c = collection(id), c.isSmart == true { return links(matching: Query(c.smartQuery ?? "")) }
        return live.filter { $0.collectionId == id }
    }

    public func count(in id: LinkCollection.ID) -> Int { links(in: id).count }

    // MARK: - Sync plumbing

    public static func message(for error: Error) -> String {
        // ponytail: .offline rolls back like any error until the phase-11 Outbox queues it instead.
        "That didn't go through. Try again."
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

    private func sync(rollback: @escaping @MainActor () -> Void, _ op: @escaping @Sendable (any AnyLinkAPI) async throws -> Void) {
        let api = api
        enqueue { [weak self] in
            do { try await op(api) } catch {
                rollback()
                self?.toasts.show(Self.message(for: error))
            }
        }
    }

    @discardableResult
    private func change(_ ids: [LinkItem.ID], _ edit: (inout LinkItem) -> Void) -> [LinkItem] {
        let before = ids.compactMap { links[$0] }
        for var l in before { edit(&l); links[l.id] = l }
        return before
    }

    private func put(_ before: [LinkItem]) { for l in before { links[l.id] = l } }

    // MARK: - Loading

    public func apply(_ snapshot: LibrarySnapshot) {
        var all: [LinkItem.ID: LinkItem] = [:]
        for l in snapshot.links { all[l.id] = l }
        for var l in snapshot.trashed { l.deleted = true; all[l.id] = l }
        links = all
        order = all.values.sorted { $0.createdAt > $1.createdAt }.map(\.id)
        collections = snapshot.collections
    }

    public func refresh() async {
        syncState = .syncing
        do {
            apply(try await api.library(since: nil))
            syncState = .idle
        } catch AppError.offline {
            syncState = .offline
        } catch {
            syncState = .failed(error as? AppError ?? .unknown)
        }
    }

    // MARK: - Link intents

    /// Shows the link at once, then replaces it with the server's copy.
    @discardableResult
    public func save(_ draft: LinkDraft) async -> LinkItem? {
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
        links[temp.id] = temp
        order.insert(temp.id, at: 0)
        do {
            let saved = try await api.createLink(draft)
            links[temp.id] = nil
            links[saved.id] = saved
            if let i = order.firstIndex(of: temp.id) { order[i] = saved.id }
            undo.register("Saved to \(name(of: saved.collectionId))") { [weak self] in self?.trash([saved.id], announce: false) }
            return saved
        } catch {
            links[temp.id] = nil
            order.removeAll { $0 == temp.id }
            toasts.show(Self.message(for: error))
            return nil
        }
    }

    public func move(_ ids: Set<LinkItem.ID>, to target: LinkCollection.ID) {
        let ids = Array(ids)
        let before = change(ids) { $0.collectionId = target }
        sync(rollback: { [weak self] in self?.put(before) }) { try await $0.bulk(.move(to: target), ids: ids) }
        signals.log("move", linkIds: ids, collectionId: target)
        undo.register("Moved to \(name(of: target))") { [weak self] in self?.revertCollections(before) }
    }

    private func revertCollections(_ before: [LinkItem]) {
        let now = before.compactMap { links[$0.id] }
        for l in before { links[l.id]?.collectionId = l.collectionId }
        for (cid, group) in Dictionary(grouping: before, by: \.collectionId) {
            let ids = group.map(\.id)
            sync(rollback: { [weak self] in self?.put(now) }) { try await $0.bulk(.move(to: cid), ids: ids) }
        }
    }

    public func setFavorite(_ id: LinkItem.ID, _ on: Bool) {
        let before = change([id]) { $0.favorite = on }
        sync(rollback: { [weak self] in self?.put(before) }) { try await $0.updateLink(id, LinkPatch(favorite: on)) }
        toasts.show(on ? "Added to favorites" : "Removed from favorites")
    }

    public func setNote(_ id: LinkItem.ID, _ text: String) {
        let before = change([id]) { $0.note = text.isEmpty ? nil : text }
        sync(rollback: { [weak self] in self?.put(before) }) { try await $0.updateLink(id, LinkPatch(note: text)) }
        toasts.show("Note saved")
    }

    public func addHighlight(_ id: LinkItem.ID, quote: String) {
        let before = change([id]) { $0.highlights = ($0.highlights ?? []) + [Highlight(id: "local-\(UUID().uuidString)", quote: quote)] }
        sync(rollback: { [weak self] in self?.put(before) }) { try await $0.addHighlight(id, quote: quote) }
        toasts.show("Highlighted")
    }

    public func tag(_ ids: Set<LinkItem.ID>, _ tag: String) {
        let tag = tag.hasPrefix("#") ? String(tag.dropFirst()) : tag
        guard !tag.isEmpty else { return }
        let ids = Array(ids)
        let before = change(ids) { if !$0.tags.contains(tag) { $0.tags.append(tag) } }
        sync(rollback: { [weak self] in self?.put(before) }) { try await $0.bulk(.tag(tag), ids: ids) }
        toasts.show("Tagged \(ids.count) \(ids.count == 1 ? "link" : "links") #\(tag)")
    }

    public func archive(_ ids: Set<LinkItem.ID>) {
        let ids = Array(ids)
        let before = change(ids) { $0.archived = true }
        sync(rollback: { [weak self] in self?.put(before) }) { try await $0.bulk(.archive, ids: ids) }
        undo.register("Archived \(ids.count) \(ids.count == 1 ? "link" : "links")") { [weak self] in
            // BACKEND: no unarchive endpoint (10-decisions open question 4); Undo is local until one exists.
            self?.put(before)
        }
    }

    public func trash(_ ids: Set<LinkItem.ID>, announce: Bool = true) {
        let ids = Array(ids)
        let before = change(ids) { $0.deleted = true }
        sync(rollback: { [weak self] in self?.put(before) }) { try await $0.bulk(.trash, ids: ids) }
        guard announce else { return }
        undo.register(ids.count == 1 ? "Moved to Trash" : "\(ids.count) links moved to Trash") { [weak self] in
            self?.restore(Set(ids), announce: false)
        }
    }

    public func restore(_ ids: Set<LinkItem.ID>, announce: Bool = true) {
        let ids = Array(ids)
        let before = change(ids) { $0.deleted = false }
        sync(rollback: { [weak self] in self?.put(before) }) { try await $0.bulk(.restore, ids: ids) }
        if announce, let first = before.first { toasts.show("Restored to \(name(of: first.collectionId))") }
    }

    /// Final. The caller has already confirmed.
    public func purge(_ ids: Set<LinkItem.ID>) {
        let ids = Array(ids)
        let before = ids.compactMap { links[$0] }
        let oldOrder = order
        for id in ids { links[id] = nil }
        order.removeAll { ids.contains($0) }
        sync(rollback: { [weak self] in self?.put(before); self?.order = oldOrder }) { try await $0.bulk(.purge, ids: ids) }
    }

    public func emptyTrash() {
        purge(Set(trash.map(\.id)))
        toasts.show("Trash emptied")
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
        sync(rollback: { [weak self] in self?.replaceCollection(id, with: old) }) { try await $0.updateCollection(id, name: newName) }
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
        sync(rollback: { [weak self] in self?.collections.insert(c, at: i); self?.put(before) }) { api in
            if !memberIDs.isEmpty { try await api.bulk(.move(to: inbox), ids: memberIDs) }
            _ = try await api.deleteCollection(id)
        }
        undo.register("\(c.name) dissolved — \(memberIDs.count) links back in Unsorted") { [weak self] in
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
