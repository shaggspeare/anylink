import SwiftUI
import DesignSystem
import Store

struct RootView: View {
    let env: AppEnvironment
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.undoManager) private var undoManager

    var body: some View {
        MainTabs()
            .environment(env.store)
            .environment(env.router)
            .toastOverlay(env.store.toasts, bottomOffset: env.router.showsAccessory ? 158 : 100)
            .task { await env.clipboard.observe() }
            .onChange(of: scenePhase, initial: true) { _, phase in
                if phase == .active { Task { await env.clipboard.check() } }
            }
            .onChange(of: undoManager, initial: true) { _, um in env.store.undo.undoManager = um }
            .onOpenURL { env.router.handle($0) }
    }
}

struct MainTabs: View {
    @Environment(LibraryStore.self) private var store
    @Environment(Router.self) private var router

    var body: some View {
        @Bindable var router = router
        TabView(selection: Binding(get: { router.tab }, set: { router.select($0) })) {
            Tab("Library", systemImage: "link", value: AppTab.library) {
                NavigationStack(path: $router.library) { LibraryView().routes() }
            }
            Tab("Collections", systemImage: "folder", value: AppTab.collections) {
                NavigationStack(path: $router.collections) { CollectionsView().routes() }
            }
            Tab(value: AppTab.search, role: .search) {
                NavigationStack(path: $router.search) { SearchView().routes() }
            }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        .tabViewBottomAccessory {
            if router.showsAccessory { AccessoryContent() }
        }
        .sheet(item: $router.sheet) { SheetHost(sheet: $0) }
        .confirmDialogs()
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
    func routes() -> some View {
        navigationDestination(for: Route.self) { RouteView(route: $0) }
    }
}

#Preview("Light") {
    RootView(env: .mock(latency: false))
}

#Preview("Dark") {
    RootView(env: .mock(latency: false))
        .preferredColorScheme(.dark)
}
