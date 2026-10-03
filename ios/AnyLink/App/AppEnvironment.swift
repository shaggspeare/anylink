import Foundation
import Models
import Networking
import Fixtures
import Persistence
import Store

@MainActor
struct AppEnvironment {
    let store: LibraryStore
    let router: Router
    let clipboard: ClipboardWatcher
    let reachability: Reachability
    let isLive: Bool

    init(api: any AnyLinkAPI, snapshot: LibrarySnapshot? = nil, cache: LocalCache? = nil, isLive: Bool = false) {
        // /api/crawl already exists (and doesn't check the token yet), so crawl live whenever a base URL is set.
        let live = AppConfig.isUITesting ? nil : AppConfig.apiBase.map { LiveCrawler(base: $0, token: AppConfig.apiToken) }
        let crawl: (@Sendable (URL) async -> AsyncThrowingStream<CrawlEvent, Error>)? = live.map { c in { @Sendable url in c.crawl(url) } }
        store = LibraryStore(api: api, snapshot: snapshot, crawl: crawl, cache: cache)
        router = Router()
        clipboard = ClipboardWatcher(store: store)
        reachability = Reachability(store: store)
        self.isLive = isLive
        // A 401 (after the token can't be refreshed) signs out to Welcome.
        store.onUnauthorized = { UserDefaults.standard.set(false, forKey: "signedIn") }
    }

    static func mock(latency: Bool = true) -> AppEnvironment {
        AppEnvironment(api: MockAPI.fixtures(latency: latency), snapshot: Fixtures.library)
    }

    /// The backend at `ANYLINK_API_BASE` with the shared `API_TOKEN` (`05` §3). The App Group cache shows the
    /// last library at once; `refresh()` then syncs.
    // BACKEND: per-user Supabase JWTs replace the shared token once the API verifies them (`05` §3 Plan).
    static func live() -> AppEnvironment {
        guard let base = AppConfig.apiBase else { return mock() }
        let token = AppConfig.apiToken
        return AppEnvironment(api: LiveAPI(base: base) { token }, cache: LocalCache.appGroup(), isLive: true)
    }

    static func current() -> AppEnvironment {
        FeatureFlags.useLiveAPI ? live() : mock(latency: !AppConfig.isUITesting)
    }
}
