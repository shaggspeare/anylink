import Foundation
import Models
import Networking
import Persistence

/// A local library (ADR 0002, D28): `AnyLinkAPI` over `LocalStore`, so `LibraryStore` works as it does with a server
/// library. Nothing reaches AnyLink's server but crawls, the import's link check and its grouping, which go out signed
/// with App Attest and leave nothing there. Sharing, price alerts and export are Pro: they answer `.proRequired`.
@MainActor
public final class LocalAPI: AnyLinkAPI {
    public typealias Crawl = @Sendable (URL) async -> AsyncThrowingStream<CrawlEvent, Error>

    /// Built in, not stored: every device has the same inbox, so there's no second one to sync.
    public static let inbox = LinkCollection(id: "unsorted", name: "Unsorted", color: "#9AA3AD", isSmart: false,
                                             isInbox: true, createdBy: "system")

    let store: LocalStore
    let crawler: Crawl?
    let services: LocalServices?
    /// Opens share links someone sent: reading one needs no account.
    let shared: (any AnyLinkAPI)?
    /// Runs after a background read filled in a link, so the app can show it.
    public var onChange: (@MainActor () -> Void)?
    private var reading: Task<Void, Never>?

    /// `crawler`, `services` and `shared` are nil without a backend: pages aren't read, imported links aren't checked,
    /// and grouping falls back to `LibraryRules.metadataGroups`.
    public init(store: LocalStore, crawler: Crawl?, services: LocalServices? = nil, shared: (any AnyLinkAPI)? = nil) {
        self.store = store; self.crawler = crawler; self.services = services; self.shared = shared
    }

    // MARK: - Reading

    public func library(since: Date?) async throws -> LibrarySnapshot {
        let all = store.links()
        // An image saved on another device arrives as bytes; cards show files.
        for l in all where l.isImage && LocalImages.existing(for: l.id) == nil {
            if let jpeg = store.image(for: l.id) { LocalImages.write(jpeg, id: l.id) }
        }
        readUnread()
        return LibrarySnapshot(links: all.filter { $0.deleted != true }, trashed: all.filter { $0.deleted == true },
                               collections: [Self.inbox] + store.collections())
    }

    public func crawl(_ url: URL) async -> AsyncThrowingStream<CrawlEvent, Error> {
        if let crawler { return await crawler(url) }
        return AsyncThrowingStream { $0.yield(.failed(CrawlFailure(reason: "network"))); $0.finish() }
    }

    // MARK: - Saving

    public func createLink(_ draft: LinkDraft) async throws -> LinkItem {
        let cr = draft.crawl
        let host = URL(string: draft.url)?.host() ?? draft.url
        let domain = cr?.domain ?? (host.hasPrefix("www.") ? String(host.dropFirst(4)) : host)
        // Saved before anything read the page (the share extension, Shortcuts, a failed read): read it now.
        let unread = (draft.excerpt ?? cr?.excerpt ?? "").isEmpty && (cr?.articleText ?? []).isEmpty
        let link = LinkItem(
            id: UUID().uuidString, url: cr?.canonicalUrl ?? draft.url, domain: domain,
            title: draft.title ?? cr?.title ?? domain, excerpt: draft.excerpt ?? cr?.excerpt ?? "",
            // ponytail: remote hero URLs; cache them on device if hotlink blocks show up.
            articleText: cr?.articleText, heroImage: cr?.heroImage,
            tint: cr?.tint ?? "#9AA3AD", stripe: cr?.stripe ?? "#FFFFFF",
            initial: cr?.initial ?? String(domain.prefix(1)).uppercased(),
            contentType: cr?.contentType ?? .article, readingTimeMinutes: cr?.readingTimeMinutes,
            collectionId: collectionOrInbox(draft.collectionId), tags: draft.tags, size: draft.size,
            status: unread ? .crawling : .ready, createdAt: Date().formatted(.iso8601), source: "ios",
            note: draft.note?.nilIfEmpty, product: cr?.product
        )
        store.save([link])
        if unread { readUnread() }
        return link
    }

    public func createNote(_ text: String, collectionId: LinkCollection.ID?) async throws -> LinkItem {
        let link = LibraryRules.note(text, collectionId: collectionOrInbox(collectionId))
        store.save([link])
        return link
    }

    /// The JPEG syncs with the link, as a CloudKit asset.
    public func createImage(_ data: Data, collectionId: LinkCollection.ID?, caption: String?) async throws -> LinkItem {
        let link = LibraryRules.image(caption: caption, collectionId: collectionOrInbox(collectionId))
        store.save(link, image: data)
        return link
    }

    public func importLinks(_ items: [ImportItem]) async throws -> ImportResult {
        let added = LibraryRules.imported(items, existing: store.links(), inbox: Self.inbox.id)
        store.save(added)
        return ImportResult(links: added, skipped: items.count - added.count)
    }

    /// A share link's links, copied in. Reading it is public; the copies are local.
    public func saveFromShare(token: String, linkIds: [LinkItem.ID]?) async throws -> SavedFromShare {
        let saved = LibraryRules.copies(of: try await sharedCollection(token: token), linkIds: linkIds, inbox: Self.inbox.id)
        if let made = saved.collection { store.save([made]) }
        store.save(saved.links)
        return saved
    }

    public func sharedCollection(token: String) async throws -> SharedCollection {
        guard let shared else { throw AppError.server(501) }
        return try await shared.sharedCollection(token: token)
    }

    // MARK: - Editing

    public func setNoteText(_ id: LinkItem.ID, _ text: String) async throws {
        try edit(id) { $0.excerpt = text; $0.title = noteTitle(text) }
    }

    /// The pin limit is the server's: two live links.
    public func updateLink(_ id: LinkItem.ID, _ patch: LinkPatch) async throws {
        try edit(id) { link in
            if let pinned = patch.pinned {
                if pinned && (link.archived == true || link.deleted == true) { throw AppError.notFound }
                if pinned && link.pinned != true,
                   store.links().filter({ $0.pinned == true && $0.archived != true && $0.deleted != true }).count >= 2 {
                    throw AppError.pinLimit
                }
                link.pinned = pinned
            }
            if let note = patch.note { link.note = note.nilIfEmpty }
            if let favorite = patch.favorite { link.favorite = favorite }
            if let size = patch.size { link.size = size }
            if let c = patch.collectionId { link.collectionId = c }
        }
    }

    public func addHighlight(_ id: LinkItem.ID, quote: String) async throws {
        try edit(id) { $0.highlights = ($0.highlights ?? []) + [Highlight(id: UUID().uuidString, quote: quote)] }
    }

    /// Links deleted on another device meanwhile are skipped, not an error.
    public func bulk(_ action: BulkAction, ids: [LinkItem.ID]) async throws {
        switch action {
        case .move(let to): change(ids) { $0.collectionId = to }
        case .tag(let tag): change(ids) { if !$0.tags.contains(tag) { $0.tags.append(tag) } }
        case .archive: change(ids) { $0.archived = true; $0.pinned = false }
        case .trash: change(ids) { $0.deleted = true; $0.pinned = false }
        case .restore: change(ids) { $0.deleted = false }
        case .purge: store.deleteLinks(ids)
        }
    }

    /// Nothing in the app reorders yet; collections keep the order they were made in.
    public func reorder(_ ids: [LinkItem.ID]) async throws {}
    public func reorderCollections(_ ids: [LinkCollection.ID]) async throws {}

    // MARK: - Collections

    public func createCollection(name: String, color: String, icon: String?) async throws -> LinkCollection {
        let c = LinkCollection(id: UUID().uuidString, name: name, color: color, createdBy: "user", icon: icon)
        store.save([c])
        return c
    }

    public func createFilter(name: String, query: String) async throws -> LinkCollection {
        let c = LinkCollection(id: UUID().uuidString, name: name, color: "#7C8CFF", isSmart: true, smartQuery: query, createdBy: "user")
        store.save([c])
        return c
    }

    public func updateCollection(_ id: LinkCollection.ID, name: String) async throws {
        guard var c = store.collections().first(where: { $0.id == id }) else { throw AppError.notFound }
        c.name = name
        store.save([c])
    }

    /// As on the server: its links, trashed ones too, go to the inbox; nothing is trashed.
    public func deleteCollection(_ id: LinkCollection.ID) async throws -> [LinkItem.ID] {
        guard id != Self.inbox.id else { throw AppError.server(400) }
        change(store.links().filter { $0.collectionId == id }.map(\.id)) { $0.collectionId = Self.inbox.id }
        store.deleteCollections([id])
        return []
    }

    public func deleteEmptyCollections() async throws -> [LinkCollection.ID] {
        let used = Set(store.links().filter { $0.deleted != true }.map(\.collectionId))
        let empty = store.collections().filter { $0.isSmart != true && !used.contains($0.id) }.map(\.id)
        store.deleteCollections(empty)
        return empty
    }

    // MARK: - Import

    /// The import's dead-link check, up to 600 links a call like the server's. Statuses land on the links when the
    /// call ends, and `remaining` counts every imported link still unchecked, so `OnboardingModel` calls again.
    public func checkImportedLinks() async -> AsyncThrowingStream<LinkCheckEvent, Error> {
        let batch = Array(uncheckedImports().prefix(600))
        guard let services, !batch.isEmpty else {
            return AsyncThrowingStream { $0.yield(LinkCheckEvent(type: "done", checked: 0, dead: [], deadCount: 0, remaining: 0)); $0.finish() }
        }
        let upstream = services.check(batch)
        let (stream, cont) = AsyncThrowingStream.makeStream(of: LinkCheckEvent.self)
        let task = Task { [weak self] in
            do {
                for try await event in upstream {
                    cont.yield(event.type == "done" ? self?.record(event, for: batch) ?? event : event)
                }
                cont.finish()
            } catch {
                cont.finish(throwing: error)
            }
        }
        cont.onTermination = { _ in task.cancel() }
        return stream
    }

    /// The call checked the first `checked` links of the batch: the dead ones keep their status, the rest answered.
    private func record(_ done: LinkCheckEvent, for batch: [LinkItem]) -> LinkCheckEvent {
        let dead = Dictionary((done.dead ?? []).map { ($0.id, $0.status) }, uniquingKeysWith: { first, _ in first })
        change(batch.prefix(done.checked ?? 0).map(\.id)) { $0.httpStatus = dead[$0.id] ?? 200 }
        return LinkCheckEvent(type: "done", checked: done.checked, dead: done.dead, deadCount: done.deadCount,
                              remaining: uncheckedImports().count)
    }

    private func uncheckedImports() -> [LinkItem] {
        store.links().filter { $0.httpStatus == nil && $0.importMeta != nil && $0.deleted != true }
            .sorted { ($0.createdAt, $0.url) < ($1.createdAt, $1.url) }
    }

    /// The server's AI grouping. When it can't answer (offline, its daily cap), folders and domains still group.
    public func groupInbox(_ priorities: GroupingPriorities) async throws -> [GroupedResult] {
        let inbox = store.links().filter { $0.collectionId == Self.inbox.id && $0.deleted != true && $0.archived != true }
        let grouped: [GroupedResult]? = if let services { try? await services.group(inbox, priorities: priorities) } else { nil }
        let results = grouped ?? LibraryRules.metadataGroups(inbox, priorities: priorities)
        for r in results {
            store.save([r.collection])
            change(r.linkIds) { if $0.collectionId == Self.inbox.id { $0.collectionId = r.collection.id } }
        }
        return results
    }

    // MARK: - Not in a local library

    public func logSignal(_ signal: Signal) async {}
    public func setShared(_ id: LinkCollection.ID, _ shared: Bool) async throws -> String? { throw AppError.proRequired }
    public func setPriceAlert(_ id: LinkItem.ID, threshold: Double, currency: String) async throws { throw AppError.proRequired }
    /// Settings hides Delete account without an account.
    public func deleteAccount() async throws { throw AppError.server(501) }

    // MARK: - Reading pages in the background

    /// Reads every link saved before its page was, one at a time, oldest first. Offline, a link waits for the next
    /// `library()`.
    private func readUnread() {
        guard reading == nil, let crawler else { return }
        reading = Task { [weak self] in
            var tried: Set<LinkItem.ID> = []
            while let queue = self?.unread(excluding: tried), !queue.isEmpty {
                for link in queue {
                    tried.insert(link.id)
                    await self?.read(link, with: crawler)
                }
            }
            self?.reading = nil
        }
    }

    private func unread(excluding tried: Set<LinkItem.ID>) -> [LinkItem] {
        store.links().filter { $0.status == .crawling && !tried.contains($0.id) }.sorted { $0.createdAt < $1.createdAt }
    }

    /// Like the server's `fillFromPage`: the page's fields and tags fill in, and the title too unless the save came
    /// with a real one. A page that can't be read keeps what it was saved with.
    private func read(_ link: LinkItem, with crawler: Crawl) async {
        var result: CrawlResult?
        if let url = URL(string: link.url) {
            do {
                for try await event in await crawler(url) {
                    if case .preview(let r) = event { result = r }
                    if case .done(let r) = event { result = r }
                }
            } catch {
                return
            }
        }
        // Edits made while it read are in the store; keep them.
        guard var now = store.links([link.id]).first, now.status == .crawling else { return }
        if let r = result {
            let host = URL(string: now.url)?.host()
            if [now.url, now.domain, r.domain, host ?? ""].contains(now.title) || now.title.isEmpty { now.title = r.title }
            now.excerpt = r.excerpt
            now.articleText = r.articleText
            now.heroImage = r.heroImage
            now.tint = r.tint; now.stripe = r.stripe; now.initial = r.initial
            now.contentType = r.contentType
            now.readingTimeMinutes = r.readingTimeMinutes
            now.product = r.product
            for tag in r.suggestedTags where !now.tags.contains(tag) { now.tags.append(tag) }
        }
        now.status = .ready
        store.save([now])
        onChange?()
    }

    // MARK: - Plumbing

    /// The server files a save into the inbox when its collection is unknown or a filter.
    private func collectionOrInbox(_ id: LinkCollection.ID?) -> LinkCollection.ID {
        guard let id, store.collections().contains(where: { $0.id == id && $0.isSmart != true }) else { return Self.inbox.id }
        return id
    }

    private func edit(_ id: LinkItem.ID, _ apply: (inout LinkItem) throws -> Void) throws {
        guard var link = store.links([id]).first else { throw AppError.notFound }
        try apply(&link)
        store.save([link])
    }

    private func change(_ ids: [LinkItem.ID], _ apply: (inout LinkItem) -> Void) {
        let links = store.links(ids).map { var l = $0; apply(&l); return l }
        store.save(links)
    }
}
