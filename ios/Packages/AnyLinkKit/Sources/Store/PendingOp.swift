import Foundation
import Models
import Networking

/// A queueable API call. Offline intents keep their optimistic change and wait in the outbox as one of these.
public enum PendingOp: Codable, Sendable, Equatable {
    case move([LinkItem.ID], to: LinkCollection.ID)
    case tag([LinkItem.ID], String)
    case archive([LinkItem.ID])
    case trash([LinkItem.ID])
    case restore([LinkItem.ID])
    case purge([LinkItem.ID])
    case patch(LinkItem.ID, note: String?, favorite: Bool?)
    case noteText(LinkItem.ID, String)
    case pin(LinkItem.ID, Bool)
    case highlight(LinkItem.ID, quote: String)
    case rename(LinkCollection.ID, name: String)
    case priceAlert(LinkItem.ID, threshold: Double, currency: String)
    case dissolve(LinkCollection.ID, members: [LinkItem.ID], inbox: LinkCollection.ID)

    /// The links it touches.
    var linkIDs: [LinkItem.ID] {
        switch self {
        case .move(let ids, _), .tag(let ids, _), .archive(let ids), .trash(let ids), .restore(let ids), .purge(let ids):
            return ids
        case .patch(let id, _, _), .noteText(let id, _), .pin(let id, _), .highlight(let id, _), .priceAlert(let id, _, _):
            return [id]
        case .dissolve(_, let members, _): return members
        case .rename: return []
        }
    }

    /// The same op with each link id swapped by `swap`; an id it maps to nil drops out.
    /// Nil when no link is left for it to act on.
    func resolving(_ swap: (LinkItem.ID) -> LinkItem.ID?) -> PendingOp? {
        func list(_ ids: [LinkItem.ID], _ make: ([LinkItem.ID]) -> PendingOp) -> PendingOp? {
            let ids = ids.compactMap(swap)
            return ids.isEmpty ? nil : make(ids)
        }
        switch self {
        case .move(let ids, let to): return list(ids) { .move($0, to: to) }
        case .tag(let ids, let t): return list(ids) { .tag($0, t) }
        case .archive(let ids): return list(ids) { .archive($0) }
        case .trash(let ids): return list(ids) { .trash($0) }
        case .restore(let ids): return list(ids) { .restore($0) }
        case .purge(let ids): return list(ids) { .purge($0) }
        case .patch(let id, let note, let fav): return swap(id).map { .patch($0, note: note, favorite: fav) }
        case .noteText(let id, let text): return swap(id).map { .noteText($0, text) }
        case .pin(let id, let pinned): return swap(id).map { .pin($0, pinned) }
        case .highlight(let id, let quote): return swap(id).map { .highlight($0, quote: quote) }
        case .priceAlert(let id, let t, let c): return swap(id).map { .priceAlert($0, threshold: t, currency: c) }
        case .dissolve(let id, let members, let inbox): return .dissolve(id, members: members.compactMap(swap), inbox: inbox)
        case .rename: return self
        }
    }

    func run(_ api: any AnyLinkAPI) async throws {
        switch self {
        case .move(let ids, let to): try await api.bulk(.move(to: to), ids: ids)
        case .tag(let ids, let t): try await api.bulk(.tag(t), ids: ids)
        case .archive(let ids): try await api.bulk(.archive, ids: ids)
        case .trash(let ids): try await api.bulk(.trash, ids: ids)
        case .restore(let ids): try await api.bulk(.restore, ids: ids)
        case .purge(let ids): try await api.bulk(.purge, ids: ids)
        case .patch(let id, let note, let fav): try await api.updateLink(id, LinkPatch(note: note, favorite: fav))
        case .noteText(let id, let text): try await api.setNoteText(id, text)
        case .pin(let id, let pinned): try await api.updateLink(id, LinkPatch(pinned: pinned))
        case .highlight(let id, let quote): try await api.addHighlight(id, quote: quote)
        case .rename(let id, let name): try await api.updateCollection(id, name: name)
        case .priceAlert(let id, let t, let c): try await api.setPriceAlert(id, threshold: t, currency: c)
        case .dissolve(let id, let members, let inbox):
            if !members.isEmpty { try await api.bulk(.move(to: inbox), ids: members) }
            _ = try await api.deleteCollection(id)
        }
    }
}

public struct OutboxItem: Codable, Sendable, Equatable {
    public let op: PendingOp
    public var attempts: Int
}
