import SwiftUI
import Models

public struct LinkRow: View {
    public let link: LinkItem
    public var isSelected: Bool = false
    public var selectMode: Bool = false

    public init(link: LinkItem, isSelected: Bool = false, selectMode: Bool = false) {
        self.link = link; self.isSelected = isSelected; self.selectMode = selectMode
    }

    public var body: some View {
        HStack(spacing: 12) {
            if selectMode { selectCheck }
            thumbnail
            VStack(alignment: .leading, spacing: 2) {
                Text(link.title)
                    .font(AL.Font.rowTitle)
                    .foregroundStyle(AL.ink)
                    .lineLimit(1)
                HStack(spacing: 0) {
                    Text(link.domain)
                    if let meta = link.readingMeta {
                        Text(" · \(meta)")
                    }
                }
                .font(.system(size: 11.5))
                .foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                .lineLimit(1)
            }
            Spacer(minLength: 0)
            if link.favorite == true {
                Image(systemName: "star.fill")
                    .font(.system(size: 12))
                    .foregroundStyle(AL.signal)
            }
        }
        .frame(height: 64)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(link.title), \(link.domain)\(link.favorite == true ? ", favourite" : "")")
    }

    private var thumbnail: some View {
        HeroImage(link: link)
            .frame(width: 44, height: 44)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    @ViewBuilder
    private var selectCheck: some View {
        ZStack {
            if isSelected {
                Circle().fill(AL.lime).frame(width: 24, height: 24)
                Image(systemName: "checkmark")
                    .font(.system(size: 12, weight: .bold))
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
