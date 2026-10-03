import SwiftUI
import DesignSystem
import QueryLanguage
import Store

// Phase-3 placeholder root; phase 8 adds tokens, suggestions, snippets and Save as filter.
struct SearchView: View {
    @Environment(LibraryStore.self) private var store
    @Environment(Router.self) private var router
    @State private var text = ""

    var body: some View {
        List {
            if !text.isEmpty {
                ForEach(store.links(matching: Query(text))) { link in
                    Button { router.open(.link(link.id)) } label: { LinkRow(link: link) }
                        .buttonStyle(.plain)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background { ZStack { AL.canvas; Orbs(.library) }.ignoresSafeArea() }
        .navigationTitle("Search")
        .searchable(text: $text, prompt: "Search links, #tags…")
    }
}

#Preview {
    let env = AppEnvironment.mock(latency: false)
    NavigationStack { SearchView() }.environment(env.store).environment(env.router)
}
