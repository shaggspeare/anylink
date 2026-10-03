import Network
import Store

/// Drains the outbox whenever the network comes back.
@MainActor
final class Reachability {
    private let monitor = NWPathMonitor()
    private let store: LibraryStore

    init(store: LibraryStore) { self.store = store }

    func start() async {
        let paths = AsyncStream<NWPath.Status> { cont in
            monitor.pathUpdateHandler = { cont.yield($0.status) }
            monitor.start(queue: .global(qos: .utility))
            cont.onTermination = { [monitor] _ in monitor.cancel() }
        }
        var wasOnline = true
        for await status in paths {
            let online = status == .satisfied
            if online && !wasOnline { store.drainOutbox() }
            wasOnline = online
        }
    }
}
