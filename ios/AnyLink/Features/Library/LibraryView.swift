import SwiftUI
import DesignSystem
import Store

// Phase-3 placeholder root; phase 4 replaces it with the full Library (scopes, banner, rows, select mode).
struct LibraryView: View {
    @Environment(LibraryStore.self) private var store
    @Environment(Router.self) private var router

    private let columns = [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)]

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                Text("Library")
                    .font(AL.Font.largeTitle).tracking(-1.65)
                    .foregroundStyle(AL.ink)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)
                    .id("top")
                LazyVGrid(columns: columns, spacing: 8) {
                    ForEach(store.live) { link in
                        Button { router.open(.link(link.id)) } label: { LinkTile(link: link) }
                            .buttonStyle(.plain)
                            .contextMenu {
                                Button(link.favorite == true ? "Unfavorite" : "Favorite", systemImage: "star") {
                                    store.setFavorite(link.id, link.favorite != true)
                                }
                                Button("Move to…", systemImage: "folder") { router.sheet = .moveLinks([link.id]) }
                                Divider()
                                Button("Move to Trash", systemImage: "trash", role: .destructive) { store.trash([link.id]) }
                            }
                    }
                }
                .padding(14)
            }
            .onChange(of: router.scrollToTop[.library]) { withAnimation { proxy.scrollTo("top", anchor: .top) } }
        }
        .refreshable { await store.refresh() }
        .background { ZStack { AL.canvas; Orbs(.library) }.ignoresSafeArea() }
    }
}

#Preview("Light") {
    let env = AppEnvironment.mock(latency: false)
    NavigationStack { LibraryView() }.environment(env.store).environment(env.router)
}

#Preview("Dark") {
    let env = AppEnvironment.mock(latency: false)
    NavigationStack { LibraryView() }.environment(env.store).environment(env.router).preferredColorScheme(.dark)
}
