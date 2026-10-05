import SwiftUI
import Models

// Notes and images: their own faces on the shared tile/row, matching the web's cards.

/// Plain note text with links made tappable (signal orange, underlined) — no markdown, Telegram-style.
public func linkified(_ text: String) -> AttributedString {
    var out = AttributedString(text)
    guard let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue) else { return out }
    for match in detector.matches(in: text, range: NSRange(text.startIndex..., in: text)) {
        // Emails come back as mailto: links; a note's "me@x.com" stays text, like on the web.
        guard let url = match.url, url.scheme?.hasPrefix("http") == true,
              let r = Range(match.range, in: text), let ar = Range(r, in: out) else { continue }
        out[ar].link = url
        out[ar].foregroundColor = AL.signal
        out[ar].underlineStyle = .single
    }
    return out
}

/// A note's mark: a lime dog-ear in the top-right corner, on tiles, rows' thumbs and the note page.
public struct NoteFold: View {
    let size: CGFloat
    public init(size: CGFloat = 22) { self.size = size }
    public var body: some View {
        Path { p in
            p.move(to: .zero)
            p.addLine(to: CGPoint(x: size, y: size))
            p.addLine(to: CGPoint(x: 0, y: size))
            p.closeSubpath()
        }
        .fill(AL.lime)
        .frame(width: size, height: size)
        .clipShape(UnevenRoundedRectangle(bottomLeadingRadius: size * 0.28))
        .shadow(color: .black.opacity(0.14), radius: 2, x: -1, y: 1)
        .accessibilityHidden(true)
    }
}

/// Tile body for a note: label row, first line as the title, the rest fading out at the bottom edge.
struct NoteTileBody: View {
    let link: LinkItem

    private var parts: (first: String, rest: String) {
        let text = link.excerpt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let br = text.firstIndex(of: "\n") else { return (text, "") }
        return (String(text[..<br]), text[text.index(after: br)...].trimmingCharacters(in: .whitespacesAndNewlines))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 4) {
                Image(systemName: "text.alignleft").font(.caption2.weight(.bold))
                    .foregroundStyle(AL.noteMark)
                Text("Note").font(.caption2).foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                Spacer(minLength: 0)
                if link.pinned == true { Image(systemName: "pin.fill").font(.caption).foregroundStyle(AL.signal) }
                if link.favorite == true { Image(systemName: "star.fill").font(.caption).foregroundStyle(AL.signal) }
            }
            .padding(.trailing, 18)
            Text(linkified(parts.first))
                .font(AL.Font.brand(15, .semibold, relativeTo: .subheadline)).tracking(-0.3)
                .foregroundStyle(AL.ink)
                .lineLimit(3)
            if !parts.rest.isEmpty {
                Text(linkified(parts.rest))
                    .font(AL.Font.brand(12.5, .regular, relativeTo: .footnote))
                    .foregroundStyle(AL.ink.opacity(AL.Ink.a65))
                    .lineSpacing(1.5)
            }
        }
        .padding(.horizontal, 11)
        .padding(.top, 11)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .mask(LinearGradient(stops: [.init(color: .black, location: 0.7), .init(color: .clear, location: 1)], startPoint: .top, endPoint: .bottom))
        .overlay(alignment: .topTrailing) { NoteFold() }
    }
}

/// Row thumbnail for a note: a lime square with the text glyph — its identity at 32–44pt.
struct NoteThumb: View {
    var body: some View {
        ZStack(alignment: .topTrailing) {
            Rectangle().fill(AL.lime.opacity(0.9))
            Image(systemName: "text.alignleft")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(AL.onAccent)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}
