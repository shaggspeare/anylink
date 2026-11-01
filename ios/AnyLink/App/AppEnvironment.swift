import Foundation
import Models
import Networking
import Fixtures
import Persistence
import Store
import WidgetKit

@MainActor
struct AppEnvironment {
    let store: LibraryStore
    let router: Router
    let clipboard: ClipboardWatcher
    let reachability: Reachability
    let mode: LibraryMode
    /// Re-reads the library each time the app becomes active: a server or a local library, not the mock.
    let isLive: Bool
    /// App Group store shared with the share extension (pending saves, recent collections).
    let shared: LocalCache?
    /// A local library's store: CloudKit brings other devices' changes in through it.
    let local: LocalStore?

    init(api: any AnyLinkAPI, mode: LibraryMode = .server, snapshot: LibrarySnapshot? = nil, cache: LocalCache? = nil,
         shared: LocalCache? = nil, local: LocalStore? = nil,
         crawl: (@Sendable (URL) async -> AsyncThrowingStream<CrawlEvent, Error>)? = nil, isLive: Bool = false) {
        store = LibraryStore(api: api, snapshot: snapshot, crawl: crawl, cache: cache)
        router = Router()
        clipboard = ClipboardWatcher(store: store)
        reachability = Reachability(store: store)
        self.mode = mode
        self.isLive = isLive
        self.shared = shared
        self.local = local
        // A 401 (after the token can't be refreshed) signs out, back to the local library.
        store.onUnauthorized = { UserDefaults.standard.set(false, forKey: "signedIn") }
        // The widgets read the App Group, so only an App Group library feeds them.
        if shared != nil {
            store.onSave = { [weak store] in
                guard let summary = store?.widgetSummary, summary != WidgetSummary.load() else { return }
                summary.save()
                WidgetCenter.shared.reloadAllTimelines()
            }
        }
    }

    /// The environment for a library mode. Pro phase 5 adds the upgrade and lapse moves between them.
    static func make(_ mode: LibraryMode) -> AppEnvironment {
        switch mode {
        case .server: FeatureFlags.useLiveAPI ? live() : mock(latency: !AppConfig.isUITesting)
        case .local: local()
        }
    }

    static func mock(latency: Bool = true) -> AppEnvironment {
        let cache = LocalCache.appGroup()
        return AppEnvironment(api: MockAPI.fixtures(latency: latency), snapshot: Fixtures.library, shared: cache)
    }

    /// The backend at `ANYLINK_API_BASE`, as the signed-in Supabase user. The App Group cache shows the last
    /// library at once; `refresh()` then syncs.
    static func live() -> AppEnvironment {
        guard let base = AppConfig.apiBase else { return mock() }
        let cache = LocalCache.appGroup()
        return AppEnvironment(api: LiveAPI(base: base) { await AuthService.accessToken() }, cache: cache, shared: cache, isLive: true)
    }

    /// A free library on this device (ADR 0002): `LocalAPI` over `Local.store`, synced through the user's iCloud.
    /// Pages are read by the server's crawler and imports checked and grouped there, signed with App Attest. Without a
    /// backend, and under -ui-testing (in memory), MockAPI's recorded streams read them.
    static func local() -> AppEnvironment {
        let testing = AppConfig.isUITesting
        let base = testing ? nil : AppConfig.apiBase
        // ponytail: falls back to memory if the store won't open, so the app still runs; nothing seen so far opens it badly.
        let store = (testing ? nil : LocalStore.appGroup()) ?? (try? LocalStore())
        guard let store else { return mock() }
        let crawler: LocalAPI.Crawl
        if let base {
            let live = LiveCrawler(base: base, token: nil, attest: attest)
            crawler = { url in live.crawl(url) }
        } else {
            let recorded = MockAPI.fixtures(latency: !testing)
            crawler = { url in await recorded.crawl(url) }
        }
        let api = LocalAPI(
            store: store, crawler: crawler,
            services: base.flatMap { b in attest.map { LocalServices(base: b, attest: $0) } },
            shared: base.map { b in LiveAPI(base: b) { nil } }
        )
        let env = AppEnvironment(api: api, mode: .local, snapshot: api.snapshot(), shared: LocalCache.appGroup(), local: store, isLive: true)
        // A page read in the background: show what it filled in.
        api.onChange = { [weak library = env.store] in
            guard let library else { return }
            Task { await library.refresh() }
        }
        return env
    }

    /// The signed-in account's plan, "pro" or "free", from its server library. MockAPI's account is Pro.
    static func serverPlan() async throws -> String {
        guard FeatureFlags.useLiveAPI, let base = AppConfig.apiBase else { return "pro" }
        return try await LiveAPI(base: base) { await AuthService.accessToken() }.library(since: nil).plan ?? "free"
    }

    /// Signs calls from an install without an account (App Attest). One per process, so the key registers once.
    static let attest = AppConfig.apiBase.map {
        AppAttestClient(base: $0, keychainGroup: AppConfig.sharedKeychainGroup, devSecret: AppConfig.appAttestDevSecret)
    }

    /// Guest mode kept a sample library in Application Support until the local library replaced it (Pro phase 3).
    static func removeGuestStore() {
        let path = URL.applicationSupportDirectory.appending(path: "Guest.store").path(percentEncoded: false)
        for suffix in ["", "-wal", "-shm"] { try? FileManager.default.removeItem(atPath: path + suffix) }
        UserDefaults.standard.removeObject(forKey: "guest")
    }
}
