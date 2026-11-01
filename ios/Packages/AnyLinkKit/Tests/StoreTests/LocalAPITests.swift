import Testing
import Foundation
import Models
import Networking
import Persistence
import Fixtures
@testable import Store

/// No Secure Enclave in tests: calls go out unsigned, as on a device that can't attest.
struct NoAttest: AppAttesting {
    func headers(for body: Data) async -> [String: String] { [:] }
    func forgetKey() async {}
}

@MainActor
@Suite struct LocalAPITests {
    let local: LocalStore
    let api: LocalAPI
    let store: LibraryStore

    /// Pages "read" with MockAPI's recorded success stream, so a background read fills in its title.
    init() throws {
        local = try LocalStore()
        let mock = MockAPI.fixtures(latency: false)
        api = LocalAPI(store: local, crawler: { url in await mock.crawl(url) })
        store = LibraryStore(api: api)
    }

    func reread() async -> LibraryStore {
        let fresh = LibraryStore(api: LocalAPI(store: local, crawler: nil))
        await fresh.refresh()
        return fresh
    }

    var crawled: CrawlResult {
        get throws {
            guard case .done(let r) = try NDJSONDecoder.decodeLine(Fixtures.crawlSuccessLines.last!, as: CrawlEvent.self) else {
                throw AppError.decoding
            }
            return r
        }
    }

    @Test func savesMovesTagsTrashesAndRestores() async throws {
        let reading = try #require(await store.createCollection(name: "Reading", color: "#FF5A1F"))
        let saved = try #require(await store.save(LinkDraft(url: "https://www.theverge.com/a", crawl: try crawled)))
        #expect(saved.status == .ready && saved.collectionId == "unsorted")
        store.move([saved.id], to: reading.id)
        store.tag([saved.id], "ios")
        store.trash([saved.id])
        await store.settle()
        var again = await reread()
        #expect(again.trash.map(\.id) == [saved.id])
        #expect(again.link(saved.id)?.collectionId == reading.id && again.link(saved.id)?.tags.contains("ios") == true)

        store.restore([saved.id])
        await store.settle()
        again = await reread()
        #expect(again.live.map(\.id) == [saved.id])
        #expect(again.collections.map(\.name) == ["Unsorted", "Reading"], "the inbox is built in")
    }

    @Test func snapshotRoundTrips() async throws {
        await store.refresh()
        _ = await store.createFilter(name: "Video", query: "type:video")
        _ = await store.saveNote("Groceries\nmilk")
        let link = try #require(await store.save(LinkDraft(url: "https://example.com/a", crawl: try crawled)))
        store.setFavorite(link.id, true)
        store.addHighlight(link.id, quote: "floats")
        store.setPinned(link.id, true)
        store.archive([store.live.first { $0.isNote }!.id])
        await store.refresh()
        let saved = store.snapshot
        let again = await reread().snapshot
        #expect(Set(again.links) == Set(saved.links))
        #expect(again.collections == saved.collections)
        #expect(again.plan == nil, "a local library is free")
        let kept = try #require(again.links.first { $0.id == link.id })
        #expect(kept.favorite == true && kept.pinned == true && kept.highlights?.map(\.quote) == ["floats"])
        #expect(again.links.contains { $0.isNote && $0.archived == true })
    }

    @Test func importSkipsURLsAlreadyThere() async throws {
        _ = try await api.importLinks([ImportItem(url: "https://Example.com/a/", title: "A", source: "chrome")])
        let result = try await api.importLinks([
            ImportItem(url: "https://example.com/a", title: "Again", source: "safari"),
            ImportItem(url: "https://example.com/b", title: "B", source: "safari"),
            ImportItem(url: "https://example.com/b/", title: "B twice", source: "safari"),
        ])
        #expect(result.links.map(\.title) == ["B"])
        #expect(result.skipped == 2)
        #expect(try await api.library(since: nil).links.count == 2)
    }

    @Test func proFeaturesSayPro() async throws {
        await #expect(throws: AppError.proRequired) { _ = try await api.setShared("x", true) }
        await #expect(throws: AppError.proRequired) { try await api.setPriceAlert("x", threshold: 1, currency: "$") }
        await #expect(throws: AppError.proRequired) { _ = try await api.export(format: .json) }
    }

    @Test func pinLimitIsTwo() async throws {
        for url in ["https://a.com", "https://b.com", "https://c.com"] {
            _ = await store.save(LinkDraft(url: url, crawl: try crawled))
        }
        let ids = store.live.map(\.id)
        try await api.updateLink(ids[0], LinkPatch(pinned: true))
        try await api.updateLink(ids[1], LinkPatch(pinned: true))
        await #expect(throws: AppError.pinLimit) { try await api.updateLink(ids[2], LinkPatch(pinned: true)) }
    }

    @Test func deletingACollectionSendsItsLinksToUnsorted() async throws {
        let c = try await api.createCollection(name: "Old", color: "#7C8CFF", icon: nil)
        let link = try await api.createLink(LinkDraft(url: "https://example.com/a", collectionId: c.id, crawl: try crawled))
        #expect(link.collectionId == c.id)
        #expect(try await api.deleteCollection(c.id).isEmpty)
        let lib = try await api.library(since: nil)
        #expect(lib.links.first?.collectionId == "unsorted")
        #expect(lib.collections.map(\.id) == ["unsorted"])
        let stray = try await api.createLink(LinkDraft(url: "https://example.com/b", collectionId: c.id, crawl: try crawled))
        #expect(stray.collectionId == "unsorted", "an unknown collection files into the inbox")
    }

    /// The share extension's saves have no page data: they show at once, and the page is read in the background.
    @Test func drainedPendingSavesAreReadInTheBackground() async throws {
        let cache = try LocalCache(inMemory: true)
        cache.upsertPendingSave(PendingSave(url: "https://www.theverge.com/2026/10/story", title: "A story I shared", note: "for later"))
        cache.upsertPendingSave(PendingSave(url: "https://www.theverge.com/2026/10/other"))
        var changed = 0
        api.onChange = { changed += 1 }
        await store.drainPendingSaves(from: cache)
        #expect(cache.pendingSaves().isEmpty)
        #expect(store.live.count == 2)
        #expect(store.live.allSatisfy { $0.status == .crawling })

        while changed < 2 { await Task.yield() }
        await store.refresh()
        let shared = try #require(store.live.first { $0.note == "for later" })
        #expect(shared.status == .ready)
        #expect(shared.title == "A story I shared", "a real title from the share sheet stays")
        #expect(shared.excerpt.hasPrefix("How the new floating tab bar"))
        let bare = try #require(store.live.first { $0.note == nil })
        #expect(bare.title == "Designing tab bars for iOS 26", "a domain-only title takes the page's")
    }

    @Test func editsMadeWhileAPageIsReadSurvive() async throws {
        let release = AsyncStream.makeStream(of: Void.self)
        let slow = LocalAPI(store: local, crawler: { url in
            for await _ in release.stream { break }
            return await MockAPI.fixtures(latency: false).crawl(url)
        })
        var changed = false
        slow.onChange = { changed = true }
        let link = try await slow.createLink(LinkDraft(url: "https://example.com/slow"))
        try await slow.bulk(.tag("later"), ids: [link.id])
        release.continuation.yield()
        while !changed { await Task.yield() }
        let now = try #require(try await slow.library(since: nil).links.first)
        #expect(now.tags.contains("later") && now.status == .ready)
    }

    @Test func anImageFromAnotherDeviceGetsItsFile() async throws {
        let jpeg = Data([0xFF, 0xD8, 0xFF, 0xD9])
        let image = try await api.createImage(jpeg, collectionId: nil, caption: "Receipt")
        defer { LocalImages.remove(image.id) }
        LocalImages.remove(image.id)   // as on a device that only has the synced record
        _ = try await api.library(since: nil)
        #expect(LocalImages.existing(for: image.id).flatMap { try? Data(contentsOf: $0) } == jpeg)
    }
}

/// The local library's server calls, on `APIStub`: in `SyncTests` so they never run alongside its other users.
extension SyncTests {
    func localServices() -> LocalServices {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [APIStub.self]
        return LocalServices(base: URL(string: "https://anylink.test")!, attest: NoAttest(), session: URLSession(configuration: config))
    }

    @Test func importCheckRecordsDeadLinksAndCountsWhatsLeft() async throws {
        let checking = LocalAPI(store: try LocalStore(), crawler: nil, services: localServices())
        let imported = try await checking.importLinks([
            ImportItem(url: "https://gone.example/a", title: "Gone", source: "chrome"),
            ImportItem(url: "https://fine.example/b", title: "Fine", source: "chrome"),
            ImportItem(url: "https://late.example/c", title: "Late", source: "chrome"),
        ]).links
        let gone = imported[0]
        // Checked in order (fine, gone, late), and the server got to two of the three before its time ran out.
        APIStub.reset { req, _ in
            req.url?.path() == "/api/v1/local/check"
                ? (200, """
                {"type":"start","total":3}
                {"type":"progress","checked":1,"dead":1}
                {"type":"done","checked":2,"dead":[{"id":"\(gone.id)","url":"\(gone.url)","title":"Gone","status":404}],"remaining":1}
                """)
                : nil
        }
        var events: [LinkCheckEvent] = []
        for try await e in await checking.checkImportedLinks() { events.append(e) }
        #expect(events.last?.remaining == 1)
        #expect(events.last?.dead?.map(\.id) == [gone.id])
        let lib = try await checking.library(since: nil).links
        #expect(lib.first { $0.id == gone.id }?.httpStatus == 404)
        #expect(lib.first { $0.title == "Fine" }?.httpStatus == 200)
        #expect(lib.first { $0.title == "Late" }?.httpStatus == nil)
        #expect(APIStub.log.last?.body.contains("fine.example") == true)
    }

    @Test func groupingUsesTheServerThenFallsBackToFolders() async throws {
        let grouping = LocalAPI(store: try LocalStore(), crawler: nil, services: localServices())
        let items = (1...3).map { ImportItem(url: "https://swift.org/\($0)", title: "Swift \($0)", source: "chrome", meta: ImportMeta(folder: "Dev/Swift")) }
        let ids = try await grouping.importLinks(items).links.map(\.id)
        let answer = GroupedResult(collection: LinkCollection(id: "c1", name: "Swift", color: "#FF5A1F", reasoning: "Same language", createdBy: "system"),
                                   linkIds: ids, reasoning: "Same language")
        let json = String(decoding: try JSONEncoder().encode([answer]), as: UTF8.self)
        APIStub.reset { _, _ in (200, json) }
        #expect(try await grouping.groupInbox(GroupingPriorities()).map(\.collection.id) == ["c1"])
        var lib = try await grouping.library(since: nil)
        #expect(lib.links.allSatisfy { $0.collectionId == "c1" })
        #expect(lib.collections.map(\.name) == ["Unsorted", "Swift"])

        // Offline: the folders still group.
        try await grouping.bulk(.move(to: "unsorted"), ids: ids)
        APIStub.reset { _, _ in nil }
        let fallback = try await grouping.groupInbox(GroupingPriorities())
        #expect(fallback.map(\.collection.name) == ["Swift"])
        lib = try await grouping.library(since: nil)
        #expect(lib.links.allSatisfy { $0.collectionId == fallback[0].collection.id })
    }
}
