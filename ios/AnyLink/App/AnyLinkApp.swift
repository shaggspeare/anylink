import SwiftUI
import DesignSystem

@main
struct AnyLinkApp: App {
    @State private var env: AppEnvironment

    init() {
        AL.registerFonts()
        if AppConfig.isUITesting {
            // UI tests start signed in and onboarded unless they ask for those screens.
            let args = ProcessInfo.processInfo.arguments
            UserDefaults.standard.set(!args.contains("-welcome"), forKey: "signedIn")
            UserDefaults.standard.set(true, forKey: "onboarded")
        }
        _env = State(initialValue: .current())
    }

    var body: some Scene {
        WindowGroup {
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("-gallery") {
                GalleryView()
            } else {
                RootView(env: env)
                    .onAppear { if ProcessInfo.processInfo.arguments.contains("-onboarding") { env.router.showsOnboarding = true } }
            }
            #else
            RootView(env: env)
            #endif
        }
    }
}
