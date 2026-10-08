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
    /// App Group store shared with the share extension (pending saves, recent collections). nil for a guest.
    let shared: LocalCache?

    init(api: any AnyLinkAPI, snapshot: LibrarySnapshot? = nil, cache: LocalCache? = nil, shared: LocalCache? = nil,
         crawl: (@Sendable (URL) async -> AsyncThrowingStream<CrawlEvent, Error>)? = nil, isLive: Bool = false) {
        store = LibraryStore(api: api, snapshot: snapshot, crawl: crawl, cache: cache)
        router = Router()
        clipboard = ClipboardWatcher(store: store)
        reachability = Reachability(store: store)
        self.isLive = isLive
        self.shared = shared
        // A 401 (after the token can't be refreshed) signs out to Welcome.
        store.onUnauthorized = { UserDefaults.standard.set(false, forKey: "signedIn") }
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

    static func current() -> AppEnvironment {
        FeatureFlags.useLiveAPI ? live() : mock(latency: !AppConfig.isUITesting)
    }

    // MARK: - Guest

    /// Saves a guest can make before being asked to sign up (same as the web app).
    static let guestLimit = 2
    private static let guestStore = URL.applicationSupportDirectory.appending(path: "Guest.store")

    /// Skipped sign-in: the sample library plus their own saves, kept on this device only. Previews still come
    /// from the real crawler (rate-limited per IP for guests).
    static func guest() -> AppEnvironment {
        try? FileManager.default.createDirectory(at: .applicationSupportDirectory, withIntermediateDirectories: true)
        let cache = AppConfig.isUITesting ? try? LocalCache(inMemory: true) : try? LocalCache(url: guestStore)
        let library = cache?.loadSnapshot() ?? Fixtures.library
        let crawler = AppConfig.isUITesting ? nil : AppConfig.apiBase.map { LiveCrawler(base: $0, token: nil) }
        let env = AppEnvironment(
            api: MockAPI(links: library.links, trashed: library.trashed, collections: library.collections, latency: false),
            snapshot: library, cache: cache, crawl: crawler.map { c in { @Sendable url in c.crawl(url) } }
        )
        let store = env.store, router = env.router
        store.saveLimitReached = { guestSaves(in: store).count >= guestLimit }
        store.onSaveLimit = { router.sheet = .signUp }
        return env
    }

    /// What the guest saved themselves: anything that isn't part of the sample library.
    static func guestSaves(in store: LibraryStore) -> [LinkItem] {
        let samples = Set(Fixtures.library.links.map(\.id) + Fixtures.library.trashed.map(\.id))
        return store.links.values.filter { !samples.contains($0.id) }
    }

    /// Signing in from guest mode: their saves go into the App Group outbox the share extension uses, so the
    /// signed-in app saves them on its first run, then the guest library is deleted.
    // ponytail: items land in Unsorted (web keeps guest-made collections); carry collections over if guests use them.
    static func adoptGuest(_ guest: AppEnvironment, into shared: LocalCache?) {
        for l in guestSaves(in: guest.store) where l.deleted != true {
            shared?.upsertPendingSave(PendingSave(
                url: l.url, title: l.title, note: l.note,
                text: l.contentType == .note ? l.excerpt : nil,
                imageFile: l.contentType == .image ? l.id : nil
            ))
        }
        for suffix in ["", "-wal", "-shm"] {
            try? FileManager.default.removeItem(at: URL(filePath: guestStore.path() + suffix))
        }
    }
}
