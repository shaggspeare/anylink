import SwiftUI

public struct Frosted: ViewModifier {
    var fill: Double
    var radius: CGFloat
    var rim: Double

    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.alForceSolid) private var forceSolid

    public func body(content: Content) -> some View {
        if reduceTransparency || forceSolid {
            content
                .background(AL.paper, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
        } else {
            content
                .background(
                    .ultraThinMaterial.opacity(fill),
                    in: RoundedRectangle(cornerRadius: radius, style: .continuous)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: radius, style: .continuous)
                        .strokeBorder(AL.rim.opacity(rim), lineWidth: 0.5)
                )
        }
    }
}

extension View {
    public func frosted(_ fill: Double = 0.62, radius: CGFloat = 22, rim: Double = 0.75) -> some View {
        modifier(Frosted(fill: fill, radius: radius, rim: rim))
    }
}

extension EnvironmentValues {
    /// Forces the Reduce Transparency look; previews and the Gallery set it because the system value is read-only.
    @Entry public var alForceSolid: Bool = false
}
