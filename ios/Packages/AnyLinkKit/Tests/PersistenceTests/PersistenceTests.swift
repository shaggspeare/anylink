import Testing
import Foundation
import Models
@testable import Persistence

@MainActor
@Suite struct LocalCacheTests {
    @Test func snapshotRoundTrips() throws {
        let cache = try LocalCache(inMemory: true)
        #expect(cache.loadSnapshot() == nil)
        let snap = LibrarySnapshot(links: [], trashed: [], collections: [LinkCollection(id: "unsorted", name: "Unsorted", color: "#9AA3AD", isInbox: true)])
        cache.save(snap)
        cache.save(snap)   // upsert, not a second row
        #expect(cache.loadSnapshot() == snap)
    }

    @Test func outboxBlob() throws {
        let cache = try LocalCache(inMemory: true)
        cache.saveOutbox(Data("[1]".utf8))
        cache.saveOutbox(Data("[2]".utf8))
        #expect(cache.loadOutbox() == Data("[2]".utf8))
    }
}
