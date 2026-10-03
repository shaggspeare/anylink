import SwiftUI
import DesignSystem

struct RootView: View {
    var body: some View {
        NavigationStack {
            ZStack {
                AL.canvas.ignoresSafeArea()
                Orbs(.library).ignoresSafeArea()
                VStack {
                    Spacer()
                }
            }
            .navigationTitle("AnyLink")
        }
    }
}

#Preview("Light") {
    RootView()
        .preferredColorScheme(.light)
}

#Preview("Dark") {
    RootView()
        .preferredColorScheme(.dark)
}
