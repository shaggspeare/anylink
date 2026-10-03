import Foundation
import Observation
import Models
import Networking

/// The Add sheet's crawl session and draft. Principle 3: a field the user edited is never overwritten by the crawl.
@MainActor @Observable
public final class AddLinkModel {
    public enum Phase: Equatable, Sendable { case idle, crawling, ready, failed }
    public enum Field: Hashable, Sendable { case title, excerpt, tags }
    public typealias Crawl = @Sendable (URL) async -> AsyncThrowingStream<CrawlEvent, Error>

    public private(set) var phase: Phase = .idle
    /// fetch = 0, parse = 1, tags = 2, done = 3.
    public private(set) var step = 0
    public private(set) var url: URL?
    public private(set) var result: CrawlResult?
    public private(set) var failure: CrawlFailure?
    public private(set) var isDone = false
    public private(set) var isSaving = false
    public private(set) var edited: Set<Field> = []
    public var collectionID: LinkCollection.ID
    public var note = ""

    private var _title = ""
    private var _excerpt = ""
    private var _tags: [String] = []

    public var title: String {
        get { _title }
        set { _title = newValue; edited.insert(.title) }
    }
    public var excerpt: String {
        get { _excerpt }
        set { _excerpt = newValue; edited.insert(.excerpt) }
    }
    public var tags: [String] { _tags }

    @ObservationIgnored let store: LibraryStore
    @ObservationIgnored let crawl: Crawl
    @ObservationIgnored private var task: Task<Void, Never>?

    public init(store: LibraryStore, collectionID: LinkCollection.ID? = nil, crawl: Crawl? = nil) {
        self.store = store
        self.collectionID = collectionID ?? store.inboxID
        self.crawl = crawl ?? store.crawl
    }

    // MARK: - Derived

    public var domain: String? {
        result?.domain ?? failure?.domain ?? url?.host().map { $0.hasPrefix("www.") ? String($0.dropFirst(4)) : $0 }
    }
    /// Between `preview` and `done` the AI pass is still improving the text.
    public var isRefining: Bool { phase == .ready && !isDone }
    public var isExcerptOnly: Bool { result?.excerptOnly == true }

    /// Crawler tags not chosen, plus library tags mentioned in the title, excerpt or domain. Max 8.
    public var suggestedTags: [String] {
        let chosen = Set(_tags)
        let haystack = "\(_title) \(_excerpt) \(domain ?? "")".lowercased()
        let mentioned = store.tagsByUse.filter { haystack.contains($0.lowercased()) }
        var seen = chosen
        return ((result?.suggestedTags ?? []) + mentioned).filter { seen.insert($0).inserted }.prefix(8).map { $0 }
    }

    public var suggestedCollection: LinkCollection? {
        guard phase == .ready, let domain else { return nil }
        return store.suggestedCollection(tags: _tags, domain: domain)
    }

    // MARK: - Intents

    /// Accepts input without a scheme. Only http(s) URLs with a dotted host.
    public static func normalize(_ raw: String) -> URL? {
        var s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !s.isEmpty, !s.contains(" ") else { return nil }
        if !s.contains("://") { s = "https://" + s }
        guard let u = URL(string: s), let scheme = u.scheme?.lowercased(), scheme == "http" || scheme == "https",
              let host = u.host(), host.contains("."), !host.hasPrefix("."), !host.hasSuffix(".") else { return nil }
        return u
    }

    /// Starts reading `raw`. Returns false when it isn't a link.
    @discardableResult
    public func start(_ raw: String) -> Bool {
        guard let u = Self.normalize(raw) else { return false }
        task?.cancel()
        url = u
        result = nil; failure = nil; isDone = false; step = 0
        edited = []; _title = ""; _excerpt = ""; _tags = []
        phase = .crawling
        let crawl = crawl
        task = Task { [weak self] in
            var ended = false
            do {
                for try await e in await crawl(u) {
                    guard let self, !Task.isCancelled else { return }
                    self.apply(e)
                    if case .done = e { ended = true } else if case .failed = e { ended = true }
                }
            } catch {}
            guard let self, !Task.isCancelled, !ended else { return }
            self.apply(.failed(CrawlFailure(reason: "network")))
        }
        return true
    }

    public func apply(_ e: CrawlEvent) {
        switch e {
        case .step(let s):
            step = max(step, ["fetch": 0, "parse": 1, "tags": 2][s] ?? step)
        case .preview(let r):
            result = r
            fill(r)
            step = max(step, 1)
            phase = .ready
        case .done(let r):
            result = r
            fill(r)
            step = 3
            isDone = true
            phase = .ready
        case .failed(let f):
            failure = f
            step = 3
            isDone = true
            phase = .failed
            if !edited.contains(.title) { _title = f.suggestedTitle ?? Self.guessTitle(from: url) }
        }
    }

    private func fill(_ r: CrawlResult) {
        if !edited.contains(.title) { _title = r.title }
        if !edited.contains(.excerpt) { _excerpt = r.excerpt }
        if !edited.contains(.tags) { _tags = r.suggestedTags }
    }

    public func addTag(_ t: String) {
        let t = (t.hasPrefix("#") ? String(t.dropFirst()) : t).trimmingCharacters(in: .whitespaces).lowercased()
        guard !t.isEmpty, !_tags.contains(t) else { return }
        _tags.append(t)
        edited.insert(.tags)
    }

    public func removeTag(_ t: String) {
        _tags.removeAll { $0 == t }
        edited.insert(.tags)
    }

    /// Stops the network task (sheet closed or cancelled).
    public func cancel() {
        task?.cancel()
        task = nil
    }

    /// Saves what is known so far. Mid-crawl saves say so in the toast.
    @discardableResult
    public func save() async -> LinkItem? {
        guard let url, !isSaving else { return nil }
        isSaving = true
        defer { isSaving = false }
        let midCrawl = !isDone
        // BACKEND: mid-crawl enrichment (05 § Gaps). With no title/excerpt PATCH endpoint the app can't finish it
        // after saving, so the stream stops here and the link keeps what was known.
        cancel()
        let draft = LinkDraft(
            url: result?.canonicalUrl ?? url.absoluteString,
            title: _title.isEmpty ? nil : _title,
            excerpt: _excerpt.isEmpty ? nil : _excerpt,
            collectionId: collectionID,
            tags: _tags,
            note: note.isEmpty ? nil : note,
            crawl: result
        )
        return await store.save(draft, stillReading: midCrawl)
    }

    /// "/2026/09/designing-tab-bars-ios-26/" → "Designing tab bars ios 26"; falls back to the host.
    public static func guessTitle(from url: URL?) -> String {
        guard let url else { return "" }
        let slug = url.pathComponents.last { $0 != "/" && !$0.isEmpty && Int($0) == nil } ?? ""
        let words = (slug as NSString).deletingPathExtension
            .replacingOccurrences(of: "-", with: " ")
            .replacingOccurrences(of: "_", with: " ")
            .trimmingCharacters(in: .whitespaces)
        guard let first = words.first else { return url.host() ?? url.absoluteString }
        return first.uppercased() + words.dropFirst()
    }
}
