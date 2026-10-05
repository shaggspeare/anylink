import SwiftUI
import DesignSystem
import Models
import Store

/// A note from the Add sheet: plain text, links stay tappable once saved. No formatting, on purpose.
struct NoteComposer: View {
    @Environment(LibraryStore.self) private var store
    @Binding var collectionID: LinkCollection.ID
    var initialText = ""
    let onBack: () -> Void
    let onSaved: () -> Void
    @State private var text = ""
    @State private var saving = false
    @FocusState private var focused: Bool

    private var linkCount: Int { linkified(text).runs.filter { $0.link != nil }.count }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    TextEditor(text: $text)
                        .focused($focused)
                        .font(AL.Font.brand(17, .regular, relativeTo: .body))
                        .foregroundStyle(AL.ink)
                        .scrollContentBackground(.hidden)
                        .frame(minHeight: 220)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .overlay(alignment: .topLeading) {
                            if text.isEmpty {
                                Text("Write it down.\nLinks you paste stay tappable.")
                                    .font(AL.Font.brand(17, .regular, relativeTo: .body))
                                    .foregroundStyle(AL.ink.opacity(AL.Ink.a40))
                                    .padding(.horizontal, 17)
                                    .padding(.vertical, 18)
                                    .allowsHitTesting(false)
                            }
                        }
                        .frosted(0.62, radius: AL.Radius.card)
                        .overlay(alignment: .topTrailing) { NoteFold(size: 28).clipShape(UnevenRoundedRectangle(topTrailingRadius: AL.Radius.card)) }
                        .accessibilityLabel("Note text")
                    if linkCount > 0 {
                        Label(linkCount == 1 ? "1 link — tappable once saved" : "\(linkCount) links — tappable once saved", systemImage: "link")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(AL.signal)
                    }
                    collectionPicker
                }
                .padding(20)
            }
            .scrollDismissesKeyboard(.interactively)
            .background { ZStack { AL.canvas; Orbs(.sheet) }.ignoresSafeArea() }
            .navigationTitle("New note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Back", systemImage: "chevron.left", action: onBack).labelStyle(.iconOnly)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "Saving…" : "Save", action: save)
                        .fontWeight(.semibold)
                        .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || saving)
                }
            }
        }
        .onAppear {
            text = initialText
            focused = true
        }
    }

    private func save() {
        saving = true
        Task {
            if await store.saveNote(text, collectionId: collectionID) != nil { onSaved() } else { saving = false }
        }
    }

    private var collectionPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Save to").font(.footnote).foregroundStyle(AL.ink.opacity(AL.Ink.a55))
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(store.collections.filter { $0.isSmart != true }.prefix(8)) { c in
                        Button { collectionID = c.id } label: { ScopeChip(c.name, isSelected: collectionID == c.id) }
                            .buttonStyle(.plain)
                            .accessibilityAddTraits(collectionID == c.id ? .isSelected : [])
                    }
                }
            }
        }
        .sensoryFeedback(.selection, trigger: collectionID)
    }
}

#Preview("Note composer") {
    @Previewable @State var env = AppEnvironment.mock(latency: false)
    @Previewable @State var collection = "unsorted"
    NoteComposer(collectionID: $collection, initialText: "Gift ideas\nthat apron from toast.co.uk", onBack: {}, onSaved: {})
        .environment(env.store)
}

#Preview("Note composer — Dark") {
    @Previewable @State var env = AppEnvironment.mock(latency: false)
    @Previewable @State var collection = "unsorted"
    NoteComposer(collectionID: $collection, onBack: {}, onSaved: {})
        .environment(env.store)
        .preferredColorScheme(.dark)
}
