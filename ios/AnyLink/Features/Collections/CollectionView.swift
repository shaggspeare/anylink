import SwiftUI
import DesignSystem
import Models
import QueryLanguage
import Networking
import Fixtures
import Store

/// S11.
struct CollectionView: View {
    let id: LinkCollection.ID
    @Environment(LibraryStore.self) private var store
    @Environment(Router.self) private var router
    @AppStorage("keptCollections") private var keptRaw = ""
    @State private var tag: String?

    private var collection: LinkCollection? { store.collection(id) }
    private var isInbox: Bool { collection?.isInbox == true }
    private var all: [LinkItem] { store.links(in: id) }
    private var shown: [LinkItem] { tag.map { t in all.filter { $0.tags.contains(t) } } ?? all }
    private var kept: Set<String> { Set(keptRaw.split(separator: ",").map(String.init)) }
    private var showsWhy: Bool {
        collection?.createdBy == "system" && collection?.reasoning?.isEmpty == false && !kept.contains(id)
    }

    var body: some View {
        @Bindable var router = router
        List(selection: $router.selection) {
            header
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
                .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 8, trailing: 16))
                .selectionDisabled()
            if shown.isEmpty {
                Text("Nothing here yet — paste a link to save your first one into this collection.")
                    .font(AL.Font.lead)
                    .foregroundStyle(AL.ink.opacity(AL.Ink.a55))
                    .listRowBackground(Color.clear)
                    .selectionDisabled()
            } else {
                Section { ForEach(shown) { LinkListRow(link: $0) } }
            }
        }
        .scrollContentBackground(.hidden)
        .environment(\.editMode, .constant(router.isSelecting ? .active : .inactive))
        .background {
            ZStack { AL.canvas; Orbs(isInbox ? .inbox : .collection(.fromHex(collection?.color ?? "#9AA3AD"))) }.ignoresSafeArea()
        }
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(router.isSelecting)
        .toolbar {
            if router.isSelecting {
                SelectionToolbar(links: shown, store: store, router: router)
            } else {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button("Select") { router.beginSelecting() }.disabled(shown.isEmpty)
                    if !isInbox {
                        Menu {
                            Button("Rename", systemImage: "pencil") { router.sheet = .rename(id) }
                            Button("Dissolve", systemImage: "trash", role: .destructive) { router.confirm = .dissolve(id) }
                        } label: { Image(systemName: "ellipsis") }
                        .accessibilityLabel("More")
                    }
                }
            }
        }
        .toolbarVisibility(router.isSelecting ? .hidden : .automatic, for: .tabBar)
        .onDisappear { if router.isSelecting { router.isSelecting = false } }
    }

    @ViewBuilder
    private var header: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 10) {
                    Circle().fill(isInbox ? AL.slate : .fromHex(collection?.color ?? "#9AA3AD")).frame(width: 12, height: 12)
                    Text(collection?.name ?? "Collection")
                        .font(AL.Font.largeTitle).tracking(-1.65)
                        .foregroundStyle(AL.ink)
                        .accessibilityAddTraits(.isHeader)
                }
                Text(subtitle).font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a55))
            }
            if showsWhy, let reasoning = collection?.reasoning {
                WhyCard(
                    reasoning: reasoning,
                    onKeep: {
                        keptRaw = kept.union([id]).sorted().joined(separator: ",")
                        // BACKEND: no endpoint for "keep"; it's remembered per device and logged as a signal.
                        store.signals.log("keep", collectionId: id)
                    },
                    onRename: { router.sheet = .rename(id) },
                    onDissolve: { router.confirm = .dissolve(id) }
                )
            }
            if isInbox && !all.isEmpty {
                Button("Sort \(all.count) links one by one") { router.open(.triage) }
                    .buttonStyle(.alSignal)
            }
            let tags = store.tags(in: id)
            if !tags.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        Button { tag = nil } label: { ScopeChip("All", isSelected: tag == nil) }
                        ForEach(tags, id: \.self) { t in
                            Button { tag = t } label: { ScopeChip("#\(t)", isSelected: tag == t) }
                        }
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, 16)
                }
                .padding(.horizontal, -16)
                .sensoryFeedback(.selection, trigger: tag)
            }
        }
    }

    private var subtitle: String {
        let n = "\(all.count) \(all.count == 1 ? "link" : "links")"
        if isInbox { return "\(n) · new links land here" }
        if collection?.createdBy == "system" { return "\(n) · made during import" }
        return n
    }
}

/// S12.
struct FilterResultsView: View {
    let query: Query
    let title: String
    @Environment(LibraryStore.self) private var store

    var body: some View {
        let links = store.links(matching: query)
        List {
            VStack(alignment: .leading, spacing: 10) {
                Text(title).font(AL.Font.largeTitle).tracking(-1.65).foregroundStyle(AL.ink).accessibilityAddTraits(.isHeader)
                HStack(spacing: 8) {
                    Text(query.string)
                        .font(.caption.monospaced())
                        .foregroundStyle(AL.onInk)
                        .padding(.horizontal, 10).frame(height: 24)
                        .background(AL.ink, in: Capsule())
                    Text("\(links.count) links").font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a55))
                }
            }
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
            if links.isEmpty {
                Text("No links match this filter.")
                    .font(AL.Font.lead).foregroundStyle(AL.ink.opacity(AL.Ink.a55))
                    .listRowBackground(Color.clear)
            } else {
                Section {
                    ForEach(links) { LinkListRow(link: $0, meta: "\($0.domain) · \(store.name(of: $0.collectionId))") }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background { ZStack { AL.canvas; Orbs(.library) }.ignoresSafeArea() }
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// S17.
struct TrashView: View {
    @Environment(LibraryStore.self) private var store
    @Environment(Router.self) private var router

    var body: some View {
        let sections = store.trashSections()
        List {
            VStack(alignment: .leading, spacing: 4) {
                Text("Trash").font(AL.Font.largeTitle).tracking(-1.65).foregroundStyle(AL.ink).accessibilityAddTraits(.isHeader)
                Text("\(store.trash.count) links · they stay here until you delete them")
                    .font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a55))
            }
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
            if sections.isEmpty {
                Text("Nothing here. Deleted links land in Trash until you empty it.")
                    .font(AL.Font.lead).foregroundStyle(AL.ink.opacity(AL.Ink.a55))
                    .listRowBackground(Color.clear)
            }
            ForEach(sections) { section in
                Section {
                    ForEach(section.links) { link in
                        HStack(spacing: 12) {
                            HeroImage(link: link)
                                .frame(width: 44, height: 44)
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                .opacity(0.8)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(link.title).font(AL.Font.rowTitle).foregroundStyle(AL.ink).lineLimit(1)
                                Text(meta(link)).font(.caption).foregroundStyle(AL.ink.opacity(AL.Ink.a50)).lineLimit(1)
                            }
                        }
                        .frame(minHeight: 64)
                        .accessibilityElement(children: .combine)
                        .listRowBackground(Color.clear.frosted(0.62, radius: 0, rim: 0))
                        .swipeActions(edge: .leading) {
                            Button("Restore", systemImage: "arrow.uturn.backward") { store.restore([link.id]) }
                                .tint(AL.lime)
                        }
                        .swipeActions(edge: .trailing) {
                            Button("Delete", systemImage: "trash", role: .destructive) { router.confirm = .deleteForever([link.id]) }
                        }
                        .accessibilityAction(named: "Restore") { store.restore([link.id]) }
                        .accessibilityAction(named: "Delete forever") { router.confirm = .deleteForever([link.id]) }
                    }
                } header: {
                    SectionHeader(section.title)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background { ZStack { AL.canvas; Orbs(.inbox) }.ignoresSafeArea() }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if !store.trash.isEmpty {
                ToolbarItem(placement: .topBarTrailing) {
                    // No destructive role: the system would re-tint the label to a red that misses 4.5:1 on glass.
                    Button { router.confirm = .emptyTrash(count: store.trash.count) } label: {
                        Text("Empty").fontWeight(.semibold).foregroundStyle(AL.destructiveText)
                    }
                }
            }
        }
    }

    private func meta(_ link: LinkItem) -> String {
        let from = "from \(store.name(of: link.collectionId))"
        guard let at = store.trashedAt[link.id] else { return from }
        return "\(from) · \(at.formatted(.relative(presentation: .named)))"
    }
}

#Preview("Collection") {
    let env = AppEnvironment.mock(latency: false)
    NavigationStack { CollectionView(id: "rust") }.environment(env.store).environment(env.router)
}

#Preview("Unsorted — Dark") {
    let env = AppEnvironment.mock(latency: false)
    NavigationStack { CollectionView(id: "unsorted") }.environment(env.store).environment(env.router).preferredColorScheme(.dark)
}

#Preview("Filter") {
    let env = AppEnvironment.mock(latency: false)
    NavigationStack { FilterResultsView(query: Query("type:video #rust"), title: "Rust videos") }.environment(env.store).environment(env.router)
}

#Preview("Trash") {
    let env = AppEnvironment.mock(latency: false)
    NavigationStack { TrashView() }.environment(env.store).environment(env.router)
}
