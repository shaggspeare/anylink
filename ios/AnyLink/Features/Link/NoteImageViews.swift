import SwiftUI
import UIKit
import DesignSystem
import Models
import Store

private func savedOn(_ link: LinkItem) -> String {
    (try? Date(link.createdAt, strategy: .iso8601))?.formatted(date: .abbreviated, time: .omitted) ?? ""
}

/// A note reads like a page and edits in place: tap the text (not a link in it) or Edit.
/// Links open in the in-app Safari, like Open on a link.
struct NoteView: View {
    let link: LinkItem
    @Environment(LibraryStore.self) private var store
    @Environment(Router.self) private var router
    @State private var editing = false
    @State private var draft = ""
    @FocusState private var focused: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 8) {
                    Label("Note", systemImage: "text.alignleft")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(AL.onAccent)
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .background(AL.lime, in: Capsule())
                    Text(savedOn(link)).font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                    Spacer()
                    Text(store.name(of: link.collectionId)).font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                }
                page
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 40)
        }
        .scrollDismissesKeyboard(.interactively)
        .background { ZStack { AL.canvas; Orbs(.reader) }.ignoresSafeArea() }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { toolbar }
        .onChange(of: focused) { _, isFocused in if !isFocused { commit() } }
    }

    private var page: some View {
        Group {
            if editing {
                TextEditor(text: $draft)
                    .focused($focused)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 280)
                    .accessibilityLabel("Note text")
            } else {
                Text(linkified(link.excerpt))
                    .textSelection(.enabled)
                    // Links in the note open like Open on a link: in-app Safari, per Settings.
                    .environment(\.openURL, OpenURLAction { url in
                        router.openOriginal = url
                        return .handled
                    })
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                    .onTapGesture(perform: beginEdit)
                    .accessibilityHint("Double-tap Edit to change it")
            }
        }
        .font(AL.Font.brand(18, .regular, relativeTo: .body))
        .lineSpacing(5)
        .foregroundStyle(AL.ink)
        .padding(.horizontal, 22)
        .padding(.vertical, 24)
        .frosted(0.7, radius: AL.Radius.panel)
        .overlay(alignment: .topTrailing) {
            NoteFold(size: 34).clipShape(UnevenRoundedRectangle(topTrailingRadius: AL.Radius.panel))
        }
        .alShadow(AL.Shadow.card)
    }

    private func beginEdit() {
        draft = link.excerpt
        editing = true
        focused = true
    }

    private func commit() {
        guard editing else { return }
        editing = false
        store.setNoteText(link.id, draft)
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItemGroup(placement: .topBarTrailing) {
            Button { store.setFavorite(link.id, link.favorite != true) } label: {
                Image(systemName: link.favorite == true ? "star.fill" : "star")
                    .foregroundStyle(link.favorite == true ? AL.signal : AL.ink)
            }
            .accessibilityLabel(link.favorite == true ? "Unfavorite" : "Favorite")
            Menu { LinkMenuItems(link: link, inDetail: true) } label: { Image(systemName: "ellipsis") }
                .accessibilityLabel("More")
        }
        ToolbarItemGroup(placement: .bottomBar) {
            ShareLink(item: link.excerpt) { Label("Share", systemImage: "square.and.arrow.up") }
            Spacer()
            Button { editing ? commit() : beginEdit() } label: {
                Text(editing ? "Done" : "Edit").fontWeight(.semibold).foregroundStyle(AL.onAccent)
            }
            .buttonStyle(.glassProminent)
            .tint(AL.lime)
        }
    }
}

/// The image at its own aspect on a dark mat, pinch or double-tap to zoom, caption under it.
struct ImageDetailView: View {
    let link: LinkItem
    @Environment(LibraryStore.self) private var store
    @Environment(Router.self) private var router
    @Environment(\.displayScale) private var displayScale
    @State private var image: CGImage?
    @State private var failed = false
    @State private var zoom: CGFloat = 1
    @GestureState private var pinch: CGFloat = 1

    /// The local copy when this device has one, the uploaded file otherwise.
    private var source: URL? { LocalImages.existing(for: link.id) ?? link.heroImage.flatMap(URL.init(string:)) }
    private var remote: URL? { link.url.isEmpty ? nil : URL(string: link.url) }

    var body: some View {
        VStack(spacing: 0) {
            ZStack {
                AL.docShell
                if let image {
                    Image(decorative: image, scale: displayScale)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .scaleEffect(zoom * pinch)
                        .gesture(MagnifyGesture().updating($pinch) { v, s, _ in s = v.magnification }
                            .onEnded { v in withAnimation(AL.Motion.settle) { zoom = min(4, max(1, zoom * v.magnification)) } })
                        .onTapGesture(count: 2) { withAnimation(AL.Motion.settle) { zoom = zoom > 1 ? 1 : 2.5 } }
                        .accessibilityLabel(link.title)
                        .accessibilityAddTraits(.isImage)
                } else if failed {
                    ContentUnavailableView("Couldn't load the image", systemImage: "photo")
                        .foregroundStyle(.white)
                } else {
                    ProgressView().tint(.white)
                }
            }
            .clipped()
            HStack(spacing: 8) {
                Image(systemName: "photo").font(.footnote.weight(.bold)).foregroundStyle(AL.periwinkle)
                Text(link.title).font(AL.Font.rowTitle).foregroundStyle(AL.ink).lineLimit(1)
                Spacer()
                Text(savedOn(link)).font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a50))
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 14)
            .background(AL.canvas)
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { toolbar }
        .task(id: source) {
            guard let source else { failed = true; return }
            // Full stored size (both copies are capped at 2400 px): enough to zoom into a screenshot's text.
            do { image = try await ImageLoader.shared.image(for: source, maxPixels: 2400) } catch { failed = true }
        }
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItemGroup(placement: .topBarTrailing) {
            Button { store.setFavorite(link.id, link.favorite != true) } label: {
                Image(systemName: link.favorite == true ? "star.fill" : "star")
                    .foregroundStyle(link.favorite == true ? AL.signal : AL.ink)
            }
            .accessibilityLabel(link.favorite == true ? "Unfavorite" : "Favorite")
            Menu { LinkMenuItems(link: link, inDetail: true) } label: { Image(systemName: "ellipsis") }
                .accessibilityLabel("More")
        }
        ToolbarItemGroup(placement: .bottomBar) {
            if let file = LocalImages.existing(for: link.id) ?? remote {
                ShareLink(item: file) { Label("Share", systemImage: "square.and.arrow.up") }
            }
            Spacer()
            if let image {
                Button {
                    UIPasteboard.general.image = UIImage(cgImage: image)
                    store.toasts.show("Image copied")
                } label: { Text("Copy").fontWeight(.semibold).foregroundStyle(AL.onAccent) }
                .buttonStyle(.glassProminent)
                .tint(AL.periwinkle)
            }
        }
    }
}
