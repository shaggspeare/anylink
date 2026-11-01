import SwiftUI
import DesignSystem
import Store

@main
struct AnyLinkApp: App {
    @State private var env: AppEnvironment
    /// Made at launch so it hears every App Store transaction from the start.
    @State private var pro: ProStore

    init() {
        AL.registerFonts()
        // A failed email link is news for this launch only.
        UserDefaults.standard.removeObject(forKey: AuthService.linkErrorKey)
        AppEnvironment.removeGuestStore()
        let defaults = UserDefaults.standard
        if AppConfig.isUITesting {
            // UI tests start onboarded and signed in to a Pro account (MockAPI), unless they ask for a local library:
            // signed out, or signed in on Free (-free), whose library is local. No move is under way.
            let signedIn = !ProcessInfo.processInfo.arguments.contains("-signed-out")
            defaults.set(signedIn, forKey: "signedIn")
            defaults.set(signedIn ? (AppConfig.isFree ? "free" : "pro") : "", forKey: "plan")
            defaults.set(true, forKey: "onboarded")
            defaults.set(false, forKey: "lapseNotice")
            LibraryMove.forget(AppEnvironment.account)
        }
        _env = State(initialValue: .make(LibraryMode(signedIn: defaults.bool(forKey: "signedIn"), plan: defaults.string(forKey: "plan"))))
        _pro = State(initialValue: .app())
        AppTips.configure()
    }

    var body: some Scene {
        WindowGroup {
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("-gallery") {
                GalleryView()
            } else {
                RootView(env: $env)
                    .environment(pro)
                    .onAppear { if ProcessInfo.processInfo.arguments.contains("-onboarding") { env.router.showsOnboarding = true } }
            }
            #else
            RootView(env: $env).environment(pro)
            #endif
        }
    }
}
