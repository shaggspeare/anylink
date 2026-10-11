import SwiftUI
import WidgetKit
import DesignSystem
import Fixtures
import Models

@main
struct AnyLinkWidgets: WidgetBundle {
    init() { AL.registerFonts() }

    var body: some Widget {
        UnsortedWidget()
        RecentWidget()
        AddLinkControl()
    }
}

struct LibraryEntry: TimelineEntry {
    let date: Date
    /// nil until the signed-in app has written one.
    let summary: WidgetSummary?
    var thumbs: [LinkItem.ID: CGImage] = [:]

    static let sample = LibraryEntry(date: .now, summary: WidgetSummary(unsorted: 4, recent: Fixtures.library.links))
    static let signedOut = LibraryEntry(date: .now, summary: nil)
    static let empty = LibraryEntry(date: .now, summary: WidgetSummary(unsorted: 0, recent: []))
}

/// Reads the summary the app writes to the App Group. The app reloads the widgets after each change,
/// so there's no refresh schedule.
struct LibraryProvider: TimelineProvider {
    var thumbnails = true

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

    /// Thumbnails are fetched here, downsampled: a widget view can't load anything itself.
    private func entry(_ family: WidgetFamily) async -> LibraryEntry {
        let summary = WidgetSummary.load()
        let (count, pixels) = switch (thumbnails, family) {
        case (true, .systemSmall): (1, 480)
        case (true, .systemMedium): (WidgetSummary.limit, 132)
        default: (0, 0)
        }
        var thumbs: [LinkItem.ID: CGImage] = [:]
        for link in summary?.recent.prefix(count) ?? [] {
            guard let url = (link.isImage ? LocalImages.existing(for: link.id) : nil) ?? link.heroImage.flatMap(URL.init(string:)),
                  let image = try? await ImageLoader.shared.image(for: url, maxPixels: pixels) else { continue }
            thumbs[link.id] = image
        }
        return LibraryEntry(date: .now, summary: summary, thumbs: thumbs)
    }
}

/// A link's picture: its image, the note glyph, or its tint pattern.
struct LinkThumb: View {
    let link: LinkItem
    let image: CGImage?

    var body: some View {
        if let image {
            Image(decorative: image, scale: 1)
                .resizable()
                .widgetAccentedRenderingMode(.desaturated)
                .scaledToFill()
        } else if link.isNote {
            NoteThumb()
        } else {
            HeroFallback(tint: .fromHex(link.tint), stripe: .fromHex(link.stripe))
        }
    }
}

extension LinkItem {
    var widgetURL: URL? { URL(string: "anylink://link/\(id)") }
}

struct AddLinkControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "com.shaggspeare.anylink.add") {
            ControlWidgetButton(action: OpenAddLinkIntent()) {
                Label("Save clipboard link", systemImage: "link.badge.plus")
            }
        }
        .displayName("Save clipboard link")
        .description("Opens AnyLink to save the link you copied.")
    }
}
