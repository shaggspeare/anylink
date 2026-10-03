import SwiftUI
import DesignSystem
import Models
import QueryLanguage
import Store

// Placeholder destinations; each is replaced by its feature phase (see docs/08-build-plan.md).

struct RouteView: View {
    let route: Route
    @Environment(LibraryStore.self) private var store
    @Environment(Router.self) private var router

    var body: some View {
        content
            .toolbarVisibility(route.hidesTabBar ? .hidden : .automatic, for: .tabBar)
            .confirmDialogs(in: router.tab, top: route)
    }

    @ViewBuilder
    private var content: some View {
        switch route {
        case .link(let id):
            LinkDetailView(id: id)
        case .collection(let id):
            CollectionView(id: id)
        case .filter(let q, let title):
            FilterResultsView(query: q, title: title)
        case .trash:
            TrashView()
        case .triage:
            TriageView(store: store)
        case .settings:
            SettingsView()
        }
    }
}

struct PlaceholderScreen: View {
    let title: String
    let note: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(AL.Font.title).foregroundStyle(AL.ink)
            Text(note).font(AL.Font.lead).foregroundStyle(AL.ink.opacity(AL.Ink.a60))
            Spacer()
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background { ZStack { AL.canvas; Orbs(.inbox) }.ignoresSafeArea() }
    }
}

struct LinkListScreen: View {
    let title: String
    let links: [LinkItem]
    let orbs: OrbVariant
    @Environment(Router.self) private var router

    var body: some View {
        List {
            Text(title)
                .font(AL.Font.largeTitle).tracking(-1.65)
                .foregroundStyle(AL.ink)
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            if links.isEmpty {
                Text("Nothing here yet.")
                    .font(AL.Font.lead)
                    .foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                    .listRowBackground(Color.clear)
            }
            ForEach(links) { link in
                Button { router.open(.link(link.id)) } label: { LinkRow(link: link) }
                    .buttonStyle(.plain)
            }
        }
        .scrollContentBackground(.hidden)
        .background { ZStack { AL.canvas; Orbs(orbs) }.ignoresSafeArea() }
    }
}

// MARK: - Sheets

struct SheetHost: View {
    let sheet: SheetRoute
    @Environment(LibraryStore.self) var store
    @Environment(Router.self) var router
    @Environment(\.dismiss) var dismiss
    @State private var text = ""
    @State private var busy = false
    @AppStorage("defaultCollection") private var defaultCollectionRaw = "unsorted"
    private var defaultCollection: String? { store.collection(defaultCollectionRaw) == nil ? nil : defaultCollectionRaw }

    var body: some View {
        switch sheet {
        case .addLink(let prefill, let collectionID):
            AddLinkSheet(store: store, prefill: prefill, collectionID: collectionID ?? defaultCollection)
        case .newCollection:
            CollectionNameSheet()
        case .rename(let id):
            CollectionNameSheet(renaming: store.collection(id))
        default:
            standard
        }
    }

    private var standard: some View {
        NavigationStack {
            content
                .padding(16)
                .frame(maxHeight: .infinity, alignment: .top)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .interactiveDismissDisabled(busy)
    }

    @ViewBuilder
    private var content: some View {
        switch sheet {
        case .addLink:
            EmptyView()
        case .moveLinks(let ids):
            let current = Set(ids.compactMap { store.link($0)?.collectionId })
            List(store.collections.filter { $0.isSmart != true && !(current.count == 1 && current.contains($0.id)) }) { c in
                Button {
                    store.move(ids, to: c.id)
                    router.isSelecting = false
                    dismiss()
                } label: {
                    HStack(spacing: 10) {
                        Circle().fill(Color.fromHex(c.color)).frame(width: 10, height: 10)
                        Text(c.name).foregroundStyle(AL.ink)
                        Spacer()
                        Text("\(store.count(in: c.id))").foregroundStyle(.secondary)
                    }
                }
            }
            .listStyle(.plain)
            .padding(-16)
            .navigationTitle("Move \(ids.count) \(ids.count == 1 ? "link" : "links")")
            .navigationBarTitleDisplayMode(.inline)
        case .tagLinks(let ids):
            VStack(alignment: .leading, spacing: 12) {
                ALField("#tag", text: $text)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .onSubmit { applyTag(ids, text) }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(tagSuggestions(excluding: ids), id: \.self) { t in
                            Button { applyTag(ids, t) } label: { ScopeChip("#\(t)") }
                                .buttonStyle(.plain)
                        }
                    }
                }
                Button("Tag") { applyTag(ids, text) }
                    .buttonStyle(.alPrimary)
                    .disabled(text.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .navigationTitle("Tag \(ids.count) \(ids.count == 1 ? "link" : "links")")
            .navigationBarTitleDisplayMode(.inline)
        case .newCollection, .rename:
            EmptyView()
        }
    }
}

extension SheetHost {
    /// Most-used tags not already on every selected link.
    func tagSuggestions(excluding ids: Set<LinkItem.ID>) -> [String] {
        let selected = ids.compactMap { store.link($0) }
        var counts: [String: Int] = [:]
        for l in store.live { for t in l.tags { counts[t, default: 0] += 1 } }
        return counts.keys
            .filter { t in !selected.allSatisfy { $0.tags.contains(t) } }
            .sorted { (counts[$0]!, $1) > (counts[$1]!, $0) }
            .prefix(8).map { $0 }
    }

    func applyTag(_ ids: Set<LinkItem.ID>, _ tag: String) {
        let t = tag.trimmingCharacters(in: .whitespaces)
        guard !t.isEmpty else { return }
        store.tag(ids, t)
        router.isSelecting = false
        dismiss()
    }
}

// MARK: - Confirmations

extension View {
    /// Presents from the screen on top: the tab root when its path is empty, else the pushed route that is last.
    func confirmDialogs(in tab: AppTab, top route: Route? = nil) -> some View { modifier(ConfirmDialogs(tab: tab, route: route)) }
}

private struct ConfirmDialogs: ViewModifier {
    let tab: AppTab
    let route: Route?
    @Environment(LibraryStore.self) private var store
    @Environment(Router.self) private var router

    func body(content: Content) -> some View {
        @Bindable var router = router
        content.confirmationDialog(
            title, isPresented: Binding(get: { router.confirm != nil && router.tab == tab && router.path(tab).last == route }, set: { if !$0 { router.confirm = nil } }),
            titleVisibility: .visible, presenting: router.confirm
        ) { confirm in
            Button(action(confirm), role: .destructive) { perform(confirm) }
        } message: { confirm in
            Text(message(confirm))
        }
        .sensoryFeedback(.warning, trigger: router.confirm) { _, new in new != nil }
    }

    private var title: String {
        switch router.confirm {
        case .trash(let ids): "Delete \(ids.count) \(ids.count == 1 ? "link" : "links")?"
        case .dissolve: "Dissolve collection?"
        case .emptyTrash: "Empty Trash?"
        case .deleteForever: "Delete forever?"
        case .deleteAccount: "Delete your account?"
        case nil: ""
        }
    }

    private func message(_ c: Confirm) -> String {
        switch c {
        case .trash: "They move to Trash. You can restore them from there."
        case .dissolve: "Dissolving moves its links back to Unsorted and deletes the collection."
        case .emptyTrash(let n): "\(n) links will be deleted for good."
        case .deleteForever: "This link and its saved image are removed for good."
        case .deleteAccount: "Your library, collections and notes are deleted from every device. This can't be undone."
        }
    }

    private func action(_ c: Confirm) -> String {
        switch c {
        case .trash: "Move to Trash"
        case .dissolve: "Dissolve collection"
        case .emptyTrash: "Empty Trash"
        case .deleteForever: "Delete forever"
        case .deleteAccount: "Delete account"
        }
    }

    private func perform(_ c: Confirm) {
        switch c {
        case .trash(let ids):
            store.trash(ids)
            router.isSelecting = false
        case .dissolve(let id):
            store.dissolve(id)
            if case .collection(id) = router.path(router.tab).last { router.setPath(router.tab, router.path(router.tab).dropLast()) }
        case .emptyTrash:
            store.emptyTrash()
        case .deleteForever(let ids):
            store.purge(ids)
        case .deleteAccount:
            Task {
                guard await store.deleteAccount() else { return }
                router.setPath(router.tab, [])
                router.tab = .library
                UserDefaults.standard.set(false, forKey: "onboarded")
                UserDefaults.standard.set(false, forKey: "signedIn")
            }
        }
    }
}
