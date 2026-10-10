import SwiftUI
import DesignSystem
import Models
import QueryLanguage
import Networking
import Fixtures
import Store

/// S10.
struct CollectionsView: View {
    @Environment(LibraryStore.self) private var store
    @Environment(Router.self) private var router
    @AppStorage("dismissedFilterSuggestions") private var dismissedRaw = ""
    @AppStorage("guest") private var guest = false

    private let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]
    private var dismissed: Set<String> { Set(dismissedRaw.split(separator: ",").map(String.init)) }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    filterChips
                    if let s = store.suggestedFilter(dismissed: dismissed) { suggestion(s) }
                    unsortedCard
                    // New collection is the toolbar +, always in reach; no dashed card at the end of the grid.
                    LazyVGrid(columns: columns, spacing: 12) {
                        ForEach(store.userCollections) { c in
                            Button { router.open(.collection(c.id)) } label: {
                                CollectionCard(collection: c, linkCount: store.count(in: c.id), topLinks: Array(store.links(in: c.id).prefix(3)))
                            }
                            .buttonStyle(TilePressStyle())
                            .accessibilityLabel("\(c.name), \(store.count(in: c.id).linkCount)")
                            .accessibilityIdentifier("collection-\(c.id)")
                        }
                    }
                    if !store.customFilters.isEmpty { customFilters }
                    if !store.topTags().isEmpty { tagCloud }
                    quietList
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
                .id("top")
            }
            .onChange(of: router.scrollToTop[.collections]) { withAnimation { proxy.scrollTo("top", anchor: .top) } }
        }
        .background { ZStack { AL.canvas; Orbs(.library) }.ignoresSafeArea() }
        .refreshable { await store.refresh() }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            // Title sits in the bar so it lines up with the controls.
            ToolbarItem(placement: .topBarLeading) {
                Text("Collections")
                    .font(AL.Font.largeTitle).tracking(-1.65)
                    .foregroundStyle(AL.ink)
                    .fixedSize()
                    // The bar clips text to its glyph-advance bounds, shaving the last letter; render with some slack.
                    .padding(.trailing, 4).drawingGroup()
                    .accessibilityAddTraits(.isHeader)
            }
            .sharedBackgroundVisibility(.hidden)
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button { router.sheet = .newCollection } label: { Image(systemName: "plus") }
                    .accessibilityLabel("New collection")
                Menu {
                    Button { router.open(.settings) } label: { Label("Settings", systemImage: "gearshape") }
                    if guest {
                        Button { router.sheet = .signUp } label: { Label("Sign in", systemImage: "person.crop.circle") }
                    } else {
                        Button(role: .destructive) { Task { await signOut(store) } } label: {
                            Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    }
                } label: {
                    Image(systemName: "person.fill")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(width: 28, height: 28)
                        .background(AL.periwinkle, in: Circle())
                }
                .accessibilityLabel("Account")
            }
        }
    }

    // MARK: Pieces

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(BuiltInFilter.allCases) { f in
                    let n = store.count(f)
                    if n > 0 {
                        Button { router.open(.filter(f.query, title: f.title)) } label: {
                            ScopeChip(f == .favorites ? "★ \(f.title)" : f.title, count: n)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(f.title), \(n)")
                    }
                }
            }
            .padding(.horizontal, 16)
        }
        .padding(.horizontal, -16)
    }

    private func suggestion(_ s: SuggestedFilter) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Make “\(s.name)” a filter?").font(AL.Font.rowTitle).foregroundStyle(AL.ink)
                Text("\(s.count.linkCount) tagged #\(s.tag)").font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a55))
            }
            Spacer(minLength: 0)
            Button("Create") { Task { await store.createFilter(name: s.name, query: s.query) } }
                .buttonStyle(ALSmallButtonStyle(.ink))
            Button {
                dismissedRaw = (dismissed.union([s.tag])).sorted().joined(separator: ",")
            } label: {
                Image(systemName: "xmark").font(.footnote.weight(.semibold))
                    .foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                    .frame(width: AL.Control.md, height: AL.Control.md)
            }
            .accessibilityLabel("Dismiss suggestion")
        }
        .padding(.init(top: 10, leading: 14, bottom: 10, trailing: 4))
        .background(AL.periwinkle.opacity(0.16), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(AL.periwinkle.opacity(0.35)))
    }

    private var unsortedCard: some View {
        let n = store.count(in: store.inboxID)
        return Button { router.open(.collection(store.inboxID)) } label: {
            HStack(spacing: 10) {
                Circle().fill(AL.slate).frame(width: 10, height: 10)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Unsorted").font(AL.Font.brand(15, .semibold, relativeTo: .subheadline)).foregroundStyle(AL.ink)
                    Text("\(n.linkCount) waiting · new links land here").font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a55))
                }
                Spacer(minLength: 0)
                if n > 0 {
                    Button("Sort") { router.open(.triage) }
                        .buttonStyle(ALSmallButtonStyle(.lime))
                }
            }
            .padding(14)
            .frosted(0.62, radius: 20)
        }
        .buttonStyle(.plain)
    }

    private var customFilters: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionTitle("Custom filters")
            VStack(spacing: 0) {
                ForEach(store.customFilters) { f in
                    Button { router.open(.filter(Query(f.smartQuery ?? ""), title: f.name)) } label: {
                        HStack(spacing: 10) {
                            Circle().fill(AL.periwinkle).frame(width: 8, height: 8)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(f.name).font(AL.Font.rowTitle).foregroundStyle(AL.ink)
                                Text(f.smartQuery ?? "").font(.caption.monospaced()).foregroundStyle(AL.ink.opacity(AL.Ink.a45))
                            }
                            Spacer()
                            Text("\(store.count(in: f.id))").font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                            Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(AL.ink.opacity(AL.Ink.a30))
                        }
                        .padding(.horizontal, 14).frame(minHeight: 52)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    if f.id != store.customFilters.last?.id { Divider().padding(.leading, 32) }
                }
            }
            .frosted(0.62, radius: 18)
        }
    }

    private var tagCloud: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionTitle("Tags")
            FlowLayout(spacing: 8) {
                ForEach(store.topTags(), id: \.tag) { t in
                    Button { router.open(.filter(Query("#\(t.tag)"), title: "#\(t.tag)")) } label: {
                        ScopeChip("#\(t.tag)", count: t.count)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var quietList: some View {
        VStack(spacing: 0) {
            quietRow("Import links") { router.showsOnboarding = true }
            Divider().padding(.leading, 14)
            quietRow("Trash", detail: "\(store.trash.count)") { router.open(.trash) }
            if store.userCollections.contains(where: { store.count(in: $0.id) == 0 }) {
                Divider().padding(.leading, 14)
                quietRow("Delete empty collections", chevron: false) { Task { await store.deleteEmptyCollections() } }
            }
        }
        .background(AL.surface.opacity(0.45), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .padding(.top, 8)
    }

    private func quietRow(_ title: String, detail: String? = nil, chevron: Bool = true, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                Text(title).foregroundStyle(AL.ink.opacity(AL.Ink.a75))
                Spacer()
                if let detail { Text(detail).foregroundStyle(AL.ink.opacity(AL.Ink.a45)) }
                if chevron { Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(AL.ink.opacity(AL.Ink.a30)) }
            }
            .font(.subheadline)
            .padding(.horizontal, 14).frame(minHeight: 48)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func sectionTitle(_ t: String) -> some View {
        Text(t).font(AL.Font.title).tracking(-0.66).foregroundStyle(AL.ink).padding(.top, 8)
    }
}

/// New collection (name + 5 swatches) and Rename (name only: the API can't recolour).
struct CollectionNameSheet: View {
    var renaming: LinkCollection?
    @Environment(LibraryStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var color = String(format: "#%06X", AL.collectionSwatches[0])
    @State private var busy = false
    @FocusState private var nameFocused: Bool

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 18) {
                ALField("Name", text: $name)
                    .focused($nameFocused)
                    .submitLabel(.done)
                    .onSubmit(submit)
                if renaming == nil {
                    HStack(spacing: 14) {
                        ForEach(AL.collectionSwatches, id: \.self) { hex in
                            let value = String(format: "#%06X", hex)
                            Button { color = value } label: {
                                Circle().fill(Color(hex: hex)).frame(width: 32, height: 32)
                                    .overlay(Circle().strokeBorder(AL.ink, lineWidth: color == value ? 2.5 : 0).padding(-4))
                                    .frame(width: AL.Control.md, height: AL.Control.md)
                            }
                            .accessibilityLabel("Colour \(value)")
                            .accessibilityAddTraits(color == value ? .isSelected : [])
                        }
                    }
                }
                Button(renaming == nil ? "Add collection" : "Save", action: submit)
                    .buttonStyle(.alPrimary)
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || busy)
                Spacer()
            }
            .padding(20)
            .navigationTitle(renaming == nil ? "New collection" : "Rename")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
            .onAppear { name = renaming?.name ?? ""; nameFocused = true }
        }
        .presentationDetents([.medium])
        .interactiveDismissDisabled(busy)
    }

    private func submit() {
        let n = name.trimmingCharacters(in: .whitespaces)
        guard !n.isEmpty, !busy else { return }
        if let renaming {
            store.rename(renaming.id, to: n)
            dismiss()
        } else {
            busy = true
            Task {
                _ = await store.createCollection(name: n, color: color)
                dismiss()
            }
        }
    }
}

#Preview("Collections") {
    let env = AppEnvironment.mock(latency: false)
    NavigationStack { CollectionsView() }.environment(env.store).environment(env.router)
}

#Preview("Collections — Dark") {
    let env = AppEnvironment.mock(latency: false)
    NavigationStack { CollectionsView() }.environment(env.store).environment(env.router).preferredColorScheme(.dark)
}
