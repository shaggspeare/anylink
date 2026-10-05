import Foundation
import Models

// MARK: - Types

public enum Field: String, Hashable, Sendable { case title, excerpt, note, link, type, `is`, created }
public enum Flag: String, Hashable, Sendable { case favorite, noted, untagged, duplicate, broken, archived }
public enum DateComparison: Hashable, Sendable { case eq, gt, lt }
public enum MatchLocation: Hashable, Sendable { case title, summary, note, article, tags, domain }

public enum Term: Hashable, Sendable {
    case text(String, negated: Bool)
    case tag(String, negated: Bool)
    case field(Field, String, negated: Bool)
    case type(ContentType, negated: Bool)
    case flag(Flag, negated: Bool)
    case created(DateComparison, String, negated: Bool)
}

// MARK: - Query

public struct Query: Hashable, Sendable {
    public var terms: [Term]
    public var matchAny: Bool

    public init(_ string: String) {
        var terms: [Term] = []
        var matchAny = false
        let tokens = Query.tokenize(string)
        for token in tokens {
            if token == "match:or" { matchAny = true; continue }
            var t = token
            let negated = t.hasPrefix("-")
            if negated { t = String(t.dropFirst()) }
            if t.isEmpty { continue }

            if t.hasPrefix("#") {
                let tag = String(t.dropFirst())
                if !tag.isEmpty { terms.append(.tag(tag, negated: negated)) }
                continue
            }

            if let colonIdx = t.firstIndex(of: ":"), colonIdx != t.startIndex {
                let fieldStr = String(t[..<colonIdx]).lowercased()
                let value = String(t[t.index(after: colonIdx)...])

                if let field = Field(rawValue: fieldStr) {
                    switch field {
                    case .type:
                        if let ct = ContentType(rawValue: value.lowercased()) {
                            terms.append(.type(ct, negated: negated)); continue
                        }
                    case .is:
                        if let flag = Flag(rawValue: value.lowercased()) {
                            terms.append(.flag(flag, negated: negated)); continue
                        }
                    case .created:
                        if value.hasPrefix(">") {
                            terms.append(.created(.gt, String(value.dropFirst()), negated: negated)); continue
                        } else if value.hasPrefix("<") {
                            terms.append(.created(.lt, String(value.dropFirst()), negated: negated)); continue
                        } else {
                            terms.append(.created(.eq, value, negated: negated)); continue
                        }
                    case .title, .excerpt, .note, .link:
                        terms.append(.field(field, value, negated: negated)); continue
                    }
                }
            }

            terms.append(.text(t, negated: negated))
        }
        self.terms = terms
        self.matchAny = matchAny
    }

    public init(terms: [Term] = [], matchAny: Bool = false) {
        self.terms = terms; self.matchAny = matchAny
    }

    // MARK: - Serialisation

    public var string: String {
        var parts: [String] = []
        if matchAny { parts.append("match:or") }
        for term in terms {
            parts.append(term.serialized)
        }
        return parts.joined(separator: " ")
    }

    // MARK: - Tokenizer

    private static func tokenize(_ input: String) -> [String] {
        var tokens: [String] = []
        var current = ""
        var inQuote = false
        var i = input.startIndex

        while i < input.endIndex {
            let ch = input[i]
            if ch == "\"" {
                if inQuote {
                    inQuote = false
                    if !current.isEmpty { tokens.append(current); current = "" }
                } else {
                    if !current.isEmpty { tokens.append(current); current = "" }
                    inQuote = true
                }
            } else if ch == " " && !inQuote {
                if !current.isEmpty { tokens.append(current); current = "" }
            } else {
                current.append(ch)
            }
            i = input.index(after: i)
        }
        if !current.isEmpty { tokens.append(current) }
        return tokens
    }

    // MARK: - Matching

    public func matches(_ link: LinkItem, in index: LibraryIndex) -> Bool {
        if link.deleted == true { return false }
        let hasArchived = terms.contains { if case .flag(.archived, false) = $0 { return true }; return false }
        if !hasArchived && link.archived == true { return false }

        if terms.isEmpty { return true }

        let positives = terms.filter { !$0.isNegated }
        let negatives = terms.filter { $0.isNegated }

        for neg in negatives {
            if termMatches(neg.withoutNegation, link: link, index: index) { return false }
        }

        if positives.isEmpty { return true }

        if matchAny {
            return positives.contains { termMatches($0, link: link, index: index) }
        } else {
            return positives.allSatisfy { termMatches($0, link: link, index: index) }
        }
    }

    public func matchLocation(_ link: LinkItem) -> MatchLocation? {
        for term in terms {
            switch term {
            case .text(let s, _):
                let low = s.lowercased()
                if link.title.lowercased().contains(low) { return .title }
                if link.excerpt.lowercased().contains(low) { return .summary }
                if let n = link.note, n.lowercased().contains(low) { return .note }
                if link.articleText?.contains(where: { $0.lowercased().contains(low) }) == true { return .article }
                if link.tags.contains(where: { $0.lowercased().contains(low) }) { return .tags }
                if link.domain.lowercased().contains(low) || link.url.lowercased().contains(low) { return .domain }
            case .field(.title, _, _): return .title
            case .field(.excerpt, _, _): return .summary
            case .field(.note, _, _): return .note
            case .field(.link, _, _): return .domain
            case .tag: return .tags
            default: break
            }
        }
        return nil
    }

    private func termMatches(_ term: Term, link: LinkItem, index: LibraryIndex) -> Bool {
        let hay = index.haystack(for: link.id)
        switch term {
        case .text(let s, _):
            let low = s.lowercased()
            return hay.contains(low)
        case .tag(let t, _):
            let low = t.lowercased()
            return link.tags.contains { $0.lowercased().hasPrefix(low) }
        case .field(let f, let v, _):
            let low = v.lowercased()
            switch f {
            case .title: return link.title.lowercased().contains(low)
            case .excerpt: return link.excerpt.lowercased().contains(low)
            case .note: return (link.note ?? "").lowercased().contains(low)
            case .link: return link.domain.lowercased().contains(low) || link.url.lowercased().contains(low)
            default: return false
            }
        case .type(let ct, _):
            return link.contentType == ct
        case .flag(let flag, _):
            switch flag {
            case .favorite: return link.favorite == true
            case .noted: return link.hasNote
            case .untagged: return link.tags.isEmpty
            case .duplicate: return index.isDuplicate(link.id)
            case .broken: return link.isBroken
            case .archived: return link.archived == true
            }
        case .created(let cmp, let val, _):
            switch cmp {
            case .eq: return link.createdAt.hasPrefix(val)
            case .gt: return link.createdAt > val
            case .lt: return link.createdAt < val
            }
        }
    }
}

// MARK: - Term helpers

extension Term {
    var isNegated: Bool {
        switch self {
        case .text(_, let n), .tag(_, let n), .field(_, _, let n),
             .type(_, let n), .flag(_, let n), .created(_, _, let n): return n
        }
    }

    var withoutNegation: Term {
        switch self {
        case .text(let s, _): return .text(s, negated: false)
        case .tag(let s, _): return .tag(s, negated: false)
        case .field(let f, let s, _): return .field(f, s, negated: false)
        case .type(let ct, _): return .type(ct, negated: false)
        case .flag(let f, _): return .flag(f, negated: false)
        case .created(let c, let s, _): return .created(c, s, negated: false)
        }
    }

    public var serialized: String {
        let prefix = isNegated ? "-" : ""
        switch self {
        case .text(let s, _):
            return s.contains(" ") ? "\(prefix)\"\(s)\"" : "\(prefix)\(s)"
        case .tag(let s, _):
            return "\(prefix)#\(s)"
        case .field(let f, let v, _):
            return "\(prefix)\(f.rawValue):\(v)"
        case .type(let ct, _):
            return "\(prefix)type:\(ct.rawValue)"
        case .flag(let f, _):
            return "\(prefix)is:\(f.rawValue)"
        case .created(let cmp, let v, _):
            switch cmp {
            case .eq: return "\(prefix)created:\(v)"
            case .gt: return "\(prefix)created:>\(v)"
            case .lt: return "\(prefix)created:<\(v)"
            }
        }
    }
}

// MARK: - LibraryIndex

public struct LibraryIndex: Sendable {
    private let haystacks: [String: String]
    private let duplicateIDs: Set<String>

    public init(links: [LinkItem]) {
        var hay: [String: String] = [:]
        var urlMap: [String: [String]] = [:]

        for link in links {
            if link.deleted == true { continue }
            let parts = [
                link.title, link.excerpt, link.domain, link.url,
                link.note ?? "",
                link.tags.joined(separator: " "),
                (link.articleText ?? []).joined(separator: " ")
            ]
            hay[link.id] = parts.joined(separator: "\n").lowercased()

            // Notes have no URL; an empty key would make every note a duplicate of every other.
            if !link.url.isEmpty { urlMap[Self.normalizeURL(link.url), default: []].append(link.id) }
        }

        self.haystacks = hay
        self.duplicateIDs = Set(urlMap.values.filter { $0.count > 1 }.flatMap { $0 })
    }

    public func haystack(for id: String) -> String {
        haystacks[id] ?? ""
    }

    public func isDuplicate(_ id: String) -> Bool {
        duplicateIDs.contains(id)
    }

    private static func normalizeURL(_ url: String) -> String {
        var s = url.lowercased()
        while s.hasSuffix("/") { s = String(s.dropLast()) }
        return s
    }
}

// MARK: - SearchToken

public struct SearchToken: Identifiable, Hashable, Sendable {
    public let id: String
    public let label: String
    public let term: Term

    public init(id: String, label: String, term: Term) {
        self.id = id; self.label = label; self.term = term
    }
}

extension SearchToken {
    /// Labels per the `06` token table.
    public init(term: Term) {
        let label: String
        switch term {
        case .type(let t, let neg):
            let base = switch t { case .video: "Videos"; case .article: "Articles"; case .product: "Products"; case .note: "Notes"; case .image: "Images" }
            label = neg ? "Not \(base)" : base
        case .flag(let f, let neg):
            let base = switch f {
            case .favorite: "Favorites"; case .noted: "With a note"; case .untagged: "Untagged"
            case .broken: "Broken links"; case .duplicate: "Duplicates"; case .archived: "Archived"
            }
            label = neg ? "Not \(base)" : base
        case .tag(let t, let neg):
            label = neg ? "Not #\(t)" : "#\(t)"
        case .created(let cmp, let v, let neg):
            var text = v
            if cmp == .eq, let d = try? Date("\(v)-01T00:00:00Z", strategy: .iso8601), v.count == 7 {
                text = d.formatted(.dateTime.month(.abbreviated).year().locale(Locale(identifier: "en_US")))
            }
            let prefix = cmp == .gt ? "after " : cmp == .lt ? "before " : ""
            label = (neg ? "Not saved " : "Saved ") + prefix + text
        case .field, .text:
            label = term.serialized
        }
        self.init(id: term.serialized, label: label, term: term)
    }

    public static let suggestions: [SearchToken] = [
        SearchToken(id: "type:video", label: "Videos", term: .type(.video, negated: false)),
        SearchToken(id: "type:article", label: "Articles", term: .type(.article, negated: false)),
        SearchToken(id: "type:product", label: "Products", term: .type(.product, negated: false)),
        SearchToken(id: "type:note", label: "Notes", term: .type(.note, negated: false)),
        SearchToken(id: "type:image", label: "Images", term: .type(.image, negated: false)),
        SearchToken(id: "is:favorite", label: "Favorites", term: .flag(.favorite, negated: false)),
        SearchToken(id: "is:noted", label: "With a note", term: .flag(.noted, negated: false)),
        SearchToken(id: "is:untagged", label: "Untagged", term: .flag(.untagged, negated: false)),
        SearchToken(id: "is:broken", label: "Broken links", term: .flag(.broken, negated: false)),
    ]

    public static func tagToken(_ tag: String, negated: Bool = false) -> SearchToken {
        let label = negated ? "Not #\(tag)" : "#\(tag)"
        let id = negated ? "-#\(tag)" : "#\(tag)"
        return SearchToken(id: id, label: label, term: .tag(tag, negated: negated))
    }

    public static func createdToken(month: String, label: String) -> SearchToken {
        SearchToken(id: "created:\(month)", label: label, term: .created(.eq, month, negated: false))
    }
}
