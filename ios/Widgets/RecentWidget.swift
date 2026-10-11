import SwiftUI
import WidgetKit
import DesignSystem
import Models

/// "Recently saved": the newest link (small) or the newest three (medium). Each opens in the app.
struct RecentWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "Recent", provider: LibraryProvider()) { RecentView(entry: $0) }
            .configurationDisplayName("Recently saved")
            .description("Your newest links, one tap away.")
            .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct RecentView: View {
    @Environment(\.widgetFamily) private var family
    let entry: LibraryEntry

    var body: some View {
        content.containerBackground(for: .widget) { AL.paper }
    }

    @ViewBuilder private var content: some View {
        if let recent = entry.summary?.recent, let first = recent.first {
            if family == .systemSmall { small(first) } else { medium(recent) }
        } else {
            VStack(alignment: .leading, spacing: 4) {
                Text("Recently saved").font(AL.Font.eyebrow).textCase(.uppercase).foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                Spacer(minLength: 0)
                Text(entry.summary == nil ? "Open AnyLink to see your links." : "Nothing saved yet")
                    .font(AL.Font.rowTitle).foregroundStyle(AL.ink)
                if entry.summary != nil {
                    Text("Links you save show up here.").font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
    }

    private func small(_ link: LinkItem) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            LinkThumb(link: link, image: entry.thumbs[link.id])
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: AL.Radius.nav, style: .continuous))
                .padding(.bottom, 6)
            Text(link.title).font(AL.Font.rowTitle).foregroundStyle(AL.ink).lineLimit(2)
            Text(link.sourceLabel).font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a50)).lineLimit(1)
        }
        .widgetURL(link.widgetURL)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(link.title), \(link.sourceLabel)")
    }

    private func medium(_ links: [LinkItem]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Recently saved").font(AL.Font.eyebrow).textCase(.uppercase).foregroundStyle(AL.ink.opacity(AL.Ink.a50))
            ForEach(links) { link in
                if let url = link.widgetURL { Link(destination: url) {
                    HStack(spacing: 10) {
                        LinkThumb(link: link, image: entry.thumbs[link.id])
                            .frame(width: 36, height: 36)
                            .clipShape(RoundedRectangle(cornerRadius: AL.Radius.kbd, style: .continuous))
                        VStack(alignment: .leading, spacing: 1) {
                            Text(link.title).font(AL.Font.rowTitle).foregroundStyle(AL.ink).lineLimit(1)
                            Text([link.sourceLabel, link.readingMeta].compactMap { $0 }.joined(separator: " · "))
                                .font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a50)).lineLimit(1)
                        }
                        Spacer(minLength: 0)
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(link.title), \(link.sourceLabel)")
                } }
            }
            Spacer(minLength: 0)
        }
    }
}

#Preview("Small", as: .systemSmall) { RecentWidget() } timeline: { LibraryEntry.sample; LibraryEntry.empty; LibraryEntry.signedOut }
#Preview("Medium", as: .systemMedium) { RecentWidget() } timeline: { LibraryEntry.sample; LibraryEntry.empty; LibraryEntry.signedOut }
