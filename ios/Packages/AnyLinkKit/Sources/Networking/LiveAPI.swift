import Foundation
import Models

/// The real backend: `GET /api/v1/library`, `POST /api/v1/actions/<name>` with the arguments as a JSON array,
/// plus the NDJSON streams `/api/crawl` and `/api/import/check`. See `docs/05-data-and-api.md` §2.
public struct LiveAPI: AnyLinkAPI {
    let base: URL
    let token: @Sendable () async -> String?
    let session: URLSession

    public init(base: URL, session: URLSession = .shared, token: @escaping @Sendable () async -> String?) {
        self.base = base; self.session = session; self.token = token
    }

    // MARK: - Plumbing

    private func request(_ path: String, method: String = "POST", body: Data? = nil, timeout: TimeInterval = 30) async -> URLRequest {
        var r = URLRequest(url: base.appending(path: path), timeoutInterval: timeout)
        r.httpMethod = method
        if let body {
            r.httpBody = body
            r.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if let t = await token() { r.setValue("Bearer \(t)", forHTTPHeaderField: "Authorization") }
        return r
    }

    static func map(_ error: Error) -> AppError {
        if let e = error as? AppError { return e }
        if let u = error as? URLError {
            switch u.code {
            case .notConnectedToInternet, .networkConnectionLost, .timedOut, .cannotConnectToHost,
                 .cannotFindHost, .dataNotAllowed, .internationalRoamingOff:
                return .offline
            default: return .unknown
            }
        }
        if error is DecodingError { return .decoding }
        return .unknown
    }

    static func check(_ response: URLResponse) throws {
        guard let code = (response as? HTTPURLResponse)?.statusCode else { return }
        switch code {
        case 200..<300: return
        case 401: throw AppError.unauthorized
        case 404: throw AppError.notFound
        default: throw AppError.server(code)
        }
    }

    private func send(_ r: URLRequest) async throws -> Data {
        do {
            let (data, response) = try await session.data(for: r)
            try Self.check(response)
            return data
        } catch {
            throw Self.map(error)
        }
    }

    /// `POST /api/v1/actions/<name>` with `args` as a JSON array.
    func action(_ name: String, _ args: [any Encodable]) async throws -> Data {
        let enc = JSONEncoder()
        let parts = try args.map { String(decoding: try enc.encode($0), as: UTF8.self) }
        return try await send(await request("api/v1/actions/\(name)", body: Data("[\(parts.joined(separator: ","))]".utf8)))
    }

    func action<T: Decodable>(_ name: String, _ args: [any Encodable], as: T.Type) async throws -> T {
        let data = try await action(name, args)
        do { return try JSONDecoder().decode(T.self, from: data) } catch { throw AppError.decoding }
    }

    // MARK: - Streams

    public func crawl(_ url: URL) async -> AsyncThrowingStream<CrawlEvent, Error> {
        LiveCrawler(base: base, token: await token(), session: session).crawl(url)
    }

    public func checkImportedLinks() async -> AsyncThrowingStream<LinkCheckEvent, Error> {
        let r = await request("api/import/check", timeout: 300)
        let session = session
        let (stream, cont) = AsyncThrowingStream.makeStream(of: LinkCheckEvent.self)
        let task = Task {
            do {
                let (bytes, response) = try await session.bytes(for: r)
                try Self.check(response)
                for try await line in bytes.lines where !line.isEmpty {
                    cont.yield(try NDJSONDecoder.decodeLine(line, as: LinkCheckEvent.self))
                }
                cont.finish()
            } catch {
                cont.finish(throwing: Self.map(error))
            }
        }
        cont.onTermination = { _ in task.cancel() }
        return stream
    }

    // MARK: - Library and links

    public func library(since: Date?) async throws -> LibrarySnapshot {
        let data = try await send(await request("api/v1/library", method: "GET"))
        do { return try JSONDecoder().decode(LibrarySnapshot.self, from: data) } catch { throw AppError.decoding }
    }

    /// `createLink` input, built from the crawl like the web's `handleSave` (`05` §2).
    struct NewLink: Encodable {
        let url, domain, title, excerpt, tint, stripe, initial, collectionId: String
        let articleText: [String]?
        let heroImage: String?
        let contentType: ContentType
        let readingTimeMinutes: Int?
        let tags: [String]
        let size: CardSize
        let note: String?
        let product: ProductDetails?
        let source: String
    }

    static func newLink(_ d: LinkDraft) -> NewLink {
        let cr = d.crawl
        let host = URL(string: d.url)?.host() ?? d.url
        let domain = cr?.domain ?? (host.hasPrefix("www.") ? String(host.dropFirst(4)) : host)
        return NewLink(
            url: cr?.canonicalUrl ?? d.url, domain: domain,
            title: d.title ?? cr?.title ?? domain, excerpt: d.excerpt ?? cr?.excerpt ?? "",
            tint: cr?.tint ?? "#9AA3AD", stripe: cr?.stripe ?? "#FFFFFF",
            initial: cr?.initial ?? String(domain.prefix(1)).uppercased(),
            collectionId: d.collectionId ?? "unsorted",
            articleText: cr?.articleText, heroImage: cr?.heroImage,
            contentType: cr?.contentType ?? .article, readingTimeMinutes: cr?.readingTimeMinutes,
            tags: d.tags, size: d.size, note: d.note, product: cr?.product, source: "ios"
        )
    }

    public func createLink(_ draft: LinkDraft) async throws -> LinkItem {
        try await action("createLink", [Self.newLink(draft)], as: LinkItem.self)
    }

    public func createNote(_ text: String, collectionId: LinkCollection.ID?) async throws -> LinkItem {
        try await action("createNote", [text, collectionId ?? "", "ios"], as: LinkItem.self)
    }

    /// Base64 in the JSON array, like every other action: one dispatcher for both clients.
    public func createImage(_ data: Data, collectionId: LinkCollection.ID?, caption: String?) async throws -> LinkItem {
        var r = await request("api/v1/actions/createImage", timeout: 120)
        let args: [String] = [data.base64EncodedString(), collectionId ?? "", caption ?? "", "ios"]
        r.httpBody = try JSONEncoder().encode(args)
        r.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body = try await send(r)
        do { return try JSONDecoder().decode(LinkItem.self, from: body) } catch { throw AppError.decoding }
    }

    public func setNoteText(_ id: LinkItem.ID, _ text: String) async throws {
        _ = try await action("setNoteText", [id, text])
    }

    /// One action per set field (`05` §2). Title/excerpt edits have no endpoint yet (BACKEND).
    public func updateLink(_ id: LinkItem.ID, _ patch: LinkPatch) async throws {
        if let n = patch.note { _ = try await action("setNote", [id, n]) }
        if let pinned = patch.pinned {
            struct PinResult: Decodable { let ok: Bool }
            let result = try await action("setPinned", [id, pinned], as: PinResult.self)
            if !result.ok { throw AppError.pinLimit }
        }
        if let f = patch.favorite { _ = try await action("setFavorite", [id, f]) }
        if let s = patch.size { _ = try await action("setLinkSize", [id, s.rawValue]) }
        if let c = patch.collectionId { _ = try await action("moveLinks", [[id], c]) }
    }

    public func bulk(_ a: BulkAction, ids: [LinkItem.ID]) async throws {
        switch a {
        case .move(let to): _ = try await action("moveLinks", [ids, to])
        case .tag(let t): _ = try await action("tagLinks", [ids, t])
        case .archive: _ = try await action("archiveLinks", [ids])
        case .trash: _ = try await action("deleteLinks", [ids])
        case .restore: _ = try await action("restoreLinks", [ids])
        case .purge: _ = try await action("purgeLinks", [ids])
        }
    }

    public func reorder(_ ids: [LinkItem.ID]) async throws { _ = try await action("reorderLinks", [ids]) }
    public func reorderCollections(_ ids: [LinkCollection.ID]) async throws { _ = try await action("reorderCollections", [ids]) }

    // MARK: - Collections

    public func createCollection(name: String, color: String) async throws -> LinkCollection {
        try await action("createCollection", [name, color], as: LinkCollection.self)
    }

    public func createFilter(name: String, query: String) async throws -> LinkCollection {
        try await action("createSmartCollection", [query, name], as: LinkCollection.self)
    }

    public func updateCollection(_ id: LinkCollection.ID, name: String) async throws {
        _ = try await action("renameCollection", [id, name])
    }

    private struct Trashed: Decodable { let trashedIds: [String] }

    public func deleteCollection(_ id: LinkCollection.ID) async throws -> [LinkItem.ID] {
        try await action("deleteCollection", [id], as: Trashed.self).trashedIds
    }

    public func deleteEmptyCollections() async throws -> [LinkCollection.ID] {
        try await action("deleteEmptyCollections", [], as: [String].self)
    }

    // MARK: - The rest

    public func addHighlight(_ id: LinkItem.ID, quote: String) async throws { _ = try await action("addHighlight", [id, quote]) }

    public func setPriceAlert(_ id: LinkItem.ID, threshold: Double, currency: String) async throws {
        _ = try await action("setAlertThreshold", [id, threshold, currency])
    }

    public func importLinks(_ items: [ImportItem]) async throws -> ImportResult {
        try await action("importLinks", [items], as: ImportResult.self)
    }

    public func groupInbox(_ priorities: GroupingPriorities) async throws -> [GroupedResult] {
        try await action("groupInbox", [priorities], as: [GroupedResult].self)
    }

    private struct SignalBody: Encodable { let linkId: String?; let linkIds: [String]?; let collectionId: String?; let payload: [String: String]? }

    public func logSignal(_ s: Signal) async {
        _ = try? await action("logSignal", [s.action, SignalBody(linkId: s.linkId, linkIds: s.linkIds, collectionId: s.collectionId, payload: s.payload)])
    }

    public func deleteAccount() async throws {
        _ = try await action("deleteAccount", [])
    }
}
