import SwiftUI
import Models

// MARK: - HeroFallback

public struct HeroFallback: View {
    public let tint: Color
    public let stripe: Color
    public var band: CGFloat = 6
    public var gap: CGFloat = 13

    public init(tint: Color, stripe: Color, band: CGFloat = 6, gap: CGFloat = 13) {
        self.tint = tint; self.stripe = stripe; self.band = band; self.gap = gap
    }

    public var body: some View {
        Canvas { ctx, size in
            ctx.fill(Path(CGRect(origin: .zero, size: size)), with: .color(tint))
            let period = band + gap
            var y: CGFloat = 0
            while y < size.height {
                ctx.fill(Path(CGRect(x: 0, y: y, width: size.width, height: band)), with: .color(stripe))
                y += period
            }
            let d: CGFloat = min(170, min(size.width, size.height) * 0.8)
            let r = CGRect(x: (size.width - d) / 2, y: (size.height - d) / 2, width: d, height: d)
            ctx.fill(Path(ellipseIn: r), with: .color(stripe.opacity(0.28)))
        }
    }
}

// MARK: - HeroImage

public struct HeroImage: View {
    public let url: URL?
    public let tint: Color
    public let stripe: Color

    public init(url: URL?, tint: Color, stripe: Color) {
        self.url = url; self.tint = tint; self.stripe = stripe
    }

    public init(link: LinkItem) {
        // A saved image this device has a copy of shows from disk: instant, and there offline.
        self.url = (link.isImage ? LocalImages.existing(for: link.id) : nil) ?? link.heroImage.flatMap(URL.init(string:))
        self.tint = Color(hex: UInt32(link.tint.dropFirst(), radix: 16) ?? 0x9AA3AD)
        self.stripe = Color(hex: UInt32(link.stripe.dropFirst(), radix: 16) ?? 0xFFFFFF)
    }

    public var body: some View {
        if let url {
            GeometryReader { g in
                LoadedImage(url: url, size: g.size, tint: tint, stripe: stripe)
            }
        } else {
            HeroFallback(tint: tint, stripe: stripe)
        }
    }
}

/// Placeholder while loading, fallback on failure, the downsampled image on success.
private struct LoadedImage: View {
    let url: URL
    let size: CGSize
    let tint: Color
    let stripe: Color
    @Environment(\.displayScale) private var scale
    @State private var image: CGImage?
    @State private var failed = false

    var body: some View {
        ZStack {
            if let image {
                Image(decorative: image, scale: scale).resizable().aspectRatio(contentMode: .fill)
            } else if failed {
                HeroFallback(tint: tint, stripe: stripe)
            } else {
                Rectangle().fill(AL.heroPlaceholder)
            }
        }
        .frame(width: size.width, height: size.height)
        .clipped()
        .task(id: url) {
            let px = Int(max(size.width, size.height) * scale)
            do { image = try await ImageLoader.shared.image(for: url, maxPixels: px) } catch { failed = true }
        }
    }
}

// MARK: - InitialBadge

public struct InitialBadge: View {
    public let initial: String
    public let tint: Color
    public let stripe: Color
    public var size: CGFloat = 18

    public init(initial: String, tint: Color, stripe: Color, size: CGFloat = 18) {
        self.initial = initial; self.tint = tint; self.stripe = stripe; self.size = size
    }

    public init(link: LinkItem, size: CGFloat = 18) {
        self.initial = link.initial
        self.tint = Color(hex: UInt32(link.tint.dropFirst(), radix: 16) ?? 0x9AA3AD)
        self.stripe = Color(hex: UInt32(link.stripe.dropFirst(), radix: 16) ?? 0xFFFFFF)
        self.size = size
    }

    private var radius: CGFloat {
        switch size {
        case ...14: return 4
        case ...18: return 6
        case ...24: return 7
        default: return 8
        }
    }

    private var fontSize: CGFloat {
        switch size {
        case ...14: return 8
        case ...18: return 9
        case ...24: return 10
        default: return size * 0.35
        }
    }

    public var body: some View {
        Text(initial)
            .font(.system(size: fontSize, weight: .bold))
            .foregroundStyle(stripe)
            .frame(width: size, height: size)
            .background(tint, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
            .accessibilityHidden(true)   // decorative: the domain next to it is read instead
    }
}

// MARK: - Hex parsing helper

extension Color {
    public static func fromHex(_ hex: String) -> Color {
        let clean = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        return Color(hex: UInt32(clean, radix: 16) ?? 0x9AA3AD)
    }
}

// MARK: - Scrim overlays

public struct CardScrim: View {
    public init() {}
    public var body: some View {
        LinearGradient(
            colors: [.black.opacity(0.28), .clear],
            startPoint: .bottom,
            endPoint: UnitPoint(x: 0.5, y: 0.45)
        )
    }
}

public struct ReaderScrim: View {
    public init() {}
    public var body: some View {
        LinearGradient(
            stops: [
                .init(color: .black.opacity(0.85), location: 0),
                .init(color: .black.opacity(0.70), location: 0.35),
                .init(color: .black.opacity(0.35), location: 0.6),
                .init(color: .clear, location: 1),
            ],
            startPoint: .bottom,
            endPoint: .top
        )
    }
}

// MARK: - Previews

#Preview("HeroFallback") {
    VStack(spacing: 20) {
        HeroFallback(tint: AL.signal, stripe: .white)
            .frame(width: 200, height: 120)
            .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
        HeroFallback(tint: AL.periwinkle, stripe: Color(hex: 0x17181B), band: 4, gap: 8)
            .frame(width: 100, height: 100)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
    .padding()
}

#Preview("InitialBadge") {
    HStack(spacing: 12) {
        InitialBadge(initial: "N", tint: AL.signal, stripe: .white, size: 14)
        InitialBadge(initial: "A", tint: AL.periwinkle, stripe: .white, size: 18)
        InitialBadge(initial: "R", tint: Color(hex: 0x17181B), stripe: AL.lime, size: 24)
        InitialBadge(initial: "K", tint: AL.slate, stripe: .white, size: 32)
    }
    .padding()
}
