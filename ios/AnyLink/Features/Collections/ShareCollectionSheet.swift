import SwiftUI
import DesignSystem
import Models
import Store

/// The owner's side of a shared collection (docs/adr/0001): on/off, the link, and the name shown on it.
/// Off kills the link for good; on again makes a new one. Same as the web's Share dialog.
struct ShareCollectionSheet: View {
    let id: LinkCollection.ID
    @Environment(LibraryStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var busy = false
    @State private var name = ""

    private var collection: LinkCollection? { store.collection(id) }
    /// The backend serves the shared page, so its origin is the link's.
    private var url: URL? {
        guard let token = collection?.shareToken else { return nil }
        return AppConfig.apiBase?.appending(path: "s/\(token)")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Toggle("Anyone with the link can view", isOn: Binding(get: { url != nil }, set: { on in toggle(on) }))
                        .disabled(busy)
                        .tint(AL.inStock)
                } footer: {
                    Text(url == nil
                         ? "Turn it on to get a link — handy for wishlists and reading lists."
                         : "Viewers see each link, its price, and your notes on it — not your tags or highlights. They can save copies to their own AnyLink. Turning sharing off breaks this link for good.")
                }
                if let url {
                    Section {
                        ShareLink(item: url) { Label("Share link…", systemImage: "square.and.arrow.up") }
                        Text(url.absoluteString)
                            .font(AL.Font.meta)
                            .foregroundStyle(AL.ink.opacity(AL.Ink.a60))
                            .textSelection(.enabled)
                    }
                    Section {
                        TextField("Not shown", text: $name)
                            .textContentType(.name)
                            .onSubmit(saveName)
                    } header: {
                        Text("Your name on it (optional)")
                    }
                }
            }
            .navigationTitle("Share “\(collection?.name ?? "Collection")”")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { saveName(); dismiss() } }
            }
        }
        .presentationDetents([.medium, .large])
        .onAppear { name = store.displayName ?? "" }
    }

    private func toggle(_ on: Bool) {
        busy = true
        Task {
            await store.setShared(id, on)
            busy = false
        }
    }

    private func saveName() {
        guard name.trimmingCharacters(in: .whitespaces) != (store.displayName ?? "") else { return }
        Task { await store.setDisplayName(name) }
    }
}

#Preview("Share") {
    let env = AppEnvironment.mock(latency: false)
    Color.clear.sheet(isPresented: .constant(true)) { ShareCollectionSheet(id: "rust") }
        .environment(env.store).environment(env.router)
}

#Preview("Share — Dark") {
    let env = AppEnvironment.mock(latency: false)
    Color.clear.sheet(isPresented: .constant(true)) { ShareCollectionSheet(id: "rust") }
        .environment(env.store).environment(env.router).preferredColorScheme(.dark)
}
