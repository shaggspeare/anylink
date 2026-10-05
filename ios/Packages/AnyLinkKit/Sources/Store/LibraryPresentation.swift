import Foundation
import Models

public enum LibraryScope: String, CaseIterable, Identifiable, Sendable {
    case all, unsorted, favorites, videos, products, articles, notes, images
    public var id: Self { self }

    public var title: String {
        switch self {
        case .all: "All"
        case .unsorted: "Unsorted"
        case .favorites: "Favorites"
        case .videos: "Videos"
        case .products: "Products"
        case .articles: "Articles"
        case .notes: "Notes"
        case .images: "Images"
        }
    }

    public func includes(_ l: LinkItem, inbox: LinkCollection.ID) -> Bool {
        switch self {
        case .all: true
        case .unsorted: l.collectionId == inbox
        case .favorites: l.favorite == true
        case .videos: l.contentType == .video
        case .products: l.contentType == .product
        case .articles: l.contentType == .article
        case .notes: l.contentType == .note
        case .images: l.contentType == .image
        }
    }
}

public enum LibrarySort: String, CaseIterable, Identifiable, Sendable {
    case newest, oldest, title, site, manual
    public var id: Self { self }

    public var title: String {
        switch self {
        case .newest: "Newest first"
        case .oldest: "Oldest first"
        case .title: "Title A–Z"
        case .site: "Site A–Z"
        case .manual: "My order"
        }
    }

    /// `links` arrive newest first (store order); sorts are stable on that.
    public func apply(_ links: [LinkItem]) -> [LinkItem] {
        let sorted: [LinkItem] = switch self {
        case .newest: links
        case .oldest: links.reversed()
        case .title: links.sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
        case .site: links.sorted { $0.domain.localizedStandardCompare($1.domain) == .orderedAscending }
        case .manual: links.enumerated().sorted { ($0.element.position ?? Int.max, $0.offset) < ($1.element.position ?? Int.max, $1.offset) }.map(\.element)
        }
        return sorted.filter { $0.pinned == true } + sorted.filter { $0.pinned != true }
    }
}

public enum LibraryLayout: String, Sendable { case tiles, rows }

public struct DateSection: Identifiable, Equatable, Sendable {
    public let title: String
    public let links: [LinkItem]
    public var id: String { title }
}

extension LibraryStore {
    public func scopeCount(_ scope: LibraryScope) -> Int {
        let inbox = inboxID
        return live.reduce(0) { $0 + (scope.includes($1, inbox: inbox) ? 1 : 0) }
    }

    public func links(in scope: LibraryScope, sortedBy sort: LibrarySort) -> [LinkItem] {
        let inbox = inboxID
        return sort.apply(live.filter { scope.includes($0, inbox: inbox) })
    }
}

public enum DateSections {
    public static func date(_ s: String) -> Date? {
        (try? Date(s, strategy: .iso8601)) ?? (try? Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(s))
    }

    /// Today · Yesterday · Earlier this week · month names (with the year when it isn't the current one).
    public static func group(_ links: [LinkItem], now: Date = .now, calendar: Calendar = .current) -> [DateSection] {
        let today = calendar.startOfDay(for: now)
        let yesterday = calendar.date(byAdding: .day, value: -1, to: today) ?? today
        let weekStart = calendar.dateInterval(of: .weekOfYear, for: now)?.start ?? today
        let thisYear = calendar.component(.year, from: now)

        func title(_ d: Date) -> String {
            if d >= today { return "Today" }
            if d >= yesterday { return "Yesterday" }
            if d >= weekStart { return "Earlier this week" }
            let style = Date.FormatStyle(calendar: calendar).month(.wide)
            return calendar.component(.year, from: d) == thisYear
                ? d.formatted(style)
                : d.formatted(style.year())
        }

        var sections: [(String, [LinkItem])] = []
        for l in links where l.pinned != true {
            let t = date(l.createdAt).map(title) ?? "Earlier"
            if sections.last?.0 == t { sections[sections.count - 1].1.append(l) } else { sections.append((t, [l])) }
        }
        let pinned = links.filter { $0.pinned == true }
        let first = pinned.isEmpty ? [] : [DateSection(title: "Pinned", links: pinned)]
        return first + sections.map { DateSection(title: $0.0, links: $0.1) }
    }
}
