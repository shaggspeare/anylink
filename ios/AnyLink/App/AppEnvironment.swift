import Foundation
import Models
import Networking
import Fixtures
import Store

@MainActor
struct AppEnvironment {
    let store: LibraryStore
    let router: Router
    let clipboard: ClipboardWatcher

    init(api: any AnyLinkAPI, snapshot: LibrarySnapshot? = nil) {
        store = LibraryStore(api: api, snapshot: snapshot)
        router = Router()
        clipboard = ClipboardWatcher(store: store)
    }

    static func mock(latency: Bool = true) -> AppEnvironment {
        AppEnvironment(api: MockAPI.fixtures(latency: latency), snapshot: Fixtures.library)
    }

    /// LiveAPI lands in phase 5 (crawl) and phase 11 (everything else); until then live == mock.
    static func live() -> AppEnvironment { mock() }

    static func current() -> AppEnvironment {
        FeatureFlags.useLiveAPI ? live() : mock(latency: !AppConfig.isUITesting)
    }
}
