import SwiftUI
import WebKit
import DesignSystem
import Models
import Store
import Fixtures

/// The video template's player (04-screens S15). The page wraps the player in an iframe so the video site gets a
/// referrer, which YouTube needs to play an embed. Nothing persists: no cookies or storage outlive the screen.
struct VideoWebView: UIViewRepresentable {
    /// From `TemplateData.embedURL`, whose id check keeps it safe inside the attribute below.
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.websiteDataStore = .nonPersistent()
        let view = WKWebView(frame: .zero, configuration: config)
        view.isOpaque = false
        view.backgroundColor = .clear
        view.scrollView.isScrollEnabled = false
        view.loadHTMLString(Self.page(url), baseURL: AppConfig.apiBase ?? URL(string: "https://www.anylink.space"))
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {}

    static func page(_ url: URL) -> String {
        """
        <!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
        <style>html,body{margin:0;height:100%;background:black}iframe{border:0;width:100%;height:100%}</style>
        <iframe src="\(url.absoluteString)" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>
        """
    }
}

/// The recipe template: times, a checklist of ingredients and numbered steps. Ticks last while the screen is open.
struct RecipeCard: View {
    let data: TemplateData
    @State private var ticked: Set<Int> = []
    @ScaledMetric(relativeTo: .footnote) private var disc: CGFloat = 26

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            if !data.recipeTimes.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(data.recipeTimes, id: \.self) { time in
                            Text(time)
                                .font(AL.Font.chip).foregroundStyle(AL.ink)
                                .padding(.horizontal, 12).frame(minHeight: 32)
                                .background(AL.ink.opacity(AL.Ink.a06), in: Capsule())
                        }
                    }
                }
                .padding(.horizontal, -20)
                .contentMargins(.horizontal, 20, for: .scrollContent)
            }
            if let items = data.ingredients, !items.isEmpty {
                VStack(alignment: .leading, spacing: 0) {
                    heading("Ingredients")
                    ForEach(Array(items.enumerated()), id: \.offset) { i, item in ingredient(item, ticked: ticked.contains(i)) { toggle(i) } }
                }
            }
            if let steps = data.steps, !steps.isEmpty {
                VStack(alignment: .leading, spacing: 14) {
                    heading("Steps")
                    ForEach(Array(steps.enumerated()), id: \.offset) { i, step in
                        HStack(alignment: .firstTextBaseline, spacing: 12) {
                            Text("\(i + 1)")
                                .font(AL.Font.chip).monospacedDigit().foregroundStyle(AL.onInk)
                                .frame(width: disc, height: disc)
                                .background(AL.ink, in: Circle())
                            Text(step)
                                .font(AL.Font.readerBody).foregroundStyle(AL.ink.opacity(AL.Ink.a85))
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
            }
        }
    }

    private func heading(_ title: String) -> some View {
        Text(title).font(AL.Font.rowTitle).foregroundStyle(AL.ink).accessibilityAddTraits(.isHeader)
    }

    private func ingredient(_ item: String, ticked: Bool, toggle: @escaping () -> Void) -> some View {
        Button(action: toggle) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Image(systemName: ticked ? "checkmark.circle.fill" : "circle")
                    .symbolRenderingMode(.palette)
                    .foregroundStyle(ticked ? AL.onAccent : AL.ink.opacity(AL.Ink.a30), ticked ? AL.lime : AL.ink.opacity(AL.Ink.a30))
                Text(item)
                    .strikethrough(ticked)
                    .foregroundStyle(AL.ink.opacity(ticked ? AL.Ink.a45 : AL.Ink.a85))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .font(AL.Font.readerBody)
            .frame(minHeight: AL.Control.md)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(item)
        .accessibilityAddTraits(ticked ? .isSelected : [])
        .accessibilityHint("Ticks it off")
    }

    private func toggle(_ i: Int) {
        if ticked.contains(i) { ticked.remove(i) } else { ticked.insert(i) }
    }
}

// The player has no preview of its own: it would load the video site. The reader's video previews show its poster.

@MainActor
private func recipePreview() -> some View {
    ScrollView {
        if let data = Fixtures.links.first(where: { $0.id == "ramen" })?.templateData { RecipeCard(data: data).padding(20) }
    }
    .background(AL.canvas)
}

#Preview("Recipe card") { recipePreview() }
#Preview("Recipe card — Dark") { recipePreview().preferredColorScheme(.dark) }
