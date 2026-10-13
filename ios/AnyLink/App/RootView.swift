import SwiftUI
import TipKit
import DesignSystem
import Store
import Auth
import CoreSpotlight
import Models
import WidgetKit

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
    /// A password-reset link signed them in; ask for the new password.
    @State private var choosingPassword = false
    /// A link (e.g. a shared collection) opened on Welcome; handled once they're in.
    @State private var pendingURL: URL?

    var body: some View {
        Group {
            if signedIn { main(env) }
            else if guest, let guestEnv { main(guestEnv) }
            else { WelcomeView(onSignedIn: { signedIn = true }, onSkip: { guest = true }) }
        }
        .preferredColorScheme(appearance.scheme)
        .onOpenURL { url in
            if AuthService.isCallback(url) { finishMagicLink(url) }
            else if !signedIn && !guest { pendingURL = url }
        }
        .sheet(isPresented: $choosingPassword) { NewPasswordSheet() }
        .onChange(of: signedIn, initial: true) { was, on in
            UserDefaults(suiteName: "group.com.shaggspeare.anylink")?.set(on, forKey: "signedIn")
            if !on { WidgetSummary.clear(); WidgetCenter.shared.reloadAllTimelines() }
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

    /// An email link (confirm account, reset password) opened on this iPhone. Called from Welcome and from inside the app (a guest signing up).
    private func finishMagicLink(_ url: URL) {
        guard let client = AuthService.client else { return }
        Task {
            do {
                _ = try await client.session(from: url)
                UserDefaults.standard.removeObject(forKey: AuthService.linkErrorKey)
                signedIn = true
                if url.path() == AuthService.recoveryRedirect.path() { choosingPassword = true }
            } catch {
                // Shown by whichever sign-in view is on screen — the email sheet may still be covering Welcome.
                UserDefaults.standard.set(AuthService.linkFailure(error), forKey: AuthService.linkErrorKey)
            }
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
                await Spotlight.reindex(env.store.live)
            }
            .onContinueUserActivity(CSSearchableItemActionType) { activity in
                if let id = Spotlight.linkID(from: activity) { env.router.handle(URL(string: "anylink://link/\(id)")!) }
            }
            .onChange(of: scenePhase, initial: true) { _, phase in
                if phase == .background { Task { await Spotlight.reindex(env.store.live) } }
                if phase == .active {
                    Task { await env.clipboard.check() }
                    // Launch and every return: the share extension saves straight to the server while we're away.
                    Task {
                        if env.isLive { await env.store.refresh() } else { env.store.drainOutbox() }
                        await syncWithExtension(env)
                    }
                }
            }
            .onChange(of: undoManager, initial: true) { _, um in env.store.undo.undoManager = um }
            .onOpenURL { if AuthService.isCallback($0) { finishMagicLink($0) } else { env.router.handle($0) } }
            .task {
                if let url = pendingURL {
                    pendingURL = nil
                    env.router.handle(url)
                }
            }
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
                NavigationStack(path: $router.library) { LibraryView().routes(.library) }.gesture(TabSwipe(skipsRows: true, onSwipe: swipe))
            }
            Tab("Collections", systemImage: "folder", value: AppTab?.some(.collections)) {
                NavigationStack(path: $router.collections) { CollectionsView().routes(.collections) }.gesture(TabSwipe(onSwipe: swipe))
            }
            Tab("Search", systemImage: "magnifyingglass", value: AppTab?.some(.search)) {
                NavigationStack(path: $router.search) { SearchView(store: store).routes(.search) }.gesture(TabSwipe(skipsRows: true, onSwipe: swipe))
            }
            Tab("Profile", systemImage: "person.crop.circle", value: AppTab?.some(.profile)) {
                NavigationStack(path: $router.profile) { SettingsView().routes(.profile) }.gesture(TabSwipe(onSwipe: swipe))
            }
            // The .search role is what gives a tab the separate circle; it's never selected, so no search UI appears.
            Tab("New link", systemImage: "plus", value: AppTab?.none, role: .search) { EmptyView() }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        .sheet(item: $router.sheet) { SheetHost(sheet: $0) }
    }

    /// Sideways swipe at a tab's root steps to the neighbouring tab; New link isn't one. Pushed screens keep
    /// the back swipe.
    private func swipe(_ dx: CGFloat) {
        guard router.path(router.tab).isEmpty, !router.isSelecting,
              let i = AppTab.allCases.firstIndex(of: router.tab) else { return }
        let next = i + (dx < 0 ? 1 : -1)
        if AppTab.allCases.indices.contains(next) { router.select(AppTab.allCases[next]) }
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

/// UIKit pan, not a DragGesture: it runs alongside scrolling, tile buttons and context menus instead of losing
/// to them. Goes on each tab's stack — one on the TabView never sees touches inside the tabs.
struct TabSwipe: UIGestureRecognizerRepresentable {
    /// Link rows have their own swipe actions; a sideways swipe there is theirs.
    var skipsRows = false
    let onSwipe: (CGFloat) -> Void

    func makeUIGestureRecognizer(context: Context) -> UIPanGestureRecognizer {
        let pan = UIPanGestureRecognizer()
        pan.delegate = context.coordinator
        pan.cancelsTouchesInView = false
        return pan
    }

    func handleUIGestureRecognizerAction(_ pan: UIPanGestureRecognizer, context: Context) {
        guard pan.state == .ended else { return }
        let t = pan.translation(in: pan.view)
        // Long enough and clearly sideways — otherwise it's a scroll that drifted.
        if abs(t.x) > 70, abs(t.x) > abs(t.y) * 2 { onSwipe(t.x) }
    }

    func makeCoordinator(converter: CoordinateSpaceConverter) -> Coordinator { Coordinator(skipsRows: skipsRows) }

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        let skipsRows: Bool
        init(skipsRows: Bool) { self.skipsRows = skipsRows }

        func gestureRecognizer(_ g: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }

        /// A row that scrolls sideways (filter chips) owns that swipe.
        func gestureRecognizer(_ g: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
            var view = touch.view
            while let v = view {
                if let scroll = v as? UIScrollView, scroll.contentSize.width > scroll.bounds.width + 1 { return false }
                if skipsRows, v is UICollectionViewCell, v.superview is UICollectionView { return false }
                view = v.superview
            }
            return true
        }
    }
}

#Preview("Light") {
    RootView(env: .mock(latency: false))
}

#Preview("Dark") {
    RootView(env: .mock(latency: false))
        .preferredColorScheme(.dark)
}
