import SwiftUI
import DesignSystem
import Store

@main
struct AnyLinkApp: App {
    @State private var env: AppEnvironment

    init() {
        AL.registerFonts()
        // A failed email link is news for this launch only.
        UserDefaults.standard.removeObject(forKey: AuthService.linkErrorKey)
        AppEnvironment.removeGuestStore()
        let defaults = UserDefaults.standard
        if AppConfig.isUITesting {
            // UI tests start onboarded and signed in to a Pro account (MockAPI), unless they ask for a local library.
            let signedIn = !ProcessInfo.processInfo.arguments.contains("-signed-out")
            defaults.set(signedIn, forKey: "signedIn")
            defaults.set(signedIn ? "pro" : "", forKey: "plan")
            defaults.set(true, forKey: "onboarded")
        }
        _env = State(initialValue: .make(LibraryMode(signedIn: defaults.bool(forKey: "signedIn"), plan: defaults.string(forKey: "plan"))))
        AppTips.configure()
    }

    var body: some Scene {
        WindowGroup {
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("-gallery") {
                GalleryView()
            } else {
                RootView(env: $env)
                    .onAppear { if ProcessInfo.processInfo.arguments.contains("-onboarding") { env.router.showsOnboarding = true } }
            }
            #else
            RootView(env: $env)
            #endif
        }
    }
}
