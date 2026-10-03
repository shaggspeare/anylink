import Foundation
import Observation
import Models
import QueryLanguage

public enum AppTab: Hashable, Sendable { case library, collections, search }

public enum Route: Hashable, Sendable {
    case link(LinkItem.ID)
    case collection(LinkCollection.ID)
    case filter(Query, title: String)
    case triage
    case trash
    case settings

    /// Screens with their own bottom toolbar (or none) hide the tab bar and the accessory.
    public var hidesTabBar: Bool {
        switch self {
        case .link, .triage, .settings: true
        default: false
        }
    }
}

public enum SheetRoute: Hashable, Identifiable, Sendable {
    case addLink(prefill: URL?, collectionID: LinkCollection.ID? = nil)
    case moveLinks(Set<LinkItem.ID>)
    case tagLinks(Set<LinkItem.ID>)
    case newCollection
    case rename(LinkCollection.ID)
    public var id: Self { self }
}

public enum Confirm: Hashable, Identifiable, Sendable {
    case trash(Set<LinkItem.ID>)
    case dissolve(LinkCollection.ID)
    case emptyTrash(count: Int)
    case deleteForever(Set<LinkItem.ID>)
    case deleteAccount
    public var id: Self { self }
}

@MainActor @Observable
public final class Router {
    public var tab: AppTab = .library
    public var library: [Route] = []
    public var collections: [Route] = []
    public var search: [Route] = []
    public var sheet: SheetRoute?
    public var confirm: Confirm?
    /// Set to open a link's original; RootView presents it per the "Open links in" setting.
    public var openOriginal: URL?
    public var isSelecting = false { didSet { if !isSelecting { selection = [] } } }
    public var selection: Set<LinkItem.ID> = []
    /// Bumped when the user taps the active tab while already at its root; roots scroll to top on change.
    public private(set) var scrollToTop: [AppTab: Int] = [:]

    public init() {}

    public func path(_ t: AppTab) -> [Route] {
        switch t {
        case .library: library
        case .collections: collections
        case .search: search
        }
    }

    public func setPath(_ t: AppTab, _ p: [Route]) {
        switch t {
        case .library: library = p
        case .collections: collections = p
        case .search: search = p
        }
    }

    /// Tab bar selection: tapping the active tab pops to root, tapping it again scrolls to top.
    public func select(_ t: AppTab) {
        if t == tab {
            if path(t).isEmpty { scrollToTop[t, default: 0] += 1 } else { setPath(t, []) }
        }
        tab = t
    }

    public func open(_ r: Route) { setPath(tab, path(tab) + [r]) }

    public func beginSelecting(with id: LinkItem.ID? = nil) {
        isSelecting = true
        selection = id.map { [$0] } ?? []
    }

    public func toggleSelection(_ id: LinkItem.ID) {
        if selection.contains(id) { selection.remove(id) } else { selection.insert(id) }
    }

    public var showsAccessory: Bool { !isSelecting && !(path(tab).last?.hidesTabBar ?? false) }

    /// `anylink://add?url=…` and `anylink://link/{id}`, plus universal `https://<web>/links/{id}`.
    @discardableResult
    public func handle(_ url: URL) -> Bool {
        let parts = url.pathComponents.filter { $0 != "/" }
        if url.scheme == "anylink", url.host() == "add" {
            let raw = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first { $0.name == "url" }?.value
            sheet = .addLink(prefill: raw.flatMap(URL.init(string:)))
            return true
        }
        let id: String? = url.scheme == "anylink" && url.host() == "link" ? parts.first
            : (parts.count == 2 && parts[0] == "links" ? parts[1] : nil)
        guard let id else { return false }
        sheet = nil
        tab = .library
        library = [.link(id)]
        return true
    }
}
