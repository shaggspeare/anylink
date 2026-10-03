import SwiftUI
import DesignSystem

@main
struct AnyLinkApp: App {
    @State private var env: AppEnvironment

    init() {
        AL.registerFonts()
        _env = State(initialValue: .current())
    }

    var body: some Scene {
        WindowGroup {
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("-gallery") {
                GalleryView()
            } else {
                RootView(env: env)
            }
            #else
            RootView(env: env)
            #endif
        }
    }
}
