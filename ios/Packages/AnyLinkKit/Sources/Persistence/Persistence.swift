import Foundation
import SwiftData
import Models

/// One row per blob: the last library snapshot, and the outbox. JSON blobs keep the schema stable while the
/// models move; views never see these types.
@Model final class CacheBlob {
    @Attribute(.unique) var key: String
    var data: Data
    var savedAt: Date
    init(key: String, data: Data) { self.key = key; self.data = data; savedAt = .now }
}

/// The app's offline cache (App Group container in the app, in-memory in tests and previews).
@MainActor
public final class LocalCache {
    let context: ModelContext

    public init(inMemory: Bool = false, url: URL? = nil) throws {
        let config: ModelConfiguration
        if inMemory {
            config = ModelConfiguration(isStoredInMemoryOnly: true)
        } else if let url {
            config = ModelConfiguration(url: url)
        } else {
            config = ModelConfiguration()
        }
        context = ModelContext(try ModelContainer(for: CacheBlob.self, configurations: config))
    }

    /// The App Group store shared with the share extension, falling back to the app's own container.
    public static func appGroup(_ group: String = "group.app.anylink.ios") -> LocalCache? {
        let url = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)?
            .appending(path: "AnyLink.store")
        return (try? LocalCache(url: url)) ?? (try? LocalCache())
    }

    func read(_ key: String) -> Data? {
        try? context.fetch(FetchDescriptor<CacheBlob>(predicate: #Predicate { $0.key == key })).first?.data
    }

    func write(_ key: String, _ data: Data) {
        if let row = try? context.fetch(FetchDescriptor<CacheBlob>(predicate: #Predicate { $0.key == key })).first {
            row.data = data
            row.savedAt = .now
        } else {
            context.insert(CacheBlob(key: key, data: data))
        }
        try? context.save()
    }

    public func loadSnapshot() -> LibrarySnapshot? {
        read("library").flatMap { try? JSONDecoder().decode(LibrarySnapshot.self, from: $0) }
    }

    public func save(_ snapshot: LibrarySnapshot) {
        if let data = try? JSONEncoder().encode(snapshot) { write("library", data) }
    }

    /// The outbox is opaque to Persistence: Store encodes its own pending operations.
    public func loadOutbox() -> Data? { read("outbox") }
    public func saveOutbox(_ data: Data) { write("outbox", data) }
}
