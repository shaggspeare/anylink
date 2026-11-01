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

    // MARK: - Upgrade and lapse (src/lib/library-merge.ts)

    /// Query parameters that only say where a click came from: `cleanUrl`'s in src/lib/crawler/url.ts.
    static let trackingParams: Set = ["fbclid", "gclid", "gbraid", "wbraid", "msclkid", "yclid", "ttclid", "igshid", "mc_cid",
                                      "mc_eid", "_openstat", "ref_src", "si"]

    /// One page, one key, as `urlKey` on the server: tracking parameters, the scheme, a leading "www." and trailing
    /// slashes don't make a new URL. Anything that isn't a URL is its own key.
    public static func urlKey(_ raw: String) -> String {
        let raw = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard var c = URLComponents(string: raw), let host = c.host?.lowercased(), !host.isEmpty else { return raw }
        let kept = c.percentEncodedQueryItems?.filter { !$0.name.hasPrefix("utm_") && !trackingParams.contains($0.name) }
        if kept?.count != c.percentEncodedQueryItems?.count { c.percentEncodedQueryItems = kept?.isEmpty == true ? nil : kept }
        var key = host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
        if let port = c.port, port != (c.scheme?.lowercased() == "http" ? 80 : 443) { key += ":\(port)" }
        var path = c.percentEncodedPath
        while path.hasSuffix("/") { path.removeLast() }
        key += path
        if let q = c.percentEncodedQuery, !q.isEmpty { key += "?\(q)" }
        if let f = c.percentEncodedFragment, !f.isEmpty { key += "#\(f)" }
        return key
    }

    /// One link from two libraries, as `mergeLinks` on the server: `other`'s tags, highlights (by quote) and note join
    /// `base`'s, the earlier save wins, and pinned or favourite on either side stays on. Everything else is `base`'s.
    public static func merge(_ base: LinkItem, _ other: LinkItem) -> LinkItem {
        var m = base
        for t in other.tags where !m.tags.contains(t) { m.tags.append(t) }
        var highlights = base.highlights ?? []
        for h in other.highlights ?? [] where !highlights.contains(where: { $0.quote == h.quote }) { highlights.append(h) }
        if !highlights.isEmpty { m.highlights = highlights }
        m.note = mergedNote(base.note, other.note)
        if let earlier = date(other.createdAt), let later = date(base.createdAt), earlier < later { m.createdAt = other.createdAt }
        if other.pinned == true { m.pinned = true }
        if other.favorite == true { m.favorite = true }
        return m
    }

    /// Appended, unless one note already holds the other.
    static func mergedNote(_ a: String?, _ b: String?) -> String? {
        let a = a?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
        let b = b?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
        guard let b, a?.contains(b) != true else { return a }
        guard let a, !b.contains(a) else { return b }
        return a + "\n\n" + b
    }

    static func date(_ iso: String) -> Date? {
        (try? Date(iso, strategy: .iso8601)) ?? (try? Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(iso))
    }

    /// Where a collection from another library lands, as `matchCollection` on the server: a smart collection on one with
    /// the same name and query, any other on one with the same name, ignoring case. The inbox is the caller's to map.
    static func matchCollection(_ c: LinkCollection, in existing: [LinkCollection]) -> LinkCollection? {
        let name = c.name.trimmingCharacters(in: .whitespaces).lowercased()
        return existing.first { e in
            e.isInbox != true && (e.isSmart == true) == (c.isSmart == true)
                && e.name.trimmingCharacters(in: .whitespaces).lowercased() == name
                && (c.isSmart != true || (e.smartQuery ?? "") == (c.smartQuery ?? ""))
        }
    }

    /// A link with a page behind it. Notes and images have no URL to match on.
    static func isPage(_ l: LinkItem) -> Bool { !l.isNote && !l.isImage && !l.url.isEmpty }

    /// What copying `theirs` into `ours` writes, deleting nothing (CONTEXT.md: Upgrade and Lapse). Collections match by
    /// id, the inbox to `inbox`, then by name (`matchCollection`). Links match by id, by `clientId` either way, then by
    /// `urlKey`; a match merges (`merge`), keeping our id, with `theirsWin` deciding whose other fields stay. Anything
    /// else is added under its own id, in the collection it maps to. No more than two live links end up pinned. Returns
    /// only new and changed records, for the caller to upsert.
    public static func union(_ theirs: [LinkItem], collections theirCollections: [LinkCollection], into ours: [LinkItem],
                             collections ourCollections: [LinkCollection], inbox: LinkCollection.ID,
                             theirsWin: Bool) -> (links: [LinkItem], collections: [LinkCollection]) {
        var collections = ourCollections
        var added: [LinkCollection] = []
        var collectionIDs: [LinkCollection.ID: LinkCollection.ID] = [:]
        for c in theirCollections {
            if c.isInbox == true {
                collectionIDs[c.id] = inbox
            } else if let mine = collections.first(where: { $0.id == c.id }) ?? matchCollection(c, in: collections) {
                collectionIDs[c.id] = mine.id
            } else {
                var copy = c
                copy.shareToken = nil
                added.append(copy)
                collections.append(copy)
            }
        }

        var links = ours
        var byID: [String: Int] = [:]
        var byURL: [String: Int] = [:]
        func index(_ i: Int) {
            for key in [links[i].id, links[i].clientId].compactMap({ $0 }) where byID[key] == nil { byID[key] = i }
            if isPage(links[i]), byURL[urlKey(links[i].url)] == nil { byURL[urlKey(links[i].url)] = i }
        }
        links.indices.forEach(index)
        var pins = links.filter { $0.pinned == true && $0.deleted != true && $0.archived != true }.count
        var written: Set<Int> = []
        for var link in theirs {
            let filed = collectionIDs[link.collectionId] ?? link.collectionId
            link.collectionId = collections.contains { $0.id == filed } ? filed : inbox
            let found = byID[link.id] ?? link.clientId.flatMap { byID[$0] } ?? (isPage(link) ? byURL[urlKey(link.url)] : nil)
            var merged = link
            if let i = found {
                merged = theirsWin ? merge(link, links[i]) : merge(links[i], link)
                merged.id = links[i].id
            }
            if merged.pinned == true, found.map({ links[$0].pinned != true }) ?? true {
                if merged.deleted != true, merged.archived != true, pins < 2 { pins += 1 } else { merged.pinned = false }
            }
            if let i = found {
                guard merged != links[i] else { continue }
                links[i] = merged
                written.insert(i)
            } else {
                links.append(merged)
                written.insert(links.count - 1)
                index(links.count - 1)
            }
        }
        return (written.sorted().map { links[$0] }, added)
    }
}
