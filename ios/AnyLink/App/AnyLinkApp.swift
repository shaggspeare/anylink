import SwiftUI
import DesignSystem

@main
struct AnyLinkApp: App {
    init() {
        AL.registerFonts()
    }

    var body: some Scene {
        WindowGroup {
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("-gallery") {
                GalleryView()
            } else {
                RootView()
            }
            #else
            RootView()
            #endif
        }
    }
}
