import Foundation
import Models

/// What the server does to a library, done on the device: `MockAPI` runs on it, and so does a local library
/// (`LocalAPI`, which has no server to do it).
public enum LibraryRules {
    /// New inbox links for the items whose URL isn't in `existing` yet. Case and trailing slashes don't make a new URL;
    /// the first of two items wins.
    public static func imported(_ items: [ImportItem], existing: [LinkItem], inbox: LinkCollection.ID) -> [LinkItem] {
        func key(_ u: String) -> String { var k = u.lowercased(); while k.hasSuffix("/") { k.removeLast() }; return k }
        var seen = Set(existing.map { key($0.url) })
        let tints = ["#FF5A1F", "#7C8CFF", "#D6F24B", "#9AA3AD", "#17181B", "#E0855A"]
        return items.filter { seen.insert(key($0.url)).inserted }.map { item in
            let host = URL(string: item.url)?.host() ?? item.url
            let domain = host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
            let tint = tints[Int(domain.unicodeScalars.reduce(UInt32(5)) { ($0 &* 33) &+ $1.value } % UInt32(tints.count))]
            return LinkItem(
                id: UUID().uuidString, url: item.url, domain: domain, title: item.title, excerpt: "",
                tint: tint, stripe: tint == "#17181B" || tint == "#7C8CFF" ? "#FFFFFF" : "#17181B",
                initial: String(domain.prefix(1)).uppercased(),
                contentType: domain.contains("youtube") ? .video : .article,
                collectionId: inbox, tags: [], size: .M, status: .ready,
                createdAt: item.meta.savedAt ?? Date().formatted(.iso8601),
                source: item.source, importMeta: item.meta
            )
        }
    }

    /// Port of the web `groupByMetadata` fallback: deepest folder (or Telegram context), else domain; groups of 3+.
    /// Dead links stay out. Each result's collection is new, for the caller to add.
    public static func metadataGroups(_ inbox: [LinkItem], priorities: GroupingPriorities) -> [GroupedResult] {
        var buckets: [(String, [String])] = []
        for l in inbox where !l.isBroken {
            let note = l.importMeta?.folder ?? l.importMeta?.context
            let k = note?.split(separator: "/").last.map { $0.trimmingCharacters(in: .whitespaces) }.flatMap { $0.isEmpty ? nil : $0 } ?? l.domain
            if let i = buckets.firstIndex(where: { $0.0 == k }) { buckets[i].1.append(l.id) } else { buckets.append((k, [l.id])) }
        }
        let avoid = priorities.avoid.lowercased()
        let groups = buckets.filter { $0.1.count >= 3 && (avoid.isEmpty || !$0.0.lowercased().contains(avoid)) }
            .sorted { $0.1.count > $1.1.count }
        let colors = ["#FF5A1F", "#D6F24B", "#7C8CFF", "#9AA3AD", "#E0855A"]
        return groups.enumerated().map { n, g in
            let reasoning = "Grouped because \(g.1.count) links came from the same place."
            let name = g.0.prefix(1).uppercased() + g.0.dropFirst()
            let c = LinkCollection(id: UUID().uuidString, name: name, color: colors[n % colors.count], reasoning: reasoning, createdBy: "system")
            return GroupedResult(collection: c, linkIds: g.1, reasoning: reasoning)
        }
    }

    /// A viewer's Save from a shared collection: `linkIds` as copies in the inbox, or nil for all of it as copies in a
    /// new collection named after it. Copies keep nothing of the owner's but the page.
    public static func copies(of shared: SharedCollection, linkIds: [LinkItem.ID]?, inbox: LinkCollection.ID) -> SavedFromShare {
        let made = linkIds == nil
            ? LinkCollection(id: UUID().uuidString, name: shared.name, color: shared.color, createdBy: "user", icon: shared.icon)
            : nil
        let copies = shared.links.filter { linkIds?.contains($0.id) ?? true }.map { l in
            LinkItem(id: UUID().uuidString, url: l.url, domain: l.domain, title: l.title, excerpt: l.excerpt,
                     heroImage: l.heroImage, tint: l.tint, stripe: l.stripe, initial: l.initial, contentType: l.contentType,
                     readingTimeMinutes: l.readingTimeMinutes, collectionId: made?.id ?? inbox, tags: [], size: l.size,
                     status: .ready, createdAt: Date().formatted(.iso8601), source: "shared", product: l.product)
        }
        return SavedFromShare(links: copies, collection: made)
    }

    /// A note's card: the text is the note, its first line the title.
    public static func note(_ text: String, collectionId: LinkCollection.ID) -> LinkItem {
        LinkItem(
            id: UUID().uuidString, url: "", domain: "", title: noteTitle(text), excerpt: text,
            tint: "#D6F24B", stripe: "#17181B", initial: "✎", contentType: .note,
            collectionId: collectionId, tags: [], size: .M, status: .ready,
            createdAt: Date().formatted(.iso8601), source: "ios"
        )
    }

    /// An image's card; the picture itself is stored apart from it.
    public static func image(caption: String?, collectionId: LinkCollection.ID) -> LinkItem {
        LinkItem(
            id: UUID().uuidString, url: "", domain: "", title: caption.flatMap { $0.isEmpty ? nil : $0 } ?? "Image", excerpt: "",
            tint: "#17181B", stripe: "#FFFFFF", initial: "▣", contentType: .image,
            collectionId: collectionId, tags: [], size: .M, status: .ready,
            createdAt: Date().formatted(.iso8601), source: "ios"
        )
    }
}
