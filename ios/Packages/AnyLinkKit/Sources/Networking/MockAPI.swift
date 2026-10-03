import Foundation
import Models

public actor MockAPI: @preconcurrency AnyLinkAPI {
    private var links: [LinkItem]
    private var trashed: [LinkItem]
    private var collections: [LinkCollection]
    private var crawlLines: [String: [String]]
    private var nextError: AppError?
    private let latency: Bool

    public init(links: [LinkItem], trashed: [LinkItem], collections: [LinkCollection], crawlLines: [String: [String]] = [:], latency: Bool = true) {
        self.links = links; self.trashed = trashed; self.collections = collections; self.crawlLines = crawlLines; self.latency = latency
    }

    public func failNext(_ error: AppError) { nextError = error }

    private func maybeThrow() throws {
        if let e = nextError { nextError = nil; throw e }
    }

    private func delay() async {
        guard latency else { return }
        try? await Task.sleep(for: .milliseconds(Int.random(in: 150...400)))
    }

    // MARK: - AnyLinkAPI

    public func crawl(_ url: URL) -> AsyncThrowingStream<CrawlEvent, Error> {
        let host = url.host() ?? ""
        let key: String
        if host.contains("blocked") { key = "excerpt-only" }
        else if host.contains("dead") || host.contains("404") { key = "failed" }
        else { key = "success" }

        let lines = crawlLines[key] ?? []
        return AsyncThrowingStream { cont in
            Task { [lines] in
                for line in lines {
                    if let ms = NDJSONDecoder.delayMs(from: line), ms > 0 {
                        try? await Task.sleep(for: .milliseconds(ms))
                    }
                    do {
                        let event = try NDJSONDecoder.decodeLine(line, as: CrawlEvent.self)
                        cont.yield(event)
                    } catch {
                        cont.finish(throwing: error)
                        return
                    }
                }
                cont.finish()
            }
        }
    }

    public func checkImportedLinks() -> AsyncThrowingStream<LinkCheckEvent, Error> {
        AsyncThrowingStream { $0.finish() }
    }

    public func library(since: Date?) async throws -> LibrarySnapshot {
        try maybeThrow()
        return LibrarySnapshot(links: links, trashed: trashed, collections: collections)
    }

    public func createLink(_ draft: LinkDraft) async throws -> LinkItem {
        try maybeThrow(); await delay()
        let id = UUID().uuidString
        let cr = draft.crawl
        let link = LinkItem(
            id: id, url: draft.url, domain: cr?.domain ?? URL(string: draft.url)?.host() ?? "",
            title: draft.title ?? cr?.title ?? draft.url,
            excerpt: draft.excerpt ?? cr?.excerpt ?? "",
            articleText: cr?.articleText, heroImage: cr?.heroImage,
            tint: cr?.tint ?? "#9AA3AD", stripe: cr?.stripe ?? "#FFFFFF", initial: cr?.initial ?? "?",
            contentType: cr?.contentType ?? .article,
            readingTimeMinutes: cr?.readingTimeMinutes,
            collectionId: draft.collectionId ?? "unsorted",
            tags: draft.tags, size: draft.size, position: 0, status: .ready,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            source: "manual", importMeta: nil, note: draft.note,
            favorite: false, httpStatus: 200, archived: false, deleted: false,
            highlights: [], product: cr?.product
        )
        links.insert(link, at: 0)
        return link
    }

    public func updateLink(_ id: LinkItem.ID, _ patch: LinkPatch) async throws {
        try maybeThrow(); await delay()
        guard let i = links.firstIndex(where: { $0.id == id }) else { throw AppError.notFound }
        if let n = patch.note { links[i].note = n }
        if let f = patch.favorite { links[i].favorite = f }
        if let s = patch.size { links[i].size = s }
        if let c = patch.collectionId { links[i].collectionId = c }
    }

    public func bulk(_ action: BulkAction, ids: [LinkItem.ID]) async throws {
        try maybeThrow(); await delay()
        switch action {
        case .move(let to):
            for i in links.indices where ids.contains(links[i].id) { links[i].collectionId = to }
        case .tag(let t):
            for i in links.indices where ids.contains(links[i].id) {
                if !links[i].tags.contains(t) { links[i].tags.append(t) }
            }
        case .archive:
            for i in links.indices where ids.contains(links[i].id) { links[i].archived = true }
        case .trash:
            let removed = links.filter { ids.contains($0.id) }.map { var l = $0; l.deleted = true; return l }
            links.removeAll { ids.contains($0.id) }
            trashed.append(contentsOf: removed)
        case .restore:
            let restored = trashed.filter { ids.contains($0.id) }.map { var l = $0; l.deleted = false; return l }
            trashed.removeAll { ids.contains($0.id) }
            links.append(contentsOf: restored)
        case .purge:
            trashed.removeAll { ids.contains($0.id) }
        }
    }

    public func reorder(_ ids: [LinkItem.ID]) async throws { try maybeThrow() }
    public func reorderCollections(_ ids: [LinkCollection.ID]) async throws { try maybeThrow() }

    public func createCollection(name: String, color: String) async throws -> LinkCollection {
        try maybeThrow(); await delay()
        let c = LinkCollection(id: UUID().uuidString, name: name, color: color, createdBy: "user")
        collections.append(c)
        return c
    }

    public func createFilter(name: String, query: String) async throws -> LinkCollection {
        try maybeThrow(); await delay()
        let c = LinkCollection(id: UUID().uuidString, name: name, color: "#7C8CFF", isSmart: true, smartQuery: query, createdBy: "user")
        collections.append(c)
        return c
    }

    public func updateCollection(_ id: LinkCollection.ID, name: String) async throws {
        try maybeThrow(); await delay()
        guard let i = collections.firstIndex(where: { $0.id == id }) else { throw AppError.notFound }
        collections[i].name = name
    }

    public func deleteCollection(_ id: LinkCollection.ID) async throws -> [LinkItem.ID] {
        try maybeThrow(); await delay()
        guard let i = collections.firstIndex(where: { $0.id == id }) else { throw AppError.notFound }
        if collections[i].isInbox == true { throw AppError.server(400) }
        collections.remove(at: i)
        let affected = links.indices.filter { links[$0].collectionId == id }
        var trashedIds: [String] = []
        for idx in affected.reversed() {
            links[idx].deleted = true
            trashedIds.append(links[idx].id)
            trashed.append(links.remove(at: idx))
        }
        return trashedIds
    }

    public func deleteEmptyCollections() async throws -> [LinkCollection.ID] {
        try maybeThrow(); await delay()
        let linkCollections = Set(links.map(\.collectionId))
        let empty = collections.filter { $0.isInbox != true && $0.isSmart != true && !linkCollections.contains($0.id) }
        let ids = empty.map(\.id)
        collections.removeAll { ids.contains($0.id) }
        return ids
    }

    public func addHighlight(_ id: LinkItem.ID, quote: String) async throws {
        try maybeThrow(); await delay()
        guard let i = links.firstIndex(where: { $0.id == id }) else { throw AppError.notFound }
        let h = Highlight(id: UUID().uuidString, quote: quote)
        if links[i].highlights == nil { links[i].highlights = [] }
        links[i].highlights?.append(h)
    }

    public func setPriceAlert(_ id: LinkItem.ID, threshold: Double, currency: String) async throws {
        try maybeThrow(); await delay()
        guard let i = links.firstIndex(where: { $0.id == id }), links[i].product != nil else { throw AppError.notFound }
        links[i].product?.alertThreshold = threshold
    }

    public func importLinks(_ items: [ImportItem]) async throws -> ImportResult {
        try maybeThrow(); await delay()
        return ImportResult(links: [], skipped: 0)
    }

    public func groupInbox(_ priorities: GroupingPriorities) async throws -> [GroupedResult] {
        try maybeThrow(); await delay()
        return []
    }

    public nonisolated func logSignal(_ signal: Signal) async {}

    public func deleteAccount() async throws {
        try maybeThrow()
        links = []; trashed = []; collections = []
    }
}

// MARK: - Convenience initializer with Fixtures

extension MockAPI {
    public static func withFixtures(latency: Bool = true) -> MockAPI {
        // Caller must pass fixture data — this avoids a circular dependency on Fixtures
        MockAPI(links: [], trashed: [], collections: [], latency: latency)
    }
}
