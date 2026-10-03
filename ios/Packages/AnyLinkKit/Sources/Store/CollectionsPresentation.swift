import Foundation
import Models
import QueryLanguage

/// S10 filter chips. Each opens `Route.filter`.
public enum BuiltInFilter: String, CaseIterable, Identifiable, Sendable {
    case favorites, videos, products, noted, untagged, broken, duplicates
    public var id: Self { self }

    public var title: String {
        switch self {
        case .favorites: "Favorites"
        case .videos: "Videos"
        case .products: "Products"
        case .noted: "With a note"
        case .untagged: "Untagged"
        case .broken: "Broken"
        case .duplicates: "Duplicates"
        }
    }

    public var query: Query {
        switch self {
        case .favorites: Query("is:favorite")
        case .videos: Query("type:video")
        case .products: Query("type:product")
        case .noted: Query("is:noted")
        case .untagged: Query("is:untagged")
        case .broken: Query("is:broken")
        case .duplicates: Query("is:duplicate")
        }
    }

    public var systemImage: String {
        switch self {
        case .favorites: "star.fill"
        case .videos: "play.rectangle"
        case .products: "cart"
        case .noted: "note.text"
        case .untagged: "tag.slash"
        case .broken: "link.badge.plus"
        case .duplicates: "square.on.square"
        }
    }
}

public struct SuggestedFilter: Equatable, Sendable {
    public let tag: String
    public let count: Int
    public var name: String { tag.prefix(1).uppercased() + tag.dropFirst() }
    public var query: String { "#\(tag)" }
}

public struct TrashSection: Identifiable, Equatable, Sendable {
    public let title: String
    public let links: [LinkItem]
    public var id: String { title }
}

extension LibraryStore {
    public func count(_ filter: BuiltInFilter) -> Int { links(matching: filter.query).count }

    /// The most-used tag on ≥ 3 live links that isn't already a collection or filter name, and wasn't dismissed.
    public func suggestedFilter(dismissed: Set<String> = []) -> SuggestedFilter? {
        let taken = Set(collections.map { $0.name.lowercased() } + collections.compactMap { $0.smartQuery?.lowercased() })
        var counts: [String: Int] = [:]
        for l in live { for t in Set(l.tags) { counts[t, default: 0] += 1 } }
        return counts
            .filter { $0.value >= 3 && !taken.contains($0.key.lowercased()) && !taken.contains("#\($0.key.lowercased())") && !dismissed.contains($0.key) }
            .sorted { ($0.value, $1.key) > ($1.value, $0.key) }
            .first.map { SuggestedFilter(tag: $0.key, count: $0.value) }
    }

    /// Top tags by count, for the Collections tag cloud.
    public func topTags(_ n: Int = 10) -> [(tag: String, count: Int)] {
        var counts: [String: Int] = [:]
        for l in live { for t in l.tags { counts[t, default: 0] += 1 } }
        return counts.sorted { ($0.value, $1.key) > ($1.value, $0.key) }.prefix(n).map { ($0.key, $0.value) }
    }

    /// Tags used inside one collection, most used first.
    public func tags(in id: LinkCollection.ID) -> [String] {
        var counts: [String: Int] = [:]
        for l in links(in: id) { for t in l.tags { counts[t, default: 0] += 1 } }
        return counts.keys.sorted { (counts[$0]!, $1) > (counts[$1]!, $0) }
    }

    public var customFilters: [LinkCollection] { collections.filter { $0.isSmart == true } }
    public var userCollections: [LinkCollection] { collections.filter { $0.isSmart != true && $0.isInbox != true } }

    /// Trash grouped by deletion day: Today · Yesterday · weekday (this week) · date; unknown dates last as "Earlier".
    // BACKEND: the API doesn't return `deletedAt`, so only links trashed on this device in this session are dated.
    public func trashSections(now: Date = .now, calendar: Calendar = .current) -> [TrashSection] {
        let today = calendar.startOfDay(for: now)
        func title(_ d: Date?) -> String {
            guard let d else { return "Earlier" }
            let day = calendar.startOfDay(for: d)
            let days = calendar.dateComponents([.day], from: day, to: today).day ?? 0
            switch days {
            case ...0: return "Today"
            case 1: return "Yesterday"
            case 2..<7: return d.formatted(.dateTime.weekday(.wide))
            default: return d.formatted(date: .abbreviated, time: .omitted)
            }
        }
        let sorted = trash.sorted { (trashedAt[$0.id] ?? .distantPast) > (trashedAt[$1.id] ?? .distantPast) }
        var sections: [(String, [LinkItem])] = []
        for l in sorted {
            let t = title(trashedAt[l.id])
            if sections.last?.0 == t { sections[sections.count - 1].1.append(l) } else { sections.append((t, [l])) }
        }
        return sections.map { TrashSection(title: $0.0, links: $0.1) }
    }
}
