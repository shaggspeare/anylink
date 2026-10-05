import Foundation
import Models

public actor MockAPI: AnyLinkAPI {
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

    /// Crawl bookkeeping, so tests can assert that cancelling the Add sheet stops the stream.
    public private(set) var crawlsStarted = 0
    public private(set) var crawlsCancelled = 0
    private func crawlCancelled() { crawlsCancelled += 1 }

    public func crawl(_ url: URL) -> AsyncThrowingStream<CrawlEvent, Error> {
        let host = url.host() ?? ""
        let key: String
        if host.contains("blocked") { key = "excerpt-only" }
        else if host.contains("dead") || host.contains("404") { key = "failed" }
        else { key = "success" }

        let lines = (crawlLines[key] ?? []).map { key == "success" ? Self.rewrite($0, for: url) : $0 }
        crawlsStarted += 1
        let (stream, cont) = AsyncThrowingStream.makeStream(of: CrawlEvent.self)
        let latency = latency
        let task = Task { [weak self] in
            do {
                for line in lines {
                    if latency, let ms = NDJSONDecoder.delayMs(from: line), ms > 0 {
                        try await Task.sleep(for: .milliseconds(ms))
                    }
                    try Task.checkCancellation()
                    cont.yield(try NDJSONDecoder.decodeLine(line, as: CrawlEvent.self))
                }
                cont.finish()
            } catch is CancellationError {
                await self?.crawlCancelled()
            } catch {
                cont.finish(throwing: error)
            }
        }
        cont.onTermination = { reason in
            if case .cancelled = reason { task.cancel() }
        }
        return stream
    }

    /// The success stream is recorded for one page; make it look like the pasted URL's site.
    static func rewrite(_ line: String, for url: URL) -> String {
        guard var obj = (try? JSONSerialization.jsonObject(with: Data(line.utf8))) as? [String: Any],
              var result = obj["result"] as? [String: Any],
              let host = url.host() else { return line }
        let domain = host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
        result["domain"] = domain
        result["canonicalUrl"] = url.absoluteString
        result["initial"] = String(domain.prefix(1)).uppercased()
        obj["result"] = result
        guard let data = try? JSONSerialization.data(withJSONObject: obj) else { return line }
        return String(decoding: data, as: UTF8.self)
    }

    /// Mirrors `/api/import/check`: up to 600 unchecked imported links per call, a line per link, `remaining` at the end.
    /// With latency on, 1,284 links take about 3 s in total.
    public func checkImportedLinks() -> AsyncThrowingStream<LinkCheckEvent, Error> {
        let batch = Array(links.indices.filter { links[$0].httpStatus == nil && links[$0].importMeta != nil }.prefix(600))
        var dead: [LinkCheckEvent.DeadLink] = []
        var events: [LinkCheckEvent] = [LinkCheckEvent(type: "start", total: batch.count)]
        for (n, i) in batch.enumerated() {
            let status = Self.mockStatus(for: links[i].url)
            links[i].httpStatus = status
            if [0, 1, 404, 410].contains(status) {
                dead.append(.init(id: links[i].id, url: links[i].url, title: links[i].title, status: status))
            }
            events.append(LinkCheckEvent(type: "progress", checked: n + 1, deadCount: dead.count))
        }
        let remaining = links.filter { $0.httpStatus == nil && $0.importMeta != nil }.count
        events.append(LinkCheckEvent(type: "done", checked: batch.count, dead: dead, deadCount: dead.count, remaining: remaining))

        let latency = latency
        let step = 21   // 50 ms per 21 links ≈ 3 s for a 1,284-link run, across however many requests it takes
        let (stream, cont) = AsyncThrowingStream.makeStream(of: LinkCheckEvent.self)
        let task = Task {
            for (i, e) in events.enumerated() {
                if latency, i % step == 0 { try? await Task.sleep(for: .milliseconds(50)) }
                if Task.isCancelled { break }
                cont.yield(e)
            }
            cont.finish()
        }
        cont.onTermination = { _ in task.cancel() }
        return stream
    }

    /// Deterministic: hosts saying dead/gone → 404, parked → 1, otherwise ~9 % fail by URL hash.
    static func mockStatus(for url: String) -> Int {
        let host = URL(string: url)?.host() ?? ""
        if host.contains("dead") || host.contains("gone") { return 404 }
        if host.contains("parked") { return 1 }
        let h = url.unicodeScalars.reduce(UInt32(7)) { ($0 &* 31) &+ $1.value } % 100
        switch h {
        case ..<4: return 404
        case ..<5: return 410
        case ..<7: return 1
        case ..<9: return 0
        default: return 200
        }
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

    public func createNote(_ text: String, collectionId: LinkCollection.ID?) async throws -> LinkItem {
        try maybeThrow(); await delay()
        let link = LinkItem(
            id: UUID().uuidString, url: "", domain: "", title: noteTitle(text), excerpt: text,
            tint: "#D6F24B", stripe: "#17181B", initial: "✎", contentType: .note,
            collectionId: collectionId ?? "unsorted", tags: [], size: .M, status: .ready,
            createdAt: Date().formatted(.iso8601), source: "ios"
        )
        links.insert(link, at: 0)
        return link
    }

    /// No upload in the mock: the card keeps showing the local file the store wrote.
    public func createImage(_ data: Data, collectionId: LinkCollection.ID?, caption: String?) async throws -> LinkItem {
        try maybeThrow(); await delay()
        let link = LinkItem(
            id: UUID().uuidString, url: "", domain: "", title: caption.flatMap { $0.isEmpty ? nil : $0 } ?? "Image", excerpt: "",
            tint: "#17181B", stripe: "#FFFFFF", initial: "▣", contentType: .image,
            collectionId: collectionId ?? "unsorted", tags: [], size: .M, status: .ready,
            createdAt: Date().formatted(.iso8601), source: "ios"
        )
        links.insert(link, at: 0)
        return link
    }

    public func setNoteText(_ id: LinkItem.ID, _ text: String) async throws {
        try maybeThrow(); await delay()
        guard let i = links.firstIndex(where: { $0.id == id }) else { throw AppError.notFound }
        links[i].excerpt = text
        links[i].title = noteTitle(text)
    }

    public func updateLink(_ id: LinkItem.ID, _ patch: LinkPatch) async throws {
        try maybeThrow(); await delay()
        guard let i = links.firstIndex(where: { $0.id == id }) else { throw AppError.notFound }
        if let pinned = patch.pinned {
            if pinned && (links[i].archived == true || links[i].deleted == true) { throw AppError.notFound }
            if pinned && links[i].pinned != true && links.filter({ $0.pinned == true && $0.archived != true && $0.deleted != true }).count >= 2 {
                throw AppError.pinLimit
            }
            links[i].pinned = pinned
        }
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
            for i in links.indices where ids.contains(links[i].id) { links[i].archived = true; links[i].pinned = false }
        case .trash:
            let removed = links.filter { ids.contains($0.id) }.map { var l = $0; l.deleted = true; l.pinned = false; return l }
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

    private var inboxID: String { collections.first { $0.isInbox == true }?.id ?? "unsorted" }

    public func importLinks(_ items: [ImportItem]) async throws -> ImportResult {
        try maybeThrow(); await delay()
        func key(_ u: String) -> String { var k = u.lowercased(); while k.hasSuffix("/") { k.removeLast() }; return k }
        var existing = Set((links + trashed).map { key($0.url) })
        let tints = ["#FF5A1F", "#7C8CFF", "#D6F24B", "#9AA3AD", "#17181B", "#E0855A"]
        var added: [LinkItem] = []
        for item in items where existing.insert(key(item.url)).inserted {
            let host = URL(string: item.url)?.host() ?? item.url
            let domain = host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
            let h = Int(domain.unicodeScalars.reduce(UInt32(5)) { ($0 &* 33) &+ $1.value } % UInt32(tints.count))
            let tint = tints[h]
            added.append(LinkItem(
                id: UUID().uuidString, url: item.url, domain: domain, title: item.title, excerpt: "",
                tint: tint, stripe: tint == "#17181B" || tint == "#7C8CFF" ? "#FFFFFF" : "#17181B",
                initial: String(domain.prefix(1)).uppercased(),
                contentType: domain.contains("youtube") ? .video : .article,
                collectionId: inboxID, tags: [], size: .M, status: .ready,
                createdAt: item.meta.savedAt ?? Date().formatted(.iso8601),
                source: item.source, importMeta: item.meta
            ))
        }
        links.append(contentsOf: added)
        return ImportResult(links: added, skipped: items.count - added.count)
    }

    /// Port of the web `groupByMetadata` fallback: deepest folder (or Telegram context), else domain; groups of 3+.
    public func groupInbox(_ priorities: GroupingPriorities) async throws -> [GroupedResult] {
        try maybeThrow(); await delay()
        let inbox = inboxID
        let alive = links.filter { $0.collectionId == inbox && ![0, 1, 404, 410].contains($0.httpStatus ?? 200) }
        var buckets: [(String, [String])] = []
        for l in alive {
            let note = l.importMeta?.folder ?? l.importMeta?.context
            let k = note?.split(separator: "/").last.map { $0.trimmingCharacters(in: .whitespaces) }.flatMap { $0.isEmpty ? nil : $0 } ?? l.domain
            if let i = buckets.firstIndex(where: { $0.0 == k }) { buckets[i].1.append(l.id) } else { buckets.append((k, [l.id])) }
        }
        let avoid = priorities.avoid.lowercased()
        let groups = buckets.filter { $0.1.count >= 3 && (avoid.isEmpty || !$0.0.lowercased().contains(avoid)) }
            .sorted { $0.1.count > $1.1.count }
        let colors = ["#FF5A1F", "#D6F24B", "#7C8CFF", "#9AA3AD", "#E0855A"]
        var results: [GroupedResult] = []
        for (n, g) in groups.enumerated() {
            let reasoning = "Grouped because \(g.1.count) links came from the same place."
            let name = g.0.prefix(1).uppercased() + g.0.dropFirst()
            let c = LinkCollection(id: UUID().uuidString, name: name, color: colors[n % colors.count], reasoning: reasoning, createdBy: "system")
            collections.append(c)
            for i in links.indices where g.1.contains(links[i].id) { links[i].collectionId = c.id }
            results.append(GroupedResult(collection: c, linkIds: g.1, reasoning: reasoning))
        }
        return results
    }

    public nonisolated func logSignal(_ signal: Signal) async {}

    public func deleteAccount() async throws {
        try maybeThrow()
        links = []; trashed = []; collections = []
    }
}
