import AppIntents
import SwiftUI
import WidgetKit
import DesignSystem
import Models

/// "Memes": the newest saved images, three (medium) or six (large). A tap copies one, ready to paste.
struct MemesWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "Memes", provider: MemesProvider()) { MemesView(entry: $0) }
            .configurationDisplayName("Memes")
            .description("Your newest saved images. Tap one to copy it.")
            .supportedFamilies([.systemMedium, .systemLarge])
    }
}

/// The Recent provider's summary, with thumbnails for the images instead of the recent links.
struct MemesProvider: TimelineProvider {
    func placeholder(in context: Context) -> LibraryEntry { .sample }

    func getSnapshot(in context: Context, completion: @escaping @Sendable (LibraryEntry) -> Void) {
        guard !context.isPreview else { return completion(.sample) }
        let family = context.family
        Task { completion(await entry(family)) }
    }

    func getTimeline(in context: Context, completion: @escaping @Sendable (Timeline<LibraryEntry>) -> Void) {
        let family = context.family
        Task { completion(Timeline(entries: [await entry(family)], policy: .never)) }
    }

    private func entry(_ family: WidgetFamily) async -> LibraryEntry {
        let summary = WidgetSummary.load()
        var thumbs: [LinkItem.ID: CGImage] = [:]
        for link in summary?.images.prefix(family == .systemLarge ? 6 : 3) ?? [] {
            guard let url = LocalImages.existing(for: link.id) ?? (link.heroImage ?? link.url).nilIfEmpty.flatMap(URL.init(string:)),
                  let image = try? await ImageLoader.shared.image(for: url, maxPixels: 360) else { continue }
            thumbs[link.id] = image
        }
        return LibraryEntry(date: .now, summary: summary, thumbs: thumbs)
    }
}

struct MemesView: View {
    @Environment(\.widgetFamily) private var family
    let entry: LibraryEntry

    private var images: [LinkItem] { Array(entry.summary?.images.prefix(family == .systemLarge ? 6 : 3) ?? []) }

    var body: some View {
        content.containerBackground(for: .widget) { AL.paper }
    }

    @ViewBuilder private var content: some View {
        if images.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                Text("Memes").font(AL.Font.eyebrow).textCase(.uppercase).foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                Spacer(minLength: 0)
                Text(entry.summary == nil ? "Open AnyLink to see your images." : "No images yet")
                    .font(AL.Font.rowTitle).foregroundStyle(AL.ink)
                if entry.summary != nil {
                    Text("Save a meme or a screenshot and it shows up here.").font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        } else {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("Memes").font(AL.Font.eyebrow).textCase(.uppercase).foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                    Spacer()
                    Text("Tap to copy").font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a45))
                }
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 3), spacing: 6) {
                    ForEach(images) { link in
                        Button(intent: CopyImageIntent(linkID: link.id)) {
                            LinkThumb(link: link, image: entry.thumbs[link.id])
                                .frame(maxWidth: .infinity)
                                .aspectRatio(1, contentMode: .fill)
                                .clipShape(RoundedRectangle(cornerRadius: AL.Radius.nav, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(Text("Copy \(link.title)"))
                    }
                }
            }
        }
    }
}

#Preview("Medium", as: .systemMedium) { MemesWidget() } timeline: { LibraryEntry.sample; LibraryEntry.empty }
#Preview("Large", as: .systemLarge) { MemesWidget() } timeline: { LibraryEntry.sample; LibraryEntry.empty }
