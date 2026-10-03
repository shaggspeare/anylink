import SwiftUI

public enum OrbVariant: Sendable {
    case library
    case addLink
    case reader
    case product
    case sheet
    case inbox
    case collection(Color)
}

public struct Orbs: View {
    public let variant: OrbVariant

    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    public init(_ variant: OrbVariant) {
        self.variant = variant
    }

    private var darkFactor: Double { colorScheme == .dark ? 0.45 : 1.0 }

    public var body: some View {
        if reduceTransparency { return AnyView(Color.clear) }
        return AnyView(
            GeometryReader { geo in
                ZStack {
                    switch variant {
                    case .library:
                        orb(color: AL.signal, opacity: 0.30, size: 300, blur: 90, x: -90, y: -60, in: geo)
                        orb(color: AL.periwinkle, opacity: 0.26, size: 280, blur: 100, x: geo.size.width - 80, y: 340, in: geo)
                    case .addLink:
                        orb(color: AL.signal, opacity: 0.32, size: 300, blur: 90, x: -80, y: -70, in: geo)
                        orb(color: AL.lime, opacity: 0.34, size: 300, blur: 110, x: geo.size.width - 90, y: 200, in: geo)
                    case .reader:
                        orb(color: AL.periwinkle, opacity: 0.24, size: 520, blur: 140, x: geo.size.width - 150, y: geo.size.height - 180, in: geo)
                    case .product:
                        orb(color: AL.periwinkle, opacity: 0.26, size: 520, blur: 130, x: -150, y: -150, in: geo)
                        orb(color: AL.lime, opacity: 0.30, size: 520, blur: 140, x: geo.size.width - 140, y: geo.size.height - 170, in: geo)
                    case .sheet:
                        orb(color: AL.signal, opacity: 0.35, size: 380, blur: 110, x: -60, y: -80, in: geo)
                        orb(color: AL.periwinkle, opacity: 0.28, size: 340, blur: 120, x: geo.size.width - 80, y: geo.size.height + 40, in: geo)
                    case .inbox:
                        orb(color: AL.slate, opacity: 0.40, size: 300, blur: 90, x: -90, y: -60, in: geo)
                        orb(color: AL.signal, opacity: 0.24, size: 280, blur: 100, x: geo.size.width - 80, y: 200, in: geo)
                    case .collection(let c):
                        orb(color: c, opacity: 0.32, size: 300, blur: 90, x: -90, y: -60, in: geo)
                        orb(color: AL.periwinkle, opacity: 0.26, size: 280, blur: 100, x: geo.size.width - 80, y: 200, in: geo)
                    }
                }
            }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
        )
    }

    private func orb(color: Color, opacity: Double, size: CGFloat, blur: CGFloat, x: CGFloat, y: CGFloat, in geo: GeometryProxy) -> some View {
        let frameSize = size + 2 * blur
        let endRadius = size / 2 + blur
        return Circle()
            .fill(RadialGradient(
                colors: [color.opacity(opacity * darkFactor), .clear],
                center: .center,
                startRadius: 0,
                endRadius: endRadius
            ))
            .frame(width: frameSize, height: frameSize)
            .position(x: x + frameSize / 2, y: y + frameSize / 2)
    }
}
