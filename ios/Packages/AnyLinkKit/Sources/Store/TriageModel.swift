import Foundation
import Observation
import Models

/// S14. The queue is derived from the inbox on every read, so Undo puts a link back where it was.
@MainActor @Observable
public final class TriageModel {
    @ObservationIgnored let store: LibraryStore
    private let initial: [LinkItem.ID]
    public private(set) var later: Set<LinkItem.ID> = []

    public init(store: LibraryStore) {
        self.store = store
        initial = store.links(in: store.inboxID).map(\.id)
    }

    public var total: Int { initial.count }

    public var remaining: [LinkItem] {
        let inbox = store.inboxID
        return initial.compactMap { store.link($0) }
            .filter { $0.collectionId == inbox && $0.deleted != true && $0.archived != true && !later.contains($0.id) }
    }

    public var current: LinkItem? { remaining.first }
    public var isDone: Bool { remaining.isEmpty }
    /// "{i} of {total}", 1-based, capped at total.
    public var position: Int { min(total - remaining.count + 1, total) }
    public var progress: Double { total == 0 ? 1 : Double(total - remaining.count) / Double(total) }

    public func suggestion(for link: LinkItem) -> LinkCollection? { store.suggestedCollection(for: link) }

    /// Three other collections for the "Or:" chips, most used first.
    public func alternatives(for link: LinkItem) -> [LinkCollection] {
        let skip = suggestion(for: link)?.id
        return store.userCollections
            .filter { $0.id != skip }
            .sorted { store.count(in: $0.id) > store.count(in: $1.id) }
            .prefix(3).map { $0 }
    }

    // MARK: Actions (each has Undo and logs a signal)

    /// Swipe right / the signal button: file into the suggestion.
    public func accept(_ link: LinkItem) {
        guard let c = suggestion(for: link) else { return }
        store.signals.log("accept", linkIds: [link.id], collectionId: c.id)
        store.move([link.id], to: c.id)
    }

    /// An "Or:" chip or the Move sheet.
    public func file(_ link: LinkItem, into id: LinkCollection.ID) {
        if let s = suggestion(for: link), s.id != id {
            store.signals.log("reject", linkIds: [link.id], collectionId: s.id)
        }
        store.move([link.id], to: id)
    }

    /// Swipe left / the trash circle.
    public func kill(_ link: LinkItem) {
        store.signals.log("kill", linkIds: [link.id])
        store.trash([link.id])
    }

    /// Skip for this session.
    public func skip(_ link: LinkItem) {
        later.insert(link.id)
        store.signals.log("later", linkIds: [link.id])
        store.undo.register("Skipped for now") { [weak self] in self?.later.remove(link.id) }
    }
}
