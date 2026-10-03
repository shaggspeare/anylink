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
    case highlight(LinkItem.ID, quote: String)
    case rename(LinkCollection.ID, name: String)
    case priceAlert(LinkItem.ID, threshold: Double, currency: String)
    case dissolve(LinkCollection.ID, members: [LinkItem.ID], inbox: LinkCollection.ID)

    func run(_ api: any AnyLinkAPI) async throws {
        switch self {
        case .move(let ids, let to): try await api.bulk(.move(to: to), ids: ids)
        case .tag(let ids, let t): try await api.bulk(.tag(t), ids: ids)
        case .archive(let ids): try await api.bulk(.archive, ids: ids)
        case .trash(let ids): try await api.bulk(.trash, ids: ids)
        case .restore(let ids): try await api.bulk(.restore, ids: ids)
        case .purge(let ids): try await api.bulk(.purge, ids: ids)
        case .patch(let id, let note, let fav): try await api.updateLink(id, LinkPatch(note: note, favorite: fav))
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
