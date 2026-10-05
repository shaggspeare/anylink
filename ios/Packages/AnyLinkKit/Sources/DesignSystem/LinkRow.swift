import SwiftUI
import Models

public struct LinkRow: View {
    public let link: LinkItem
    public var isSelected: Bool = false
    public var selectMode: Bool = false
    /// Replaces "domain · reading meta", e.g. "domain · collection" in filter results.
    public var meta: String?
    /// Dense variant for scanning long lists: smaller thumbnail, 44pt minimum (HIG tap target), grows with Dynamic Type.
    public var compact: Bool = false

    public init(link: LinkItem, isSelected: Bool = false, selectMode: Bool = false, meta: String? = nil, compact: Bool = false) {
        self.link = link; self.isSelected = isSelected; self.selectMode = selectMode; self.meta = meta; self.compact = compact
    }

    public var body: some View {
        HStack(spacing: compact ? 10 : 12) {
            if selectMode { selectCheck }
            thumbnail
            VStack(alignment: .leading, spacing: 2) {
                Text(link.title)
                    .font(AL.Font.rowTitle)
                    .foregroundStyle(AL.ink)
                    .lineLimit(1)
                Text(meta ?? [link.sourceLabel, link.readingMeta].compactMap { $0 }.joined(separator: " · "))
                .font(.caption)
                .foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                .lineLimit(1)
            }
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
        .frame(minHeight: compact ? 44 : 64, maxHeight: compact ? nil : 64)
        // One element with the full text: the visible title and domain truncate by design.
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(link.title), \(link.sourceLabel)\(link.favorite == true ? ", favourite" : "")\(link.pinned == true ? ", pinned" : "")")
        .accessibilityValue(link.readingMeta ?? "")
    }

    @ViewBuilder
    private var thumbnail: some View {
        if link.isNote {
            NoteThumb()
                .frame(width: compact ? 32 : 44, height: compact ? 32 : 44)
                .clipShape(RoundedRectangle(cornerRadius: compact ? 8 : 10, style: .continuous))
        } else {
            linkThumbnail
        }
    }

    private var linkThumbnail: some View {
        HeroImage(link: link)
            .frame(width: compact ? 32 : 44, height: compact ? 32 : 44)
            .clipShape(RoundedRectangle(cornerRadius: compact ? 8 : 10, style: .continuous))
    }

    @ViewBuilder
    private var selectCheck: some View {
        ZStack {
            if isSelected {
                Circle().fill(AL.lime).frame(width: 24, height: 24)
                Image(systemName: "checkmark")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(AL.onAccent)
            } else {
                Circle()
                    .strokeBorder(AL.ink.opacity(AL.Ink.a20), lineWidth: 2)
                    .frame(width: 24, height: 24)
            }
        }
    }
}

// MARK: - Previews

private let previewLink = LinkItem(
    id: "preview", url: "https://nasa.gov", domain: "nasa.gov",
    title: "NASA's next-gen space suit costs $3.5 billion", excerpt: "Overview of the Artemis programme costs.",
    tint: "#FF5A1F", stripe: "#FFFFFF", initial: "N",
    contentType: .article, readingTimeMinutes: 6,
    collectionId: "unsorted", tags: ["space"], size: .M,
    status: .ready, createdAt: "2026-10-01T00:00:00Z",
    favorite: true
)

#if os(iOS)
#Preview("LinkRow — Light") {
    List {
        LinkRow(link: previewLink)
        LinkRow(link: previewLink, isSelected: true, selectMode: true)
        LinkRow(link: previewLink, isSelected: false, selectMode: true)
    }
    .listStyle(.insetGrouped)
}

#Preview("LinkRow — Dark") {
    List {
        LinkRow(link: previewLink)
    }
    .listStyle(.insetGrouped)
    .preferredColorScheme(.dark)
}
#endif
