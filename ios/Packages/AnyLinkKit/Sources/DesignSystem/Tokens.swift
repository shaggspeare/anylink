import SwiftUI

#if canImport(UIKit)
import UIKit
#endif

// MARK: - Color helpers

#if canImport(UIKit)
extension UIColor {
    convenience init(hex: UInt32, alpha: CGFloat = 1) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: alpha
        )
    }
}

extension Color {
    public init(hex: UInt32) { self.init(uiColor: UIColor(hex: hex)) }

    public static func themed(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) })
    }
}
#else
extension Color {
    public init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }

    public static func themed(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(hex: light)
    }
}
#endif

// MARK: - Tokens

public enum AL {
    // MARK: Theme
    public static let canvas = Color.themed(0xECEEF0, 0x0F1012)
    public static let ink = Color.themed(0x17181B, 0xECEEF0)
    public static let paper = Color.themed(0xFFFFFF, 0x1A1B1F)
    public static let surface = Color.themed(0xFFFFFF, 0x24252A)
    public static let rim = Color.themed(0xFFFFFF, 0x3E4046)
    public static let glassTint = Color.themed(0xFFFFFF, 0x1E1F23)
    public static let onInk = Color.themed(0xF4F5F6, 0x17181B)
    public static let docShell = Color.themed(0x0D0E10, 0x1C1D21)
    public static let heroPlaceholder = Color.themed(0xDFE2E5, 0x26272B)

    // MARK: Accents (theme-independent)
    public static let signal = Color(hex: 0xFF5A1F)
    public static let signalSoft = Color(hex: 0xFF7A45)
    public static let lime = Color(hex: 0xD6F24B)
    public static let limeHover = Color(hex: 0xE0F96A)
    public static let periwinkle = Color(hex: 0x7C8CFF)
    public static let slate = Color(hex: 0x9AA3AD)
    public static let terracotta = Color(hex: 0xE0855A)
    public static let onAccent = Color(hex: 0x17181B)
    public static let inStock = Color(hex: 0x00A046)
    public static let destructive = Color(hex: 0xEF4444)
    public static let destructiveOnDark = Color(hex: 0xFF8A5C)
    /// Destructive *text* (labels on glass): darker red in light mode for 4.5:1.
    public static let destructiveText = Color.themed(0xC62828, 0xFF8A5C)
    public static let light = Color(hex: 0xF4F5F6)
    /// The toast's Undo: signal on the dark toast; dark text on the light (dark-mode) toast, where orange fails 4.5:1.
    public static let toastAction = Color.themed(0xFF5A1F, 0x17181B)

    // MARK: B additions
    public static let inStockFill = Color(hex: 0x00A046).opacity(0.14)
    public static let noticeFill = Color(hex: 0xFF5A1F).opacity(0.14)
    public static let periwinkleFill = Color(hex: 0x7C8CFF).opacity(0.18)

    // MARK: Ink alphas
    public enum Ink {
        public static let a85 = 0.85, a80 = 0.80, a75 = 0.76, a65 = 0.74, a60 = 0.74, a55 = 0.72
        // D23: secondary-text alphas sit at ≥ .72 so small text keeps 4.5:1 over the orbs (accessibility audit).
        public static let a50 = 0.72, a45 = 0.72, a40 = 0.40, a30 = 0.30, a20 = 0.20, a16 = 0.16
        public static let a12 = 0.12, a08 = 0.08, a06 = 0.06, a05 = 0.05
    }

    // MARK: Radius
    public enum Radius {
        public static let kbd: CGFloat = 7
        public static let badge: CGFloat = 9
        public static let nav: CGFloat = 14
        public static let tile: CGFloat = 16
        public static let card: CGFloat = 22
        public static let panel: CGFloat = 27
        public static let article: CGFloat = 28
        public static let sheet: CGFloat = 30
    }

    // MARK: Spacing
    public enum Space {
        public static let s1: CGFloat = 8
        public static let s2: CGFloat = 14
        public static let s3: CGFloat = 18
        public static let s4: CGFloat = 26
        public static let s5: CGFloat = 48
        public static let s6: CGFloat = 70
    }

    // MARK: Control sizes
    public enum Control {
        public static let sm: CGFloat = 36
        public static let md: CGFloat = 44
        public static let lg: CGFloat = 52
        public static let xl: CGFloat = 58
        public static let fab: CGFloat = 56
    }

    // MARK: Motion
    public enum Motion {
        public static let entrance = Animation.timingCurve(0.22, 1.35, 0.36, 1, duration: 0.7)
        public static let reorder = Animation.timingCurve(0.2, 0.9, 0.3, 1.15, duration: 0.26)
        public static let settle = Animation.timingCurve(0.2, 0.9, 0.3, 1.15, duration: 0.22)
        public static let sheet = Animation.timingCurve(0.2, 0.9, 0.3, 1, duration: 0.28)
        public static let progress = Animation.easeInOut(duration: 0.5)
        public static let entranceScales: [CGFloat] = [0.72, 1.14, 0.86, 1.22, 0.64, 1.06]
        public static func stagger(_ i: Int) -> Double { min(Double(i) * 0.035, 0.6) }
    }

    // MARK: Shadow
    public enum Shadow {
        public static let card = (y: 2.0, radius: 4.0, light: 0.14, dark: 0.50)
        public static let popover = (y: 14.0, radius: 17.0, light: 0.28, dark: 0.60)
        public static let window = (y: 30.0, radius: 35.0, light: 0.45, dark: 0.75)
    }

    // MARK: Identity
    public static let identityTints: [UInt32] = [0xFF5A1F, 0x7C8CFF, 0xD6F24B, 0x9AA3AD, 0x17181B, 0xE0855A]
    public static let identityStripes: [UInt32] = [0xFFFFFF, 0x17181B, 0xD6F24B]
    public static let collectionSwatches: [UInt32] = [0xFF5A1F, 0xD6F24B, 0x7C8CFF, 0x9AA3AD, 0xE0855A]

    public static func identity(for domain: String) -> (tint: UInt32, stripe: UInt32, initial: String) {
        var h: Int32 = 0
        for unit in domain.utf16 { h = h &* 31 &+ Int32(unit) }
        let n = Int(abs(Int64(h)))
        let tint = identityTints[n % identityTints.count]
        var stripe = identityStripes[n % identityStripes.count]
        if stripe == tint { stripe = tint == 0x17181B ? 0xFFFFFF : 0x17181B }
        let initial = domain.first.map { String($0).uppercased() } ?? "?"
        return (tint, stripe, initial)
    }
}

// MARK: - Shadow modifier

extension View {
    public func alShadow(_ shadow: (y: Double, radius: Double, light: Double, dark: Double)) -> some View {
        modifier(ALShadowModifier(shadow: shadow))
    }
}

private struct ALShadowModifier: ViewModifier {
    let shadow: (y: Double, radius: Double, light: Double, dark: Double)
    @Environment(\.colorScheme) private var colorScheme

    func body(content: Content) -> some View {
        content.shadow(
            color: colorScheme == .dark
                ? .black.opacity(shadow.dark)
                : AL.ink.opacity(shadow.light),
            radius: shadow.radius,
            y: shadow.y
        )
    }
}
