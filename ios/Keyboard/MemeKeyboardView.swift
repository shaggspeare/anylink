import SwiftUI
import UIKit
import UniformTypeIdentifiers
import DesignSystem
import Models
import Persistence

/// The newest saved images in a grid, filtered by tag. Tap → on the clipboard → paste in the box above.
struct MemeKeyboardView: View {
    let hasFullAccess: Bool
    let nextKeyboard: () -> Void
    let deleteBackward: () -> Void

    @State private var images: [LinkItem] = []
    @State private var tag: String?
    @State private var toast: String?

    private var tags: [String] {
        let counts = images.flatMap(\.tags).reduce(into: [String: Int]()) { $0[$1, default: 0] += 1 }
        return counts.sorted { $0.value > $1.value || ($0.value == $1.value && $0.key < $1.key) }.prefix(8).map(\.key)
    }
    private var shown: [LinkItem] { tag.map { t in images.filter { $0.tags.contains(t) } } ?? images }

    var body: some View {
        VStack(spacing: 8) {
            bar
            if !hasFullAccess { fullAccess }
            else if images.isEmpty { empty }
            else { grid }
        }
        .padding(.horizontal, 8)
        .padding(.top, 8)
        .padding(.bottom, 4)
        .background(AL.canvas)
        .overlay(alignment: .bottom) {
            if let toast {
                Text(toast).font(AL.Font.rowTitle).foregroundStyle(AL.onAccent)
                    .padding(.horizontal, 16).padding(.vertical, 10)
                    .background(AL.lime, in: Capsule())
                    .padding(.bottom, 16)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .task { if hasFullAccess { images = ImageLibrary.links() } }
    }

    private var bar: some View {
        HStack(spacing: 8) {
            Button(action: nextKeyboard) { Image(systemName: "globe").font(.body.weight(.semibold)) }
                .buttonStyle(.bordered).tint(AL.ink)
                .accessibilityLabel(Text("Next keyboard"))
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    chip("All", selected: tag == nil) { tag = nil }
                    ForEach(tags, id: \.self) { t in chip(t, selected: tag == t) { tag = t } }
                }
            }
            Button(action: deleteBackward) { Image(systemName: "delete.left").font(.body.weight(.semibold)) }
                .buttonStyle(.bordered).tint(AL.ink)
                .accessibilityLabel(Text("Delete"))
        }
    }

    private func chip(_ label: LocalizedStringKey, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label).font(AL.Font.meta.weight(.semibold))
                .padding(.horizontal, 12).padding(.vertical, 7)
                .background(selected ? AL.ink : AL.paper, in: Capsule())
                .foregroundStyle(selected ? AL.paper : AL.ink)
        }
        .buttonStyle(.plain)
    }

    private func chip(_ tag: String, selected: Bool, action: @escaping () -> Void) -> some View {
        chip(LocalizedStringKey(stringLiteral: tag), selected: selected, action: action)
    }

    private var grid: some View {
        ScrollView {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 4), spacing: 6) {
                ForEach(shown) { link in
                    Button { Task { await copy(link) } } label: {
                        Thumb(link: link)
                            .frame(maxWidth: .infinity)
                            .aspectRatio(1, contentMode: .fit)
                            .clipShape(RoundedRectangle(cornerRadius: AL.Radius.nav, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(Text("Copy \(link.title)"))
                }
            }
        }
    }

    private var empty: some View {
        VStack(spacing: 6) {
            Text("No images yet").font(AL.Font.rowTitle).foregroundStyle(AL.ink)
            Text("Save a meme or a screenshot in AnyLink and it shows up here.")
                .font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a50)).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var fullAccess: some View {
        VStack(spacing: 6) {
            Text("Allow Full Access").font(AL.Font.rowTitle).foregroundStyle(AL.ink)
            Text("The keyboard needs Full Access to reach your library and the clipboard: Settings → General → Keyboard → Keyboards → AnyLink Memes.")
                .font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a50)).multilineTextAlignment(.center)
        }
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @MainActor
    private func copy(_ link: LinkItem) async {
        var message: LocalizedStringResource = "Couldn't copy that one"
        if let data = await ImageLibrary.data(for: link) {
            if LocalImages.isGIF(data) {
                UIPasteboard.general.setData(data, forPasteboardType: UTType.gif.identifier)
                message = "Copied. Now paste it."
            } else if let image = UIImage(data: data) {
                UIPasteboard.general.image = image
                message = "Copied. Now paste it."
            }
        }
        withAnimation(AL.Motion.settle) { toast = String(localized: message) }
        try? await Task.sleep(for: .seconds(1.6))
        withAnimation(AL.Motion.settle) { toast = nil }
    }
}

/// A small, downsampled thumbnail: a keyboard has a fraction of an app's memory.
private struct Thumb: View {
    let link: LinkItem
    @State private var image: CGImage?

    var body: some View {
        ZStack {
            AL.docShell
            if let image {
                Image(decorative: image, scale: 1).resizable().aspectRatio(contentMode: .fill)
            }
        }
        .clipped()
        .task(id: link.id) {
            guard let url = LocalImages.existing(for: link.id) ?? (link.heroImage ?? link.url).nilIfEmpty.flatMap(URL.init(string:)) else { return }
            image = try? await ImageLoader.shared.image(for: url, maxPixels: 240)
        }
    }
}
