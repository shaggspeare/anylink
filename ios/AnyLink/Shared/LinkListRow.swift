import SwiftUI
import DesignSystem
import Models
import Store

/// A `LinkRow` inside a `List`: tap opens, S7 menu, rotor actions, Favorite / Move / Trash swipes.
struct LinkListRow: View {
    let link: LinkItem
    var meta: String?
    @Environment(LibraryStore.self) private var store
    @Environment(Router.self) private var router

    var body: some View {
        Button { router.open(.link(link.id)) } label: { LinkRow(link: link, meta: meta) }
            .buttonStyle(.plain)
            .allowsHitTesting(!router.isSelecting)   // not .disabled: that greys every row out in select mode
            .tag(link.id)
            .listRowBackground(Color.clear.frosted(0.62, radius: 0, rim: 0))
            .linkActions(link)
            .swipeActions(edge: .leading) {
                Button(link.favorite == true ? "Unfavorite" : "Favorite", systemImage: "star") {
                    store.setFavorite(link.id, link.favorite != true)
                }
                .tint(AL.signal)
            }
            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                Button("Trash", systemImage: "trash", role: .destructive) { store.trash([link.id]) }
                Button("Move", systemImage: "folder") { router.sheet = .moveLinks([link.id]) }
                    .tint(AL.periwinkle)
            }
            .accessibilityIdentifier("row-\(link.id)")
    }
}

/// Select-mode navigation and bottom toolbar (S6), shared by Library and Collection.
struct SelectionToolbar: ToolbarContent {
    let links: [LinkItem]
    let store: LibraryStore
    let router: Router

    var body: some ToolbarContent {
        let ids = router.selection
        let allSelected = !links.isEmpty && ids.count == links.count
        ToolbarItem(placement: .topBarLeading) {
            Button(allSelected ? "Deselect All" : "Select All") {
                router.selection = allSelected ? [] : Set(links.map(\.id))
            }
        }
        ToolbarItem(placement: .principal) {
            Text("\(ids.count) Selected").font(.headline)
        }
        ToolbarItem(placement: .topBarTrailing) {
            Button("Done") { router.isSelecting = false }
                .buttonStyle(.glassProminent)
                .foregroundStyle(AL.onInk)
                .tint(AL.ink)
        }
        ToolbarItemGroup(placement: .bottomBar) {
            Button("Move", systemImage: "folder") { router.sheet = .moveLinks(ids) }
                .disabled(ids.isEmpty)
            Button("Tag", systemImage: "tag") { router.sheet = .tagLinks(ids) }
                .disabled(ids.isEmpty)
            Button("Archive", systemImage: "archivebox") {
                store.archive(ids)
                router.isSelecting = false
            }
            .disabled(ids.isEmpty)
            Spacer()
            Button("Trash", systemImage: "trash", role: .destructive) { router.confirm = .trash(ids) }
                .tint(AL.destructive)
                .disabled(ids.isEmpty)
        }
    }
}

/// List section header at the raised secondary alpha (the system grey misses 4.5:1 over the orbs).
struct SectionHeader: View {
    let title: String
    init(_ title: String) { self.title = title }
    var body: some View {
        Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(AL.ink.opacity(AL.Ink.a60)).textCase(nil)
    }
}
