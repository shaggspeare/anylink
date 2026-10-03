import SwiftUI
import DesignSystem

@main
struct AnyLinkApp: App {
    init() {
        AL.registerFonts()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}
