import Foundation
import CloudKit
import CoreData
import SwiftData
import Models

// CloudKit's rules for these models: every property has a default, nothing is unique, no relationships (D28).

/// One link of a local library: the `LinkItem` as JSON.
@Model final class LinkRecord {
    var id: String = ""
    var json: Data = Data()
    var updatedAt: Date = Date.distantPast
    /// An image item's JPEG. External storage, so CloudKit sends it as an asset.
    @Attribute(.externalStorage) var image: Data?
    init(id: String) { self.id = id }
}

/// One collection of a local library: the `LinkCollection` as JSON. The inbox is built in, not stored.
@Model final class CollectionRecord {
    var id: String = ""
    var json: Data = Data()
    var updatedAt: Date = Date.distantPast
    /// Its place in the list: new ones go last.
    var position: Int = 0
    init(id: String) { self.id = id }
}

/// A free user's library (ADR 0002, D28): SwiftData in the App Group, mirrored by SwiftData to the user's private
/// CloudKit database. Writes upsert by `id`, one record per item. If two devices ever stored the same id, reads take
/// the newest copy and writes update every copy. `LocalAPI` (Store) is its only caller.
@MainActor
public final class LocalStore {
    public static let cloudKitContainer = "iCloud.com.shaggspeare.anylink"
    /// The author of this store's saves, so `imported()` can tell CloudKit's apart.
    static let author = "app"
    let container: ModelContainer
    let context: ModelContext
    private var historyToken: DefaultHistoryToken?

    /// `url` nil keeps it in memory (tests, previews, UI tests). `cloudKit` is the container to mirror to; nil
    /// mirrors nothing.
    public init(url: URL? = nil, cloudKit: String? = nil) throws {
        let schema = Schema([LinkRecord.self, CollectionRecord.self])
        let config = if let url {
            ModelConfiguration("Local", schema: schema, url: url, cloudKitDatabase: cloudKit.map { .private($0) } ?? .none)
        } else {
            ModelConfiguration("Local", schema: schema, isStoredInMemoryOnly: true, cloudKitDatabase: .none)
        }
        container = try ModelContainer(for: schema, configurations: config)
        context = container.mainContext
        context.author = Self.author
        var newest = HistoryDescriptor<DefaultHistoryTransaction>(sortBy: [SortDescriptor(\.transactionIdentifier, order: .reverse)])
        newest.fetchLimit = 1
        historyToken = try? context.fetchHistory(newest).first?.token
    }

    /// `Local.store` in the App Group container, synced through iCloud.
    public static func appGroup(_ group: String = LocalImages.group) -> LocalStore? {
        let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) ?? .applicationSupportDirectory
        try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        return try? LocalStore(url: base.appending(path: "Local.store"), cloudKit: cloudKitContainer)
    }

    /// Whether this device has an iCloud account CloudKit can sync with. Without one, saves stay on the device and
    /// SwiftData syncs them once there is. Needs the app's iCloud entitlement: don't call it from tests or previews.
    public static func iCloudAvailable() async -> Bool {
        (try? await CKContainer(identifier: cloudKitContainer).accountStatus()) == .available
    }

    // MARK: - Links

    /// Every link, trashed ones included.
    public func links() -> [LinkItem] {
        newest(fetch(FetchDescriptor<LinkRecord>()), id: \.id, date: \.updatedAt).compactMap { decode($0.json) }
    }

    public func links(_ ids: [LinkItem.ID]) -> [LinkItem] {
        newest(linkRecords(ids), id: \.id, date: \.updatedAt).compactMap { decode($0.json) }
    }

    public func save(_ links: [LinkItem]) {
        upsert(links, image: nil)
    }

    /// An image item and its JPEG.
    public func save(_ link: LinkItem, image: Data) {
        upsert([link], image: image)
    }

    public func image(for id: LinkItem.ID) -> Data? {
        linkRecords([id]).lazy.compactMap(\.image).first
    }

    public func deleteLinks(_ ids: [LinkItem.ID]) {
        for r in linkRecords(ids) { context.delete(r) }
        try? context.save()
    }

    private func linkRecords(_ ids: [LinkItem.ID]) -> [LinkRecord] {
        fetch(FetchDescriptor<LinkRecord>(predicate: #Predicate { ids.contains($0.id) }))
    }

    private func upsert(_ links: [LinkItem], image: Data?) {
        guard !links.isEmpty else { return }
        let existing = Dictionary(grouping: linkRecords(links.map(\.id)), by: \.id)
        let now = Date.now
        for link in links {
            guard let json = try? JSONEncoder().encode(link) else { continue }
            for r in existing[link.id] ?? [insert(LinkRecord(id: link.id))] {
                r.json = json
                r.updatedAt = now
                if let image { r.image = image }
            }
        }
        try? context.save()
    }

    // MARK: - Collections

    /// In list order.
    public func collections() -> [LinkCollection] {
        newest(fetch(FetchDescriptor<CollectionRecord>()), id: \.id, date: \.updatedAt)
            .sorted { ($0.position, $0.id) < ($1.position, $1.id) }
            .compactMap { decode($0.json) }
    }

    public func save(_ collections: [LinkCollection]) {
        guard !collections.isEmpty else { return }
        var last = fetch(FetchDescriptor<CollectionRecord>()).map(\.position).max() ?? 0
        let existing = Dictionary(grouping: collectionRecords(collections.map(\.id)), by: \.id)
        let now = Date.now
        for c in collections {
            guard let json = try? JSONEncoder().encode(c) else { continue }
            let records = existing[c.id] ?? {
                last += 1
                let r = insert(CollectionRecord(id: c.id))
                r.position = last
                return [r]
            }()
            for r in records {
                r.json = json
                r.updatedAt = now
            }
        }
        try? context.save()
    }

    public func deleteCollections(_ ids: [LinkCollection.ID]) {
        for r in collectionRecords(ids) { context.delete(r) }
        try? context.save()
    }

    private func collectionRecords(_ ids: [LinkCollection.ID]) -> [CollectionRecord] {
        fetch(FetchDescriptor<CollectionRecord>(predicate: #Predicate { ids.contains($0.id) }))
    }

    // MARK: - Changes from other devices

    /// Yields when CloudKit has brought in another device's links or collections. This store's own saves post the
    /// same notification, so each one is checked against the persistent history first.
    public func remoteChanges() -> AsyncStream<Void> {
        let (stream, cont) = AsyncStream.makeStream(of: Void.self, bufferingPolicy: .bufferingNewest(1))
        let task = Task { [weak self] in
            for await _ in NotificationCenter.default.notifications(named: .NSPersistentStoreRemoteChange).map({ _ in }) {
                if self?.imported() == true { cont.yield() }
            }
        }
        cont.onTermination = { _ in task.cancel() }
        return stream
    }

    /// True when a save by another author (CloudKit's import) touched links or collections since the last look.
    func imported() -> Bool {
        var descriptor = HistoryDescriptor<DefaultHistoryTransaction>()
        if let token = historyToken { descriptor.predicate = #Predicate { $0.token > token } }
        guard let transactions = try? context.fetchHistory(descriptor) else { return false }
        if let last = transactions.last { historyToken = last.token }
        let ours: Set = ["LinkRecord", "CollectionRecord"]
        return transactions.contains { t in
            t.author != Self.author && t.changes.contains { ours.contains($0.changedPersistentIdentifier.entityName) }
        }
    }

    // MARK: - Plumbing

    private func fetch<T: PersistentModel>(_ descriptor: FetchDescriptor<T>) -> [T] {
        (try? context.fetch(descriptor)) ?? []
    }

    private func insert<T: PersistentModel>(_ record: T) -> T {
        context.insert(record)
        return record
    }

    private func decode<T: Decodable>(_ json: Data) -> T? {
        try? JSONDecoder().decode(T.self, from: json)
    }

    /// One record per id, the most recently written.
    private func newest<T>(_ records: [T], id: KeyPath<T, String>, date: KeyPath<T, Date>) -> [T] {
        var best: [String: T] = [:]
        for r in records where best[r[keyPath: id]].map({ $0[keyPath: date] <= r[keyPath: date] }) ?? true {
            best[r[keyPath: id]] = r
        }
        return Array(best.values)
    }
}
