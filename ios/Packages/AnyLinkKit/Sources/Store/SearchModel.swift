import Foundation
import Observation
import Models
import QueryLanguage

/// S13. Runs on device over the store, debounced 120 ms.
@MainActor @Observable
public final class SearchModel {
    public var text = "" {
        didSet { if !tokenizing { tokenize() }; schedule() }
    }
    public var tokens: [SearchToken] = [] {
        didSet { schedule() }
    }
    public private(set) var results: [LinkItem] = []
    public private(set) var total = 0
    public private(set) var matchingCollections: [LinkCollection] = []

    public static let limit = 50
    @ObservationIgnored let store: LibraryStore
    @ObservationIgnored private var pending: Task<Void, Never>?
    @ObservationIgnored private var tokenizing = false

    public init(store: LibraryStore) { self.store = store }

    // MARK: Derived

    public var query: Query {
        let typed = Query(text)
        return Query(terms: tokens.map(\.term) + typed.terms, matchAny: typed.matchAny)
    }

    public var isEmpty: Bool { text.trimmingCharacters(in: .whitespaces).isEmpty && tokens.isEmpty }

    /// Types, Favorites, the top 3 tags and "Not #{most common tag}".
    public var suggestedTokens: [SearchToken] {
        let tags = store.topTags(3).map(\.tag)
        var terms: [Term] = [.type(.video, negated: false), .type(.article, negated: false), .type(.product, negated: false),
                             .flag(.favorite, negated: false)]
        terms += tags.map { .tag($0, negated: false) }
        if let top = tags.first { terms.append(.tag(top, negated: true)) }
        return terms.map(SearchToken.init(term:))
    }

    public func isActive(_ t: SearchToken) -> Bool { tokens.contains { $0.id == t.id } }

    public func toggle(_ t: SearchToken) {
        if isActive(t) { tokens.removeAll { $0.id == t.id } } else { tokens.append(t) }
    }

    public var recent: [LinkItem] { Array(store.live.prefix(5)) }

    // MARK: Tokenising

    /// When the text ends with a space and its last word is an operator, it becomes a token.
    private func tokenize() {
        guard text.hasSuffix(" ") else { return }
        let words = text.split(separator: " ", omittingEmptySubsequences: true)
        guard let last = words.last, let term = Query(String(last)).terms.first, !Self.isText(term) else { return }
        tokenizing = true
        defer { tokenizing = false }
        if !tokens.contains(where: { $0.term == term }) { tokens.append(SearchToken(term: term)) }
        text = words.dropLast().joined(separator: " ") + (words.count > 1 ? " " : "")
    }

    private static func isText(_ t: Term) -> Bool { if case .text = t { true } else { false } }

    // MARK: Running

    private func schedule() {
        pending?.cancel()
        pending = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(120))
            guard !Task.isCancelled else { return }
            self?.run()
        }
    }

    /// Runs now (keyboard submit, tests).
    public func run() {
        pending?.cancel()
        guard !isEmpty else { results = []; total = 0; matchingCollections = []; return }
        let all = store.links(matching: query)
        total = all.count
        results = Array(all.prefix(Self.limit))
        let words = textWords
        matchingCollections = words.isEmpty ? [] : store.collections.filter { c in
            words.contains { c.name.lowercased().contains($0) }
        }
    }

    private var textWords: [String] {
        Query(text).terms.compactMap { if case .text(let s, false) = $0 { s.lowercased() } else { nil } }
    }

    // MARK: Highlighting and snippets

    /// Ranges of the typed words in `s`, case-insensitive.
    public func highlightRanges(in s: String) -> [Range<String.Index>] {
        textWords.flatMap { w -> [Range<String.Index>] in
            var out: [Range<String.Index>] = []
            var from = s.startIndex
            while let r = s.range(of: w, options: .caseInsensitive, range: from..<s.endIndex) {
                out.append(r)
                from = r.upperBound
            }
            return out
        }
    }

    public struct Snippet: Equatable, Sendable {
        public let location: MatchLocation
        public let text: String
        public var label: String {
            switch location {
            case .summary: "In the summary"
            case .note: "In the note"
            case .article: "In the article"
            default: ""
            }
        }
    }

    /// When the match is in the summary, note or article (not the title), "…context with the match…".
    public func snippet(for link: LinkItem, radius: Int = 40) -> Snippet? {
        guard let loc = query.matchLocation(link), [.summary, .note, .article].contains(loc),
              let word = textWords.first else { return nil }
        let source: String? = switch loc {
        case .summary: link.excerpt
        case .note: link.note
        default: link.articleText?.first { $0.range(of: word, options: .caseInsensitive) != nil }
        }
        guard let source, let r = source.range(of: word, options: .caseInsensitive) else { return nil }
        let start = source.index(r.lowerBound, offsetBy: -radius, limitedBy: source.startIndex) ?? source.startIndex
        let end = source.index(r.upperBound, offsetBy: radius, limitedBy: source.endIndex) ?? source.endIndex
        let body = source[start..<end].trimmingCharacters(in: .whitespaces)
        return Snippet(location: loc, text: (start > source.startIndex ? "…" : "") + body + (end < source.endIndex ? "…" : ""))
    }

    // MARK: Save as filter

    public var defaultFilterName: String { query.string }

    @discardableResult
    public func saveAsFilter(name: String) async -> LinkCollection? {
        await store.createFilter(name: name.isEmpty ? defaultFilterName : name, query: query.string)
    }
}
