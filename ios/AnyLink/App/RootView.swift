import SwiftUI
import TipKit
import DesignSystem
import Store
import Auth
import CoreSpotlight

struct RootView: View {
    let env: AppEnvironment
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.undoManager) private var undoManager
    @AppStorage("appearance") private var appearance: Appearance = .system
    @AppStorage("signedIn") private var signedIn = false
    /// Skipped sign-in on Welcome: the sample library on its own store, until they sign up.
    @AppStorage("guest") private var guest = false
    @AppStorage("onboarded") private var onboarded = false
    @State private var guestEnv: AppEnvironment?

    var body: some View {
        Group {
            if signedIn { main(env) }
            else if guest, let guestEnv { main(guestEnv) }
            else { WelcomeView(onSignedIn: { signedIn = true }, onSkip: { guest = true }) }
        }
        .preferredColorScheme(appearance.scheme)
        .onOpenURL { if AuthService.isCallback($0) { finishMagicLink($0) } }
        .onChange(of: signedIn, initial: true) { was, on in
            UserDefaults(suiteName: "group.app.anylink.ios")?.set(on, forKey: "signedIn")
            if on && !was { didSignIn() }
        }
        .onChange(of: guest, initial: true) { _, on in
            guestEnv = on && !signedIn ? (guestEnv ?? .guest()) : nil
        }
    }

    /// Saves what the share extension left behind and tells it which collections to offer.
    private func syncWithExtension(_ env: AppEnvironment) async {
        guard let shared = env.shared else { return }
        await env.store.drainPendingSaves(from: shared)
        shared.saveRecentCollections(env.store.recentCollections)
    }

    /// The email's link, opened on this iPhone. Called from Welcome and from inside the app (a guest signing up).
    private func finishMagicLink(_ url: URL) {
        Task {
            if (try? await AuthService.client?.session(from: url)) != nil { signedIn = true }
        }
    }

    private func didSignIn() {
        // A guest's own saves queue up for the account; syncWithExtension saves them on the first run.
        if let guestEnv { AppEnvironment.adoptGuest(guestEnv, into: env.shared) }
        guest = false
        // First launch with an empty library goes through onboarding.
        let carried = !(env.shared?.pendingSaves().isEmpty ?? true)
        if !onboarded && env.store.live.isEmpty && !carried { env.router.showsOnboarding = true }
    }

    private func main(_ env: AppEnvironment) -> some View {
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
                await syncWithExtension(env)
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
                    Task { await syncWithExtension(env) }
                }
            }
            .onChange(of: undoManager, initial: true) { _, um in env.store.undo.undoManager = um }
            .onOpenURL { if AuthService.isCallback($0) { finishMagicLink($0) } else { env.router.handle($0) } }
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
        TabView(selection: Binding<AppTab?>(get: { router.tab }, set: { if let t = $0 { router.select(t) } else {
            // Next run-loop turn, not inside the tab bar's selection callback: presenting from there left
            // toolbar items on the next pushed screen without the environment — fatal "No Observable object
            // of type LibraryStore" on opening any link after using New link.
            Task { @MainActor in newLink() }
        } })) {
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
