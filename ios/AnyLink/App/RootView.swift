import SwiftUI
import DesignSystem
import Store

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
            .toastOverlay(env.store.toasts, bottomOffset: env.router.showsAccessory ? 158 : 100)
            .task { await env.clipboard.observe() }
            .task { await env.reachability.start() }
            .task { if env.isLive { await env.store.refresh() } }
            .onChange(of: scenePhase, initial: true) { _, phase in
                if phase == .active {
                    Task { await env.clipboard.check() }
                    env.store.drainOutbox()
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
        TabView(selection: Binding(get: { router.tab }, set: { router.select($0) })) {
            Tab("Library", systemImage: "link", value: AppTab.library) {
                NavigationStack(path: $router.library) { LibraryView().routes(.library) }
            }
            Tab("Collections", systemImage: "folder", value: AppTab.collections) {
                NavigationStack(path: $router.collections) { CollectionsView().routes(.collections) }
            }
            Tab(value: AppTab.search, role: .search) {
                NavigationStack(path: $router.search) { SearchView(store: store).routes(.search) }
            }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        .modifier(PasteAccessoryHost(enabled: router.showsAccessory))
        .sheet(item: $router.sheet) { SheetHost(sheet: $0) }
    }
}

/// Disabled (not just emptied): an empty accessory still draws glass over the select-mode toolbar and eats its taps.
private struct PasteAccessoryHost: ViewModifier {
    let enabled: Bool

    func body(content: Content) -> some View {
        if #available(iOS 26.1, *) {
            content.tabViewBottomAccessory(isEnabled: enabled) { AccessoryContent() }
        } else {
            content.tabViewBottomAccessory { if enabled { AccessoryContent() } }
        }
    }
}

private struct AccessoryContent: View {
    @Environment(LibraryStore.self) private var store
    @Environment(Router.self) private var router
    @Environment(\.tabViewBottomAccessoryPlacement) private var placement

    private var collectionID: String? {
        if case .collection(let id) = router.path(router.tab).last { return id }
        return nil
    }

    var body: some View {
        PasteAccessory(
            hasURL: store.clipboardHasURL,
            collectionName: collectionID.map(store.name(of:)),
            compact: placement == .inline,
            onPaste: { urls in router.sheet = .addLink(prefill: urls.first, collectionID: collectionID) },
            onNew: { router.sheet = .addLink(prefill: nil, collectionID: collectionID) }
        )
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
