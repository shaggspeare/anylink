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
    }

    @ViewBuilder
    private var content: some View {
        switch route {
        case .link(let id):
            PlaceholderScreen(title: store.link(id)?.title ?? "Link", note: "Reader and product pages arrive in phase 6.")
        case .collection(let id):
            LinkListScreen(title: store.name(of: id), links: store.links(in: id), orbs: .collection(.fromHex(store.collection(id)?.color ?? "#9AA3AD")))
                .toolbar {
                    if store.collection(id)?.isInbox != true {
                        Menu("More", systemImage: "ellipsis") {
                            Button("Rename", systemImage: "pencil") { router.sheet = .rename(id) }
                            Button("Dissolve", systemImage: "trash", role: .destructive) { router.confirm = .dissolve(id) }
                        }
                    }
                }
        case .filter(let q, let title):
            LinkListScreen(title: title, links: store.links(matching: q), orbs: .library)
        case .trash:
            LinkListScreen(title: "Trash", links: store.trash, orbs: .inbox)
                .toolbar {
                    if !store.trash.isEmpty {
                        Button("Empty") { router.confirm = .emptyTrash(count: store.trash.count) }
                    }
                }
        case .triage:
            PlaceholderScreen(title: "Sort Unsorted", note: "Triage arrives in phase 9.")
        case .settings:
            PlaceholderScreen(title: "Settings", note: "Settings arrive in phase 7.")
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
    @Environment(LibraryStore.self) private var store
    @Environment(Router.self) private var router
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var busy = false

    var body: some View {
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
        case .addLink(let prefill, let collectionID):
            VStack(alignment: .leading, spacing: 12) {
                ALField("https://", text: $text, isURL: true)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
                    .onAppear { text = prefill?.absoluteString ?? "" }
                Notice("The full Add sheet with live reading arrives in phase 5.")
                Button("Save") {
                    busy = true
                    Task {
                        await store.save(LinkDraft(url: text, collectionId: collectionID))
                        dismiss()
                    }
                }
                .buttonStyle(.alSignal)
                .disabled(URL(string: text)?.host() == nil || busy)
            }
            .navigationTitle("New link")
        case .moveLinks(let ids):
            List(store.collections.filter { $0.isSmart != true }) { c in
                Button {
                    store.move(ids, to: c.id)
                    router.isSelecting = false
                    dismiss()
                } label: {
                    Label { Text(c.name) } icon: { Circle().fill(Color.fromHex(c.color)).frame(width: 10, height: 10) }
                }
            }
            .navigationTitle("Move \(ids.count) \(ids.count == 1 ? "link" : "links")")
        case .tagLinks(let ids):
            VStack(spacing: 12) {
                ALField("#tag", text: $text)
                    .textInputAutocapitalization(.never)
                Button("Tag") { store.tag(ids, text); dismiss() }
                    .buttonStyle(.alPrimary)
                    .disabled(text.isEmpty)
            }
            .navigationTitle("Tag")
        case .newCollection:
            VStack(spacing: 12) {
                ALField("Name", text: $text)
                Button("Create") {
                    busy = true
                    Task {
                        _ = await store.createCollection(name: text, color: "#7C8CFF")
                        dismiss()
                    }
                }
                .buttonStyle(.alPrimary)
                .disabled(text.isEmpty || busy)
            }
            .navigationTitle("New collection")
        case .rename(let id):
            VStack(spacing: 12) {
                ALField("Name", text: $text)
                    .onAppear { text = store.name(of: id) }
                Button("Rename") { store.rename(id, to: text); dismiss() }
                    .buttonStyle(.alPrimary)
                    .disabled(text.isEmpty)
            }
            .navigationTitle("Rename")
        }
    }
}

// MARK: - Confirmations

extension View {
    func confirmDialogs() -> some View { modifier(ConfirmDialogs()) }
}

private struct ConfirmDialogs: ViewModifier {
    @Environment(LibraryStore.self) private var store
    @Environment(Router.self) private var router

    func body(content: Content) -> some View {
        @Bindable var router = router
        content.confirmationDialog(
            title, isPresented: Binding(get: { router.confirm != nil }, set: { if !$0 { router.confirm = nil } }),
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
            break // Phase 7 (Settings) wires this to the API and signs out.
        }
    }
}
