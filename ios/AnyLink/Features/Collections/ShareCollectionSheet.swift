import SwiftUI
import DesignSystem
import Models
import Fixtures
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

    private var footer: LocalizedStringKey {
        if url == nil { return "Turn it on to get a link — handy for wishlists and reading lists." }
        // A free owner's link answers "not found" but keeps its token (the server pauses it).
        if !store.isPro { return "Paused while you're on Free: viewers get “not found”. Go Pro and this same link works again. Turning sharing off breaks it for good." }
        return "Viewers see each link, its price, and your notes on it — not your tags or highlights. They can save copies to their own AnyLink. Turning sharing off breaks this link for good."
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Toggle("Anyone with the link can view", isOn: Binding(get: { url != nil }, set: { on in toggle(on) }))
                        .disabled(busy)
                        .tint(AL.inStock)
                } footer: {
                    Text(footer)
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

#Preview("Share — Paused (Free)") {
    let env = AppEnvironment.mock(latency: false)
    let lib = Fixtures.library
    let shared = lib.collections.map { c in var c = c; if c.id == "rust" { c.shareToken = "preview-token" }; return c }
    let _ = env.store.apply(LibrarySnapshot(links: lib.links, trashed: lib.trashed, collections: shared, plan: "free"))
    Color.clear.sheet(isPresented: .constant(true)) { ShareCollectionSheet(id: "rust") }
        .environment(env.store).environment(env.router)
}
