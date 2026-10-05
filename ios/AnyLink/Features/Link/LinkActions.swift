import SwiftUI
import UIKit
import DesignSystem
import Models
import Store

extension View {
    /// S7 context menu + the four VoiceOver rotor actions. Off in select mode.
    func linkActions(_ link: LinkItem) -> some View { modifier(LinkActions(link: link)) }
}

private struct LinkActions: ViewModifier {
    let link: LinkItem
    @Environment(LibraryStore.self) private var store
    @Environment(Router.self) private var router

    func body(content: Content) -> some View {
        Group {
            if router.isSelecting {
                content
            } else {
                content.contextMenu { LinkMenuItems(link: link) } preview: {
                    LinkPreviewCard(link: link, collection: store.name(of: link.collectionId))
                }
            }
        }
        .accessibilityAction(named: link.isNote ? "Open" : "Open original") {
            if link.isNote { router.open(.link(link.id)) } else { router.openOriginal = URL(string: link.url) }
        }
        .accessibilityAction(named: link.favorite == true ? "Unfavorite" : "Favorite") { store.setFavorite(link.id, link.favorite != true) }
        .accessibilityAction(named: link.pinned == true ? "Unpin" : "Pin to top") { store.setPinned(link.id, link.pinned != true) }
        .accessibilityAction(named: "Move") { router.sheet = .moveLinks([link.id]) }
        .accessibilityAction(named: "Move to Trash") { store.trash([link.id]) }
    }
}

/// S7 items, shared by the context menu and the detail screens' ⋯ menu.
struct LinkMenuItems: View {
    let link: LinkItem
    var inDetail = false
    @Environment(LibraryStore.self) private var store
    @Environment(Router.self) private var router

    private var url: URL? { URL(string: link.url) }
    private var isFavorite: Bool { link.favorite == true }

    var body: some View {
        // Detail screens already show Open, Share and the collection chip, so their ⋯ menu skips those.
        if !inDetail {
            if link.isNote {
                ShareLink(item: link.excerpt) { Label("Share…", systemImage: "square.and.arrow.up") }
            } else {
                Button(link.isImage ? "Open Full Size" : "Open Original", systemImage: "arrow.up.right") { router.openOriginal = url }
                if let url = link.isImage ? LocalImages.existing(for: link.id) ?? url : url {
                    ShareLink(item: url) { Label("Share…", systemImage: "square.and.arrow.up") }
                }
            }
        }
        Button(link.pinned == true ? "Unpin" : "Pin to top", systemImage: link.pinned == true ? "pin.slash" : "pin") {
            store.setPinned(link.id, link.pinned != true)
        }
        if link.isNote {
            Button("Copy Text", systemImage: "doc.on.doc") {
                UIPasteboard.general.string = link.excerpt
                store.toasts.show("Text copied")
            }
        } else if !link.isImage {
            Button("Copy Link", systemImage: "doc.on.doc") {
                UIPasteboard.general.url = url
                store.toasts.show(url == nil ? "Couldn't copy the link" : "Link copied")
            }
        }
        if !inDetail {
            Divider()
            Menu {
                ForEach(store.collections.filter { $0.isSmart != true && $0.id != link.collectionId }) { c in
                    Button { store.move([link.id], to: c.id) } label: {
                        Label { Text(c.name) } icon: { Image(systemName: "circle.fill").foregroundStyle(Color.fromHex(c.color)) }
                    }
                }
            } label: {
                Label("Move to…", systemImage: "folder")
            }
            Button(isFavorite ? "Unfavorite" : "Favorite", systemImage: isFavorite ? "star.slash" : "star") {
                store.setFavorite(link.id, !isFavorite)
            }
            Button("Select", systemImage: "checkmark.circle") { router.beginSelecting(with: link.id) }
        }
        Divider()
        Button("Move to Trash", systemImage: "trash", role: .destructive) {
            store.trash([link.id])
            if inDetail { router.setPath(router.tab, router.path(router.tab).dropLast()) }
        }
    }
}

/// S7 preview: 310 wide, paper, hero 140, "domain · meta · collection", title 17/600, 2-line excerpt.
struct LinkPreviewCard: View {
    let link: LinkItem
    let collection: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if !link.isNote { HeroImage(link: link).frame(height: link.isImage ? 220 : 140).clipped() }
            VStack(alignment: .leading, spacing: 6) {
                Text([link.sourceLabel, link.readingMeta, collection].compactMap { $0 }.joined(separator: " · "))
                    .font(AL.Font.meta)
                    .foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                Text(link.title)
                    .font(AL.Font.brand(17, .semibold, relativeTo: .headline))
                    .foregroundStyle(AL.ink)
                    .lineLimit(3)
                if !link.excerpt.isEmpty {
                    Text(link.excerpt)
                        .font(AL.Font.body)
                        .foregroundStyle(AL.ink.opacity(AL.Ink.a60))
                        .lineLimit(link.isNote ? 8 : 2)
                }
            }
            .padding(.horizontal, 14)
            .padding(.bottom, 14)
        }
        .frame(width: 310)
        .background(AL.paper)
    }
}
