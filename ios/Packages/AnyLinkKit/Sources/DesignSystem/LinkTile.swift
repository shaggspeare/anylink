import SwiftUI
import Models

public struct LinkTile: View {
    public let link: LinkItem
    public var isSelected: Bool = false
    public var selectMode: Bool = false

    public init(link: LinkItem, isSelected: Bool = false, selectMode: Bool = false) {
        self.link = link; self.isSelected = isSelected; self.selectMode = selectMode
    }

    private var tintColor: Color { .fromHex(link.tint) }
    private var stripeColor: Color { .fromHex(link.stripe) }

    public var body: some View {
        VStack(spacing: 0) {
            if link.isNote {
                NoteTileBody(link: link)
            } else if link.isImage {
                imageFace
            } else {
                hero
                body_
            }
        }
        .frame(minHeight: 184, maxHeight: link.isNote || link.isImage ? 184 : nil, alignment: .top)   // grows with Dynamic Type instead of clipping
        .frosted(0.62, radius: 18)
        .alShadow(AL.Shadow.card)
        .overlay(alignment: .topLeading) { selectBadge }
        .overlay { selectOutline }
        // One element with the full text: the visible title and domain truncate by design.
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(link.title), \(link.sourceLabel)\(link.favorite == true ? ", favourite" : "")\(link.pinned == true ? ", pinned" : "")")
        .accessibilityValue(link.readingMeta ?? "")
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Image

    /// The image is the content: taller than a link's hero, on a dark mat, no scrim, top-anchored so a
    /// screenshot shows its header. The caption sits underneath.
    private var imageFace: some View {
        VStack(spacing: 0) {
            HeroImage(link: link)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(AL.docShell)
                .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                .overlay(alignment: .topTrailing) {
                    if link.status == .crawling {
                        ProgressView().controlSize(.small).tint(.white)
                            .padding(6).background(.black.opacity(0.45), in: Circle()).padding(6)
                    }
                }
                .padding(.top, 6)
                .padding(.horizontal, 6)
            HStack(spacing: 4) {
                Image(systemName: "photo").font(.caption2.weight(.bold)).foregroundStyle(AL.periwinkle)
                Text(link.title).font(AL.Font.brand(12, .semibold, relativeTo: .caption)).foregroundStyle(AL.ink).lineLimit(1)
                Spacer(minLength: 0)
                if link.pinned == true { Image(systemName: "pin.fill").font(.caption).foregroundStyle(AL.signal) }
                if link.favorite == true { Image(systemName: "star.fill").font(.caption).foregroundStyle(AL.signal) }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
        }
    }

    // MARK: - Hero

    private var hero: some View {
        HeroImage(link: link)
            .frame(height: 92)
            .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
            .overlay(CardScrim().clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous)))
            .overlay(alignment: .center) { videoDisc }
            .padding(.top, 6)
            .padding(.horizontal, 6)
    }

    @ViewBuilder
    private var videoDisc: some View {
        if link.contentType == .video {
            Image(systemName: "play.fill")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white)
                .frame(width: 34, height: 34)
                .background(.black.opacity(0.45), in: Circle())
        }
    }

    // MARK: - Body

    private var body_: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                InitialBadge(link: link, size: 14)
                Text(link.domain)
                    .font(.caption2)
                    .foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                    .lineLimit(1)
                Spacer(minLength: 0)
                if link.pinned == true {
                    Image(systemName: "pin.fill")
                        .font(.caption)
                        .foregroundStyle(AL.signal)
                }
                if link.favorite == true {
                    Image(systemName: "star.fill")
                        .font(.caption)
                        .foregroundStyle(AL.signal)
                }
            }
            Text(link.title)
                .font(AL.Font.tileTitle)
                .foregroundStyle(AL.ink)
                .lineLimit(2, reservesSpace: true)
                .multilineTextAlignment(.leading)
            if let meta = link.readingMeta {
                Text(meta)
                    .font(AL.Font.brand(11, .semibold, relativeTo: .caption))
                    .foregroundStyle(link.contentType == .product ? AL.inStock : AL.ink.opacity(AL.Ink.a50))
                    .lineLimit(1)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Select mode

    @ViewBuilder
    private var selectBadge: some View {
        if selectMode {
            ZStack {
                if isSelected {
                    Circle()
                        .fill(AL.lime)
                        .frame(width: 24, height: 24)
                    Image(systemName: "checkmark")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(AL.onAccent)
                } else {
                    Circle()
                        .strokeBorder(.black.opacity(0.18), lineWidth: 2)
                        .background(Circle().fill(.white.opacity(0.01)))
                        .frame(width: 24, height: 24)
                }
            }
            .offset(x: 12, y: 12)
        }
    }

    @ViewBuilder
    private var selectOutline: some View {
        if selectMode && isSelected {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(AL.ink, lineWidth: 2)
        }
    }
}

// MARK: - Preview helpers

private let previewLink = LinkItem(
    id: "preview", url: "https://example.com", domain: "example.com",
    title: "Understanding async/await in Swift 6 concurrency", excerpt: "A deep dive into modern Swift concurrency patterns.",
    tint: "#FF5A1F", stripe: "#FFFFFF", initial: "E",
    contentType: .article, readingTimeMinutes: 6,
    collectionId: "unsorted", tags: ["swift"], size: .M,
    status: .ready, createdAt: "2026-09-15T00:00:00Z", favorite: true
)

private let previewVideo = LinkItem(
    id: "video", url: "https://youtube.com/watch?v=1", domain: "youtube.com",
    title: "Rust for beginners — a complete course", excerpt: "",
    tint: "#7C8CFF", stripe: "#FFFFFF", initial: "Y",
    contentType: .video,
    collectionId: "unsorted", tags: ["rust"], size: .M,
    status: .ready, createdAt: "2026-10-01T00:00:00Z"
)

private let previewNote = LinkItem(
    id: "note", url: "", domain: "", title: "Gift ideas for Mum",
    excerpt: "Gift ideas for Mum\nThat linen apron from toast.co.uk/aprons, or the Kyoto print — https://example.com/print. Ask Sam first.",
    tint: "#D6F24B", stripe: "#17181B", initial: "✎", contentType: .note,
    collectionId: "unsorted", tags: [], size: .M, status: .ready, createdAt: "2026-10-01T00:00:00Z"
)

private let previewImage = LinkItem(
    id: "image", url: "", domain: "", title: "Boarding pass", excerpt: "",
    tint: "#17181B", stripe: "#FFFFFF", initial: "▣", contentType: .image,
    collectionId: "unsorted", tags: [], size: .M, status: .ready, createdAt: "2026-10-01T00:00:00Z"
)

#Preview("LinkTile — Note & Image") {
    HStack(spacing: 8) {
        LinkTile(link: previewNote)
        LinkTile(link: previewImage)
    }
    .padding(14)
    .background(AL.canvas)
}

#Preview("LinkTile — Note & Image, Dark") {
    HStack(spacing: 8) {
        LinkTile(link: previewNote)
        LinkTile(link: previewImage)
    }
    .padding(14)
    .background(AL.canvas)
    .preferredColorScheme(.dark)
}

#Preview("LinkTile — Light") {
    HStack(spacing: 8) {
        LinkTile(link: previewLink)
        LinkTile(link: previewVideo)
    }
    .padding(14)
    .background(AL.canvas)
}

#Preview("LinkTile — Dark") {
    HStack(spacing: 8) {
        LinkTile(link: previewLink)
        LinkTile(link: previewVideo)
    }
    .padding(14)
    .background(AL.canvas)
    .preferredColorScheme(.dark)
}

#Preview("LinkTile — Selected") {
    HStack(spacing: 8) {
        LinkTile(link: previewLink, isSelected: true, selectMode: true)
        LinkTile(link: previewVideo, isSelected: false, selectMode: true)
    }
    .padding(14)
    .background(AL.canvas)
}

#Preview("LinkTile — Reduce Transparency") {
    LinkTile(link: previewLink)
        .frame(width: 180)
        .padding(14)
        .background(AL.canvas)
        .environment(\.alForceSolid, true)
}

#Preview("LinkTile — Large Type") {
    LinkTile(link: previewLink)
        .frame(width: 180)
        .padding(14)
        .background(AL.canvas)
        .dynamicTypeSize(.accessibility2)
}

/// Tiles shrink to .97 while pressed.
public struct TilePressStyle: ButtonStyle {
    public init() {}
    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(AL.Motion.settle, value: configuration.isPressed)
    }
}
