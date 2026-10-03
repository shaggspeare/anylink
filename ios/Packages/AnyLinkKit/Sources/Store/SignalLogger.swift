import Models
import Networking

/// Fire-and-forget `user_signals` logging. Never blocks, never surfaces errors.
public struct SignalLogger: Sendable {
    let api: any AnyLinkAPI
    public init(api: any AnyLinkAPI) { self.api = api }

    public func log(_ action: String, linkIds: [LinkItem.ID] = [], collectionId: LinkCollection.ID? = nil, payload: [String: String]? = nil) {
        let signal = Signal(
            action: action,
            linkId: linkIds.count == 1 ? linkIds[0] : nil,
            linkIds: linkIds.count > 1 ? linkIds : nil,
            collectionId: collectionId,
            payload: payload
        )
        Task { await api.logSignal(signal) }
    }
}
