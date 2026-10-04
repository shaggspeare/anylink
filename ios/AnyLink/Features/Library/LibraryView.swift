import SwiftUI
import TipKit
import DesignSystem
import Models
import Networking
import Fixtures
import Store

struct LibraryView: View {
    @Environment(LibraryStore.self) private var store
    @Environment(Router.self) private var router
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @AppStorage("library.layout") private var layout: LibraryLayout = .tiles
    @AppStorage("library.sort") private var sort: LibrarySort = .newest
    @State private var scope: LibraryScope = .all
    @State private var appeared = false

    private let columns = [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)]

    private var links: [LinkItem] { store.links(in: scope, sortedBy: sort) }
    private var isLoading: Bool { store.live.isEmpty && store.syncState == .syncing }
    private var isEmptyLibrary: Bool { store.live.isEmpty && !isLoading }

    var body: some View {
        ScrollViewReader { proxy in
            Group {
                if layout == .rows && !isEmptyLibrary && !isLoading { rowsList } else { tilesScroll }
            }
            .onChange(of: router.scrollToTop[.library]) { withAnimation { proxy.scrollTo("top", anchor: .top) } }
        }
        .background { ZStack { AL.canvas; Orbs(.library) }.ignoresSafeArea() }
        .refreshable { await store.refresh() }
        .toolbar { if router.isSelecting { selectToolbar } else { mainToolbar } }
        .toolbarVisibility(router.isSelecting ? .hidden : .automatic, for: .tabBar)
        .navigationBarTitleDisplayMode(.inline)
        .sensoryFeedback(.selection, trigger: scope)
        .sensoryFeedback(.selection, trigger: layout)
        .sensoryFeedback(.selection, trigger: sort)
        .sensoryFeedback(.selection, trigger: router.selection.count)
        .task { appeared = true }
    }

    // MARK: - Header (title, scopes, banners)

    @ViewBuilder
    private var header: some View {
        if !isEmptyLibrary && !isLoading {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(LibraryScope.allCases) { s in
                        let n = store.scopeCount(s)
                        if s == .all || n > 0 {
                            Button { scope = s } label: { ScopeChip(s.title, count: n, isSelected: scope == s) }
                                .buttonStyle(.plain)
                                .accessibilityAddTraits(scope == s ? .isSelected : [])
                        }
                    }
                }
                .padding(.horizontal, 16)
            }
            .padding(.horizontal, -16)
        }
        if store.syncState == .offline {
            Notice("You're offline. Changes are saved and will sync when you're back.")
        }
        let unsorted = store.scopeCount(.unsorted)
        if scope == .all && unsorted > 0 && !router.isSelecting {
            UnsortedBanner(count: unsorted) { router.open(.triage) }   // no tip: the banner already says what Sort does
        }
    }

    // MARK: - Tiles

    private var tilesScroll: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                header.padding(.horizontal, 2)
                if isLoading {
                    LazyVGrid(columns: columns, spacing: 8) {
                        ForEach(0..<6, id: \.self) { _ in SkeletonTile() }
                    }
                } else if isEmptyLibrary {
                    LibraryEmptyState()
                } else if links.isEmpty {
                    nothingHere
                } else {
                    LazyVGrid(columns: columns, spacing: 8) {
                        ForEach(Array(links.enumerated()), id: \.element.id) { i, link in
                            tile(link)
                                .modifier(Entrance(index: i, active: appeared || reduceMotion))
                                .popoverTip(i == 0 ? LongPressTip() : nil, arrowEdge: .top)   // below the tile, off the filter chips
                        }
                    }
                }
            }
            .padding(.horizontal, 14)
            .padding(.bottom, 24)
            .id("top")
        }
    }

    private func tile(_ link: LinkItem) -> some View {
        Button {
            if router.isSelecting { router.toggleSelection(link.id) } else { router.open(.link(link.id)) }
        } label: {
            LinkTile(link: link, isSelected: router.selection.contains(link.id), selectMode: router.isSelecting)
        }
        .buttonStyle(TilePressStyle())
        .linkActions(link)
        .accessibilityAddTraits(router.selection.contains(link.id) ? .isSelected : [])
        .accessibilityIdentifier("tile-\(link.id)")
    }

    private var nothingHere: some View {
        Text("Nothing here yet.")
            .font(AL.Font.lead)
            .foregroundStyle(AL.ink.opacity(AL.Ink.a50))
            .frame(maxWidth: .infinity)
            .padding(.top, 40)
    }

    // MARK: - Rows

    private var rowsList: some View {
        @Bindable var router = router
        return List(selection: $router.selection) {
            VStack(alignment: .leading, spacing: 12) { header }
                .id("top")
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
                .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 4, trailing: 16))
                .selectionDisabled()
            if links.isEmpty {
                nothingHere.listRowBackground(Color.clear).selectionDisabled()
            } else if sort == .newest {
                ForEach(DateSections.group(links)) { section in
                    Section { ForEach(section.links) { row($0) } } header: { SectionHeader(section.title) }
                }
            } else {
                Section { ForEach(links) { row($0) } }
            }
        }
        .scrollContentBackground(.hidden)
        .environment(\.editMode, .constant(router.isSelecting ? .active : .inactive))
    }

    private func row(_ link: LinkItem) -> some View { LinkListRow(link: link) }

    // MARK: - Toolbars

    @ToolbarContentBuilder
    private var mainToolbar: some ToolbarContent {
        // Title sits in the bar so it lines up with the controls.
        ToolbarItem(placement: .topBarLeading) {
            Text("Library")
                .font(AL.Font.largeTitle).tracking(-1.65)
                .foregroundStyle(AL.ink)
                .fixedSize()
                .accessibilityAddTraits(.isHeader)
        }
        .sharedBackgroundVisibility(.hidden)
        ToolbarItemGroup(placement: .topBarTrailing) {
            Button {
                layout = layout == .tiles ? .rows : .tiles
            } label: {
                Image(systemName: layout == .tiles ? "list.bullet" : "square.grid.2x2")
            }
            .accessibilityLabel(layout == .tiles ? "Show as list" : "Show as grid")
            Menu {
                Picker("Sort", selection: $sort) {
                    ForEach(LibrarySort.allCases) { Text($0.title).tag($0) }
                }
            } label: {
                Image(systemName: "arrow.up.arrow.down")
            }
            .accessibilityLabel("Sort")
            Button("Select") { router.beginSelecting() }
                .disabled(store.live.isEmpty)
        }
    }

    private var selectToolbar: some ToolbarContent { SelectionToolbar(links: links, store: store, router: router) }
}

// MARK: - Pieces

private struct Entrance: ViewModifier {
    let index: Int
    let active: Bool

    func body(content: Content) -> some View {
        content
            .scaleEffect(active ? 1 : AL.Motion.entranceScales[index % AL.Motion.entranceScales.count])
            .opacity(active ? 1 : 0)
            .animation(AL.Motion.entrance.delay(AL.Motion.stagger(index)), value: active)
    }
}

private struct SkeletonTile: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            RoundedRectangle(cornerRadius: 13, style: .continuous).fill(AL.heroPlaceholder).frame(height: 92)
            RoundedRectangle(cornerRadius: 4).fill(AL.ink.opacity(AL.Ink.a08)).frame(width: 70, height: 10)
            RoundedRectangle(cornerRadius: 4).fill(AL.ink.opacity(AL.Ink.a08)).frame(height: 12)
            RoundedRectangle(cornerRadius: 4).fill(AL.ink.opacity(AL.Ink.a08)).frame(width: 90, height: 12)
        }
        .padding(6)
        .frame(height: 184, alignment: .top)
        .frosted(0.62, radius: 18)
        .accessibilityHidden(true)
    }
}

struct LibraryEmptyState: View {
    @Environment(Router.self) private var router

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(spacing: 8) {
                ForEach(0..<3, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .strokeBorder(AL.ink.opacity(AL.Ink.a20), style: StrokeStyle(lineWidth: 1.5, dash: [6, 4]))
                        .frame(height: 110)
                }
            }
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 6) {
                Text("Nothing saved yet").font(AL.Font.title).tracking(-0.66).foregroundStyle(AL.ink)
                Text("Three ways in. The share sheet is the one you'll use most.")
                    .font(AL.Font.lead).foregroundStyle(AL.ink.opacity(AL.Ink.a60))
            }
            VStack(spacing: 0) {
                way(1, "Share from any app", "In Safari, tap Share → AnyLink. Pin it to the top row.") {}
                    .popoverTip(ShareSheetTip())
                Divider().padding(.leading, 60)
                way(2, "Paste a link", "Copy a URL, then tap Paste at the bottom of any tab.") {
                    router.sheet = .addLink(prefill: nil)
                }
                Divider().padding(.leading, 60)
                way(3, "Import what you have", "Browser bookmarks or Telegram Saved Messages.") {
                    router.showsOnboarding = true
                }
            }
            .frosted(0.62, radius: 18)
        }
    }

    private func way(_ n: Int, _ title: String, _ detail: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Text("\(n)")
                    .font(AL.Font.brand(15, .bold, relativeTo: .body))
                    .foregroundStyle(AL.onInk)
                    .frame(width: 32, height: 32)
                    .background(AL.ink, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(AL.Font.rowTitle).foregroundStyle(AL.ink)
                    Text(detail).font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a55))
                }
                Spacer(minLength: 0)
            }
            .padding(14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Previews

private struct LibraryPreview: View {
    var layout: LibraryLayout = .tiles
    var snapshot: LibrarySnapshot? = Fixtures.library
    var sync: SyncState = .idle
    var selecting = false
    @State private var env: AppEnvironment?

    var body: some View {
        if let env {
            NavigationStack { LibraryView() }
                .environment(env.store)
                .environment(env.router)
                .defaultAppStorage(UserDefaults(suiteName: "preview-\(layout.rawValue)")!)
        } else {
            Color.clear.onAppear {
                let e = AppEnvironment(api: MockAPI.fixtures(latency: false), snapshot: snapshot)
                e.store.previewSyncState(sync)
                if selecting { e.router.beginSelecting(with: "nasa") }
                UserDefaults(suiteName: "preview-\(layout.rawValue)")?.set(layout.rawValue, forKey: "library.layout")
                env = e
            }
        }
    }
}


#Preview("Tiles") { LibraryPreview() }
#Preview("Tiles — Dark") { LibraryPreview().preferredColorScheme(.dark) }
#Preview("Rows") { LibraryPreview(layout: .rows) }
#Preview("Rows — Dark") { LibraryPreview(layout: .rows).preferredColorScheme(.dark) }
#Preview("Loading") { LibraryPreview(snapshot: nil, sync: .syncing) }
#Preview("Empty") { LibraryPreview(snapshot: LibrarySnapshot(links: [], trashed: [], collections: Fixtures.collections)) }
#Preview("Offline") { LibraryPreview(sync: .offline) }
#Preview("Select mode") { LibraryPreview(selecting: true) }
#Preview("Large type") { LibraryPreview().dynamicTypeSize(.accessibility2) }
