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
        // /api/crawl already exists (and doesn't check the token yet), so crawl live whenever a base URL is set.
        let live = AppConfig.isUITesting ? nil : AppConfig.apiBase.map { LiveCrawler(base: $0, token: AppConfig.apiToken) }
        let crawl: (@Sendable (URL) async -> AsyncThrowingStream<CrawlEvent, Error>)? = live.map { c in { @Sendable url in c.crawl(url) } }
        store = LibraryStore(api: api, snapshot: snapshot, crawl: crawl)
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
