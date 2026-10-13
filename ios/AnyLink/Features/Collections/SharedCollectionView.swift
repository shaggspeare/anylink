import SwiftUI
import DesignSystem
import Models
import Fixtures
import Store

/// Someone else's shared collection, opened from `https://<web>/s/<token>`: read-only rows, each with Save,
/// plus Save all. Same as the web page at that URL (docs/adr/0001).
struct SharedCollectionView: View {
    let token: String
    @Environment(LibraryStore.self) private var store
    @Environment(Router.self) private var router
    @AppStorage("signedIn") private var signedIn = false
    @State private var state: LoadState
    /// Link ids saved from here, or `Self.all` once the whole collection was.
    @State private var saved: Set<String> = []
    @State private var busy = false

    private static let all = "all"
    enum LoadState { case loading, loaded(SharedCollection), gone, failed }

    init(token: String, preview: SharedCollection? = nil) {
        self.token = token
        _state = State(initialValue: preview.map { .loaded($0) } ?? .loading)
    }

    var body: some View {
        content
            .background { ZStack { AL.canvas; Orbs(.collection(color)) }.ignoresSafeArea() }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if case .loaded(let c) = state, !c.links.isEmpty {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button(saved.contains(Self.all) ? "Saved" : "Save all") { save(nil) }
                            .disabled(busy || saved.contains(Self.all))
                    }
                }
            }
            .task { if case .loading = state { await load() } }
    }

    private var color: Color {
        if case .loaded(let c) = state { .fromHex(c.color) } else { AL.slate }
    }

    @ViewBuilder
    private var content: some View {
        switch state {
        case .loading:
            ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
        case .gone:
            ContentUnavailableView("This collection isn't shared any more", systemImage: "link",
                                   description: Text("Ask whoever sent it for a new link."))
        case .failed:
            ContentUnavailableView {
                Label("Couldn't load this collection", systemImage: "wifi.exclamationmark")
            } actions: {
                Button("Try again") { state = .loading; Task { await load() } }
            }
        case .loaded(let c):
            List {
                header(c)
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                    .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 8, trailing: 16))
                if c.links.isEmpty {
                    Text("Nothing here yet.")
                        .font(AL.Font.lead)
                        .foregroundStyle(AL.ink.opacity(AL.Ink.a55))
                        .listRowBackground(Color.clear)
                }
                ForEach(c.links) { row($0) }
            }
            .scrollContentBackground(.hidden)
        }
    }

    private func header(_ c: SharedCollection) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 10) {
                CollectionMarker(color: c.color, icon: c.icon, size: 12)
                Text(c.name)
                    .font(AL.Font.largeTitle).tracking(-1.65)
                    .foregroundStyle(AL.ink)
                    .accessibilityAddTraits(.isHeader)
            }
            Text([c.links.count.linkCount, c.ownerName.map { "shared by \($0)" }].compactMap { $0 }.joined(separator: " · "))
                .font(AL.Font.meta)
                .foregroundStyle(AL.ink.opacity(AL.Ink.a55))
        }
    }

    private func row(_ link: LinkItem) -> some View {
        let isSaved = saved.contains(link.id) || saved.contains(Self.all)
        return VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Button { router.openOriginal = URL(string: link.url) } label: { LinkRow(link: link) }
                    .buttonStyle(.plain)
                    .disabled(link.isNote)
                Button(isSaved ? "Saved" : "Save") { save([link.id]) }
                    .font(AL.Font.meta.weight(.semibold))
                    .buttonStyle(.bordered)
                    .disabled(busy || isSaved)
                    .accessibilityLabel(isSaved ? "Saved" : "Save \(link.title)")
            }
            // A note's row only shows its first line; the owner's note on a link is the point of sharing a wishlist.
            if link.isNote {
                Text(link.excerpt).font(AL.Font.lead).foregroundStyle(AL.ink.opacity(AL.Ink.a75)).lineLimit(8)
            }
            if let note = link.note, !note.isEmpty {
                Text(note)
                    .font(AL.Font.meta)
                    .foregroundStyle(AL.ink.opacity(AL.Ink.a75))
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(AL.ink.opacity(AL.Ink.a05), in: RoundedRectangle(cornerRadius: AL.Radius.badge, style: .continuous))
            }
        }
        .listRowBackground(Color.clear)
    }

    private func load() async {
        do {
            state = .loaded(try await store.sharedCollection(token: token))
        } catch AppError.notFound {
            state = .gone
        } catch {
            state = .failed
        }
    }

    private func save(_ ids: [LinkItem.ID]?) {
        // ponytail: after signing up they land back on Library, not here; reopen the link to save.
        // Carry the pending save through sign-in if people drop off there.
        guard signedIn else { router.sheet = .signUp; return }
        busy = true
        Task {
            if await store.saveFromShare(token: token, linkIds: ids) != nil {
                saved.formUnion(ids ?? [Self.all])
            }
            busy = false
        }
    }
}

private let sample = SharedCollection(name: "Birthday wishlist", color: "#F2A65A", icon: "🎁", ownerName: "Sam",
                                      links: Array(Fixtures.library.links.prefix(5)))

#Preview("Shared") {
    let env = AppEnvironment.mock(latency: false)
    NavigationStack { SharedCollectionView(token: "preview", preview: sample) }.environment(env.store).environment(env.router)
}

#Preview("Shared — Dark") {
    let env = AppEnvironment.mock(latency: false)
    NavigationStack { SharedCollectionView(token: "preview", preview: sample) }
        .environment(env.store).environment(env.router).preferredColorScheme(.dark)
}
