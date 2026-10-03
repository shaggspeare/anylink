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
/// A link the share extension saved without reaching the API. The app drains these into the library.
public struct PendingSave: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public var url: String
    public var title: String?
    public var note: String?
    public var collectionId: String?
    public let createdAt: Date
    public init(id: UUID = UUID(), url: String, title: String? = nil, note: String? = nil, collectionId: String? = nil, createdAt: Date = .now) {
        self.id = id; self.url = url; self.title = title; self.note = note; self.collectionId = collectionId; self.createdAt = createdAt
    }
}

@MainActor
public final class LocalCache {
    let container: ModelContainer
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
        container = try ModelContainer(for: CacheBlob.self, configurations: config)
        context = ModelContext(container)
    }

    /// The App Group store shared with the share extension, falling back to the app's own container.
    public static func appGroup(_ group: String = "group.app.anylink.ios") -> LocalCache? {
        let url = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)?
            .appending(path: "AnyLink.store")
        return (try? LocalCache(url: url)) ?? (try? LocalCache())
    }

    /// `fresh` reads through a new context: the app and the share extension write the same store from two processes.
    func read(_ key: String, fresh: Bool = false) -> Data? {
        let ctx = fresh ? ModelContext(container) : context
        return try? ctx.fetch(FetchDescriptor<CacheBlob>(predicate: #Predicate { $0.key == key })).first?.data
    }

    func write(_ key: String, _ data: Data, fresh: Bool = false) {
        let ctx = fresh ? ModelContext(container) : context
        if let row = try? ctx.fetch(FetchDescriptor<CacheBlob>(predicate: #Predicate { $0.key == key })).first {
            row.data = data
            row.savedAt = .now
        } else {
            ctx.insert(CacheBlob(key: key, data: data))
        }
        try? ctx.save()
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

    // MARK: - Shared with the share extension

    public func pendingSaves() -> [PendingSave] {
        read("pendingSaves", fresh: true).flatMap { try? JSONDecoder().decode([PendingSave].self, from: $0) } ?? []
    }

    public func upsertPendingSave(_ save: PendingSave) {
        var all = pendingSaves()
        if let i = all.firstIndex(where: { $0.id == save.id }) { all[i] = save } else { all.append(save) }
        if let data = try? JSONEncoder().encode(all) { write("pendingSaves", data, fresh: true) }
    }

    public func removePendingSaves(_ ids: Set<UUID>) {
        let rest = pendingSaves().filter { !ids.contains($0.id) }
        if let data = try? JSONEncoder().encode(rest) { write("pendingSaves", data, fresh: true) }
    }

    /// The four collections the extension offers under "Move to", written by the app.
    public func recentCollections() -> [LinkCollection] {
        read("recentCollections", fresh: true).flatMap { try? JSONDecoder().decode([LinkCollection].self, from: $0) } ?? []
    }

    public func saveRecentCollections(_ c: [LinkCollection]) {
        if let data = try? JSONEncoder().encode(c) { write("recentCollections", data, fresh: true) }
    }
}
