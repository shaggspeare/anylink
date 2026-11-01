import Testing
import Foundation
import SwiftData
import Models
@testable import Persistence

@MainActor
@Suite struct LocalStoreTests {
    func link(_ id: String, title: String = "A page", collection: String = "unsorted") -> LinkItem {
        LinkItem(id: id, url: "https://example.com/\(id)", domain: "example.com", title: title, excerpt: "", tint: "#9AA3AD",
                 stripe: "#FFFFFF", initial: "E", contentType: .article, collectionId: collection, tags: [], size: .M,
                 status: .ready, createdAt: "2026-11-01T10:00:00Z")
    }

    @Test func linksUpsertByID() throws {
        let store = try LocalStore()
        store.save([link("a"), link("b")])
        store.save([link("a", title: "Renamed")])
        #expect(store.links().count == 2)
        #expect(store.links(["a"]).first?.title == "Renamed")
        #expect(try store.context.fetchCount(FetchDescriptor<LinkRecord>()) == 2, "an upsert, not a second row")
        store.deleteLinks(["a"])
        #expect(store.links().map(\.id) == ["b"])
    }

    @Test func aDuplicateFromAnotherDeviceReadsAsOneAndBothUpdate() throws {
        let store = try LocalStore()
        store.save([link("a", title: "Old")])
        // CloudKit has no unique constraint: another device's copy of the same id arrives as a second row.
        let copy = LinkRecord(id: "a")
        copy.json = try JSONEncoder().encode(link("a", title: "Newer"))
        copy.updatedAt = .now.addingTimeInterval(60)
        store.context.insert(copy)
        try store.context.save()
        #expect(store.links().map(\.title) == ["Newer"])
        store.save([link("a", title: "Edited")])
        let titles = try store.context.fetch(FetchDescriptor<LinkRecord>()).map { try JSONDecoder().decode(LinkItem.self, from: $0.json).title }
        #expect(titles == ["Edited", "Edited"], "every copy takes the edit")
    }

    @Test func imageBytesTravelWithTheirLink() throws {
        let store = try LocalStore()
        let jpeg = Data([0xFF, 0xD8, 0xFF, 0xD9])
        store.save(link("img"), image: jpeg)
        store.save([link("img", title: "Captioned")])   // a later edit keeps the bytes
        #expect(store.image(for: "img") == jpeg)
        #expect(store.image(for: "nope") == nil)
    }

    @Test func collectionsKeepTheirOrder() throws {
        let store = try LocalStore()
        let reading = LinkCollection(id: "reading", name: "Reading", color: "#FF5A1F")
        let ios = LinkCollection(id: "ios", name: "iOS design", color: "#7C8CFF")
        store.save([reading])
        store.save([ios])
        var renamed = reading
        renamed.name = "To read"
        store.save([renamed])
        #expect(store.collections().map(\.name) == ["To read", "iOS design"], "renaming keeps the place")
        store.deleteCollections(["reading"])
        #expect(store.collections().map(\.id) == ["ios"])
    }

    /// The store's own saves post the same remote-change notification as CloudKit's imports; only imports count.
    @Test func onlyAnotherAuthorsSavesCountAsImported() throws {
        let dir = URL.temporaryDirectory.appending(path: "localstore-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: dir) }
        let store = try LocalStore(url: dir.appending(path: "Local.store"))
        store.save([link("mine")])
        #expect(!store.imported())

        let importer = ModelContext(store.container)
        importer.author = "NSCloudKitMirroringDelegate.import"
        let record = LinkRecord(id: "theirs")
        record.json = try JSONEncoder().encode(link("theirs"))
        importer.insert(record)
        try importer.save()
        #expect(store.imported())
        #expect(!store.imported(), "each import counts once")
        #expect(Set(store.links().map(\.id)) == ["mine", "theirs"])
    }
}
