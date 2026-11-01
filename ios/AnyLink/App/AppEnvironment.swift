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
        // A Pro refusal opens the paywall (S19) instead of a toast.
        store.onProRequired = { [router] in router.sheet = .paywall }
        // The widgets read the App Group, so only an App Group library feeds them.
        if shared != nil {
            store.onSave = { [weak store] in
                guard let summary = store?.widgetSummary, summary != WidgetSummary.load() else { return }
                summary.save()
                WidgetCenter.shared.reloadAllTimelines()
            }
        }
    }

    /// The environment for a library mode. RootView moves the library between them when the plan changes (S20).
    static func make(_ mode: LibraryMode) -> AppEnvironment {
        switch mode {
        case .server: FeatureFlags.useLiveAPI ? live() : mock(api: mockServer)
        case .local: local()
        }
    }

    /// The sample library, as a Pro account unless `plan` says otherwise (previews use `-free`'s "free").
    static func mock(api: MockAPI? = nil, latency: Bool = true, plan: String = "pro") -> AppEnvironment {
        let cache = LocalCache.appGroup()
        var library = Fixtures.library
        library.plan = plan
        return AppEnvironment(api: api ?? MockAPI.fixtures(latency: latency), snapshot: library, shared: cache)
    }

    /// Without a backend (UI tests, mock builds), the account's server library: one per process, so an upgrade's upload
    /// shows up in the server library it switches to. Free under `-free` until a purchase (`ProStore`), and under
    /// `-pro-ends`.
    static let mockServer = MockAPI.fixtures(latency: !AppConfig.isUITesting,
                                             plan: AppConfig.isFree || AppConfig.proEnds ? "free" : "pro")

    /// Where the upgrade sends a local library: the signed-in account's server library.
    static var server: any AnyLinkAPI {
        guard FeatureFlags.useLiveAPI, let base = AppConfig.apiBase else { return mockServer }
        return LiveAPI(base: base) { await AuthService.accessToken() }
    }

    /// Whose upgrade a record of uploaded links belongs to (`LibraryMove`).
    static var account: String { AuthService.client?.currentUser?.id.uuidString ?? "mock" }

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
        guard let store = localStore else { return mock() }
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

    /// The signed-in account's plan, "pro" or "free", from its server library.
    // ponytail: reads the whole web library for its plan, on every return to a signed-in local library; add a plan-only
    // endpoint if free accounts with big web libraries feel it.
    static func serverPlan() async throws -> String {
        try await server.library(since: nil).plan ?? "free"
    }

    /// One per process, however often the mode changes: a second container on `Local.store` would mirror it to
    /// CloudKit twice. In memory under -ui-testing, where `-free` starts it with the sample library.
    // ponytail: a store that won't open (damaged, disk full) runs in memory, so that launch's saves don't last; tell
    // the user if it ever shows up.
    static let localStore: LocalStore? = {
        guard AppConfig.isUITesting else { return LocalStore.appGroup() ?? (try? LocalStore()) }
        let store = try? LocalStore()
        if AppConfig.isFree {
            store?.save(Fixtures.collections.filter { $0.isInbox != true })
            store?.save(Fixtures.links + Fixtures.trashed.map { var l = $0; l.deleted = true; return l })
        }
        return store
    }()

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
