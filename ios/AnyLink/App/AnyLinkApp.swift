import SwiftUI
import DesignSystem

@main
struct AnyLinkApp: App {
    @State private var env: AppEnvironment
    /// Made at launch so it hears every App Store transaction from the start.
    @State private var pro: ProStore

    init() {
        AL.registerFonts()
        // A failed email link is news for this launch only.
        UserDefaults.standard.removeObject(forKey: AuthService.linkErrorKey)
        if AppConfig.isUITesting {
            // UI tests start signed in and onboarded unless they ask for those screens.
            let args = ProcessInfo.processInfo.arguments
            UserDefaults.standard.set(!args.contains("-welcome"), forKey: "signedIn")
            UserDefaults.standard.set(false, forKey: "guest")
            UserDefaults.standard.set(true, forKey: "onboarded")
        }
        let env = AppEnvironment.current()
        _env = State(initialValue: env)
        _pro = State(initialValue: .app(env))
        AppTips.configure()
    }

    var body: some Scene {
        WindowGroup {
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("-gallery") {
                GalleryView()
            } else {
                RootView(env: env)
                    .environment(pro)
                    .onAppear { if ProcessInfo.processInfo.arguments.contains("-onboarding") { env.router.showsOnboarding = true } }
            }
            #else
            RootView(env: env).environment(pro)
            #endif
        }
    }
}
