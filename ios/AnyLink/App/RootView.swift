import SwiftUI
import TipKit
import DesignSystem
import Store
import CoreSpotlight

struct RootView: View {
    let env: AppEnvironment
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.undoManager) private var undoManager
    @AppStorage("appearance") private var appearance: Appearance = .system
    @AppStorage("signedIn") private var signedIn = false
    @AppStorage("onboarded") private var onboarded = false

    var body: some View {
        Group {
            if signedIn { main } else { WelcomeView { signIn() } }
        }
        .preferredColorScheme(appearance.scheme)
        .onChange(of: signedIn, initial: true) { _, on in
            UserDefaults(suiteName: "group.app.anylink.ios")?.set(on, forKey: "signedIn")
        }
    }

    /// Saves what the share extension left behind and tells it which collections to offer.
    private func syncWithExtension() async {
        guard let shared = env.shared else { return }
        await env.store.drainPendingSaves(from: shared)
        shared.saveRecentCollections(env.store.recentCollections)
    }

    private func signIn() {
        signedIn = true
        // First launch with an empty library goes through onboarding.
        if !onboarded && env.store.live.isEmpty { env.router.showsOnboarding = true }
    }

    private var main: some View {
        @Bindable var router = env.router
        return MainTabs()
            .modifier(OpenOriginalHost())
            .environment(env.store)
            .environment(env.router)
            .toastOverlay(env.store.toasts, bottomOffset: 100)
            .task { await env.clipboard.observe() }
            .task { await env.reachability.start() }
            .task {
                IntentBridge.store = env.store
                if env.isLive { await env.store.refresh() }
                await syncWithExtension()
                await Spotlight.reindex(env.store.live)
            }
            .onContinueUserActivity(CSSearchableItemActionType) { activity in
                if let id = Spotlight.linkID(from: activity) { env.router.handle(URL(string: "anylink://link/\(id)")!) }
            }
            .onChange(of: scenePhase, initial: true) { _, phase in
                if phase == .background { Task { await Spotlight.reindex(env.store.live) } }
                if phase == .active {
                    Task { await env.clipboard.check() }
                    env.store.drainOutbox()
                    Task { await syncWithExtension() }
                }
            }
            .onChange(of: undoManager, initial: true) { _, um in env.store.undo.undoManager = um }
            .onOpenURL { env.router.handle($0) }
            .fullScreenCover(isPresented: $router.showsOnboarding) {
                OnboardingFlow(store: env.store) {
                    onboarded = true
                    env.router.showsOnboarding = false
                }
                .environment(env.store)
                .environment(env.router)
                .preferredColorScheme(appearance.scheme)
            }
    }
}

struct MainTabs: View {
    @Environment(LibraryStore.self) private var store
    @Environment(Router.self) private var router

    var body: some View {
        @Bindable var router = router
        // `nil` is the New link button: it opens the sheet instead of switching tabs.
        TabView(selection: Binding<AppTab?>(get: { router.tab }, set: { if let t = $0 { router.select(t) } else { newLink() } })) {
            Tab("Library", systemImage: "link", value: AppTab?.some(.library)) {
                NavigationStack(path: $router.library) { LibraryView().routes(.library) }
            }
            Tab("Collections", systemImage: "folder", value: AppTab?.some(.collections)) {
                NavigationStack(path: $router.collections) { CollectionsView().routes(.collections) }
            }
            Tab("Search", systemImage: "magnifyingglass", value: AppTab?.some(.search)) {
                NavigationStack(path: $router.search) { SearchView(store: store).routes(.search) }
            }
            // The .search role is what gives a tab the separate circle; it's never selected, so no search UI appears.
            Tab("New link", systemImage: "plus", value: AppTab?.none, role: .search) { EmptyView() }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        .sheet(item: $router.sheet) { SheetHost(sheet: $0) }
    }

    /// Inside a collection, the new link saves straight into it. The sheet offers Paste when the clipboard has a URL.
    private func newLink() {
        var collectionID: String?
        if case .collection(let id) = router.path(router.tab).last { collectionID = id }
        router.sheet = .addLink(prefill: nil, collectionID: collectionID)
    }
}

extension View {
    /// Confirmations attach per tab: iOS 26 won't present one from the TabView while a bottom toolbar replaces the tab bar.
    func routes(_ tab: AppTab) -> some View {
        navigationDestination(for: Route.self) { RouteView(route: $0) }
            .confirmDialogs(in: tab)
    }
}

#Preview("Light") {
    RootView(env: .mock(latency: false))
}

#Preview("Dark") {
    RootView(env: .mock(latency: false))
        .preferredColorScheme(.dark)
}
