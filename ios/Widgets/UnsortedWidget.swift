import SwiftUI
import WidgetKit
import DesignSystem
import Models

/// Lock Screen "Unsorted {n}" plus a small home-screen version. Tapping opens Triage.
struct UnsortedWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "Unsorted", provider: LibraryProvider(thumbnails: false)) { UnsortedView(entry: $0) }
            .configurationDisplayName("Unsorted")
            .description("Links waiting to be sorted. Tap to sort them.")
            .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

struct UnsortedView: View {
    @Environment(\.widgetFamily) private var family
    let entry: LibraryEntry

    private var count: Int { entry.summary?.unsorted ?? 0 }
    private var spoken: String { count > 0 ? "\(count.linkCount) in Unsorted" : "All sorted" }

    var body: some View {
        content
            .widgetURL(count > 0 ? URL(string: "anylink://triage") : nil)
            .containerBackground(for: .widget) { AL.paper }
    }

    @ViewBuilder private var content: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 0) {
                    Image(systemName: count > 0 ? "tray.full" : "checkmark")
                    if count > 0 { Text(count, format: .number).font(.headline) }
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(spoken)
        case .accessoryRectangular:
            VStack(alignment: .leading) {
                Label("Unsorted", systemImage: "tray.full").font(.headline).widgetAccentable()
                Text(count > 0 ? count.linkCount : "All sorted")
                if count > 0 { Text("Tap to sort").foregroundStyle(.secondary) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        case .accessoryInline:
            Label(count > 0 ? "\(count) unsorted" : "All sorted", systemImage: "tray.full")
        default:
            small
        }
    }

    private var small: some View {
        VStack(alignment: .leading, spacing: 0) {
            Image(systemName: count > 0 ? "tray.full.fill" : "checkmark")
                .font(.headline)
                .foregroundStyle(AL.onAccent)
                .frame(width: 36, height: 36)
                .background(AL.lime, in: Circle())
                .widgetAccentable()
                .accessibilityHidden(true)
            Spacer(minLength: AL.Space.s1)
            if count > 0 {
                Text(count, format: .number).font(AL.Font.hero).foregroundStyle(AL.ink)
                Text("in Unsorted").font(AL.Font.body).foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                Text("Sort now").font(AL.Font.chip).foregroundStyle(AL.signal).padding(.top, AL.Space.s1)
            } else {
                Text("All sorted").font(AL.Font.title).foregroundStyle(AL.ink)
                Text("New saves land here.").font(AL.Font.body).foregroundStyle(AL.ink.opacity(AL.Ink.a50))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

#Preview("Small", as: .systemSmall) { UnsortedWidget() } timeline: { LibraryEntry.sample; LibraryEntry.empty }
#Preview("Circular", as: .accessoryCircular) { UnsortedWidget() } timeline: { LibraryEntry.sample; LibraryEntry.empty }
#Preview("Rectangular", as: .accessoryRectangular) { UnsortedWidget() } timeline: { LibraryEntry.sample; LibraryEntry.empty }
#Preview("Inline", as: .accessoryInline) { UnsortedWidget() } timeline: { LibraryEntry.sample }
