import SwiftUI
import DesignSystem
import Store

// Phase-3 placeholder root; phase 7 builds the full Collections screen.
struct CollectionsView: View {
    @Environment(LibraryStore.self) private var store
    @Environment(Router.self) private var router

    private let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]

    var body: some View {
        ScrollView {
            Text("Collections")
                .font(AL.Font.largeTitle).tracking(-1.65)
                .foregroundStyle(AL.ink)
                .frame(maxWidth: .infinity, alignment: .leading)
            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(store.collections) { c in
                    Button { router.open(c.isSmart == true ? .filter(.init(c.smartQuery ?? ""), title: c.name) : .collection(c.id)) } label: {
                        CollectionCard(collection: c, linkCount: store.count(in: c.id), topLinks: Array(store.links(in: c.id).prefix(3)))
                    }
                    .buttonStyle(.plain)
                }
                NewCollectionCard { router.sheet = .newCollection }
            }
            HStack {
                Button("Trash (\(store.trash.count))") { router.open(.trash) }
                Spacer()
                Button("Settings") { router.open(.settings) }
            }
            .buttonStyle(ALSmallButtonStyle(.soft))
            .padding(.top, 8)
        }
        .padding(.horizontal, 16)
        .background { ZStack { AL.canvas; Orbs(.library) }.ignoresSafeArea() }
    }
}

#Preview {
    let env = AppEnvironment.mock(latency: false)
    NavigationStack { CollectionsView() }.environment(env.store).environment(env.router)
}
