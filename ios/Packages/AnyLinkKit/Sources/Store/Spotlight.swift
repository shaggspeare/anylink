import Foundation
import CoreSpotlight
import UniformTypeIdentifiers
import Models

/// Core Spotlight for live links: title, summary and domain; deleted on trash/purge (the full set is replaced).
public enum Spotlight {
    public static let domain = "links"

    public static func item(for l: LinkItem) -> CSSearchableItem {
        let a = CSSearchableItemAttributeSet(contentType: .url)
        a.title = l.title
        a.contentDescription = l.excerpt.isEmpty ? l.domain : l.excerpt
        a.displayName = l.title
        a.keywords = [l.domain] + l.tags
        a.url = URL(string: l.url)
        return CSSearchableItem(uniqueIdentifier: l.id, domainIdentifier: domain, attributeSet: a)
    }

    /// Replaces the index with the live library. Cheap enough to run after each sync and on backgrounding.
    public static func reindex(_ links: [LinkItem]) async {
        let index = CSSearchableIndex.default()
        try? await index.deleteSearchableItems(withDomainIdentifiers: [domain])
        guard !links.isEmpty else { return }
        try? await index.indexSearchableItems(links.prefix(5000).map(item(for:)))
    }

    /// The link id from a Spotlight continuation activity.
    public static func linkID(from activity: NSUserActivity) -> LinkItem.ID? {
        guard activity.activityType == CSSearchableItemActionType else { return nil }
        return activity.userInfo?[CSSearchableItemActivityIdentifier] as? String
    }
}
