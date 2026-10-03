import AppIntents
import Foundation
import Models
import Persistence
import Store

/// The running app's store, for intents executed in-process. Nil when the system runs the intent before launch.
@MainActor
enum IntentBridge {
    static weak var store: LibraryStore?
}

struct CollectionEntity: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Collection"
    static let defaultQuery = CollectionQuery()
    let id: String
    let name: String
    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }
}

struct CollectionQuery: EntityQuery {
    @MainActor
    private func all() -> [CollectionEntity] {
        let collections = IntentBridge.store?.userCollections ?? LocalCache.appGroup()?.recentCollections() ?? []
        return collections.map { CollectionEntity(id: $0.id, name: $0.name) }
    }

    func entities(for identifiers: [String]) async throws -> [CollectionEntity] {
        await all().filter { identifiers.contains($0.id) }
    }

    func suggestedEntities() async throws -> [CollectionEntity] { await all() }
}

/// "Save to AnyLink": inbox by default, no UI.
struct SaveLinkIntent: AppIntent {
    static let title: LocalizedStringResource = "Save Link"
    static let description = IntentDescription("Saves a link to your AnyLink library.")

    @Parameter(title: "Link") var url: URL
    @Parameter(title: "Collection") var collection: CollectionEntity?

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let name = collection?.name ?? "Unsorted"
        if let store = IntentBridge.store {
            guard await store.save(LinkDraft(url: url.absoluteString, collectionId: collection?.id)) != nil else {
                throw $url.needsValueError("That didn't go through. Try again.")
            }
        } else {
            // Not running: leave it for the app, like the share extension does.
            LocalCache.appGroup()?.upsertPendingSave(PendingSave(url: url.absoluteString, collectionId: collection?.id))
        }
        return .result(dialog: "Saved to \(name).")
    }
}

struct AnyLinkShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: SaveLinkIntent(),
            phrases: ["Save to \(.applicationName)", "Save link in \(.applicationName)"],
            shortTitle: "Save Link",
            systemImageName: "link"
        )
    }
}
