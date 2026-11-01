import Testing
import Foundation
import Models
import Networking
import Persistence
import Fixtures
@testable import Store

/// Upgrade and lapse (CONTEXT.md): the local library goes up in resumable batches, the server library comes down as a
/// union, and neither loses nor doubles anything.
@MainActor
@Suite struct LibraryMoveTests {
    let local: LocalStore
    let defaults: UserDefaults

    init() throws {
        local = try LocalStore()
        defaults = try #require(UserDefaults(suiteName: "LibraryMoveTests.\(UUID().uuidString)"))
    }

    func link(_ id: String, url: String = "", type: ContentType = .article, in collection: String = "unsorted",
              second: Int = 0, tags: [String] = []) -> LinkItem {
        LinkItem(id: id, url: url, domain: URL(string: url)?.host() ?? "", title: id, excerpt: "", tint: "#000", stripe: "#FFF",
                 initial: "A", contentType: type, collectionId: collection, tags: tags, size: .M, status: .ready,
                 createdAt: Date(timeIntervalSince1970: 1_780_000_000 + Double(second)).formatted(.iso8601))
    }

    @Test func urlKeysMatchTheServers() {
        let same = [("https://www.example.com/a/", "http://example.com/a"),
                    ("https://Example.COM/a?utm_source=x&fbclid=y", "https://example.com/a"),
                    ("  https://example.com/a  ", "https://example.com/a"),
                    ("https://example.com/", "https://example.com")]
        for (a, b) in same { #expect(LibraryRules.urlKey(a) == LibraryRules.urlKey(b), "\(a) is \(b)") }
        let different = [("https://example.com/A", "https://example.com/a"),
                         ("https://example.com/a?id=1", "https://example.com/a?id=2"),
                         ("https://example.com/a#one", "https://example.com/a#two"),
                         ("https://example.com:8080/a", "https://example.com/a"),
                         ("https://m.example.com/a", "https://example.com/a")]
        for (a, b) in different { #expect(LibraryRules.urlKey(a) != LibraryRules.urlKey(b), "\(a) isn't \(b)") }
        #expect(LibraryRules.urlKey("https://www.example.com/a/?b=1#c") == "example.com/a?b=1#c", "the key urlKey makes on the server")
    }

    @Test func mergeIsTheServersRule() {
        var web = link("web", url: "https://e.com", second: 50, tags: ["x", "y"])
        web.note = "web"; web.favorite = true; web.highlights = [Highlight(id: "1", quote: "one")]
        var phone = link("phone", url: "https://e.com", second: 10, tags: ["y", "z"])
        phone.note = "phone"; phone.pinned = true; phone.highlights = [Highlight(id: "2", quote: "one"), Highlight(id: "3", quote: "two")]
        let m = LibraryRules.merge(web, phone)
        #expect(m.id == "web" && m.tags == ["x", "y", "z"] && m.highlights?.map(\.quote) == ["one", "two"])
        #expect(m.note == "web\n\nphone" && m.createdAt == phone.createdAt && m.pinned == true && m.favorite == true)
        #expect(LibraryRules.merge(m, phone) == m, "merging again changes nothing")
    }

    @Test func upgradeResumesWhereItStopped() async throws {
        local.save((0..<250).map { link("L\($0)", url: "https://example.com/\($0)", second: $0) })
        local.save(link("img", type: .image, second: 300), image: Data(repeating: 7, count: 1_000))
        local.save([LinkCollection(id: "c1", name: "Reading", color: "#FFF")])
        var sent: [[LinkItem.ID]] = []
        var calls = 0
        do {
            try await LibraryMove.upgrade(local, account: "a", defaults: defaults, send: { upload in
                calls += 1
                if calls == 2 { throw AppError.offline }
                sent.append(upload.links.map(\.item.id))
            })
            Issue.record("the second batch fails")
        } catch {
            #expect(error as? AppError == .offline)
        }
        #expect(sent.map(\.count) == [200])

        var done: [Int] = []
        try await LibraryMove.upgrade(local, account: "a", defaults: defaults, send: { upload in
            #expect(upload.collections.map(\.name) == ["Unsorted", "Reading"], "every collection, every batch")
            sent.append(upload.links.map(\.item.id))
            if let image = upload.links.first(where: { $0.item.isImage }) { #expect(image.image?.count == 1_000 && upload.links.count == 1) }
        }, progress: { n, total in
            done.append(n)
            #expect(total == 251)
        })
        #expect(sent.map(\.count) == [200, 50, 1], "the rest, then the image on its own")
        #expect(Set(sent.joined()).count == 251, "each record once")
        #expect(done == [200, 250, 251])
        #expect(local.links().count == 251, "the local store stays as it was")
    }

    @Test func upgradingTwiceDoublesNothing() async throws {
        let server = MockAPI.fixtures(latency: false)
        let nasa = try #require(Fixtures.links.first { $0.id == "nasa" })
        var overlap = link("L1", url: nasa.url.replacingOccurrences(of: "https://", with: "http://") + "/", in: "c1", tags: ["space"])
        overlap.note = "from the phone"
        local.save([overlap, link("L2", url: "https://example.com/new", in: "c1"), link("N1", type: .note, second: 3)])
        local.save([LinkCollection(id: "c1", name: "reading", color: "#FFF")])
        let before = try await server.library(since: nil)
        let send: (LibraryUpload) async throws -> Void = { try await server.uploadLibrary($0) }

        try await LibraryMove.upgrade(local, account: "a", defaults: defaults, send: send)
        let once = try await server.library(since: nil)
        #expect(once.links.count == before.links.count + 2, "the new page and the note; the same page merged")
        let merged = try #require(once.links.first { $0.id == "nasa" })
        #expect(merged.tags.contains("space") && merged.note?.contains("from the phone") == true)
        #expect(once.collections.count == before.collections.count, "reading is Reading")
        #expect(once.links.first { $0.id == "L2" }.map { $0.collectionId == "reading" && $0.aiPending == true } == true)

        try await LibraryMove.upgrade(local, account: "a", defaults: defaults, send: { _ in Issue.record("nothing left to send") })
        // After a lapse everything goes up again, and the server matches all of it.
        defaults.removeObject(forKey: LibraryMove.progressKey("a"))
        try await LibraryMove.upgrade(local, account: "a", defaults: defaults, send: send)
        #expect(try await server.library(since: nil) == once)
    }

    @Test func lapseKeepsEverythingAndAddsTheServers() throws {
        var trashed = link("T1", url: "https://example.com/trashed")
        trashed.deleted = true
        local.save([link("L1", url: "https://example.com/a", in: "c1", tags: ["phone"]), link("L2", url: "https://example.com/only-here"),
                    link("N1", type: .note), trashed])
        local.save([LinkCollection(id: "c1", name: "Reading", color: "#FFF")])
        defaults.set(["L1", "L2"], forKey: LibraryMove.progressKey("a"))
        let mine = Set(local.links().map(\.id))

        // The server: L1 (same page) with its AI summary, the note uploaded as N1, and a link saved on the web.
        var s1 = link("s1", url: "https://www.example.com/a/", in: "srv-reading", tags: ["ai"])
        s1.excerpt = "A summary"
        var s2 = link("s2", type: .note)
        s2.clientId = "N1"
        s2.note = "added on the web"
        let server = LibrarySnapshot(links: [s1, s2, link("s3", url: "https://example.com/web-only", in: "srv-new")], trashed: [],
                                     collections: [LinkCollection(id: "srv-inbox", name: "Unsorted", color: "#000", isInbox: true),
                                                   LinkCollection(id: "srv-reading", name: "reading", color: "#000"),
                                                   LinkCollection(id: "srv-new", name: "From the web", color: "#000", shareToken: "tok")],
                                     plan: "free")
        LibraryMove.lapse(server, into: local, account: "a", defaults: defaults)

        let after = local.links()
        #expect(mine.isSubset(of: Set(after.map(\.id))), "nothing deleted")
        #expect(after.count == mine.count + 1, "only the web's own link is new")
        let l1 = try #require(after.first { $0.id == "L1" })
        #expect(l1.excerpt == "A summary" && Set(l1.tags) == ["ai", "phone"] && l1.collectionId == "c1")
        #expect(after.first { $0.id == "N1" }?.note == "added on the web")
        #expect(after.first { $0.id == "T1" }?.deleted == true)
        #expect(after.first { $0.id == "s3" }?.collectionId == "srv-new")
        #expect(local.collections().map(\.name) == ["Reading", "From the web"])
        #expect(local.collections().allSatisfy { $0.shareToken == nil }, "a local library shares nothing")
        #expect(defaults.stringArray(forKey: LibraryMove.progressKey("a")) == nil, "going Pro again sends everything")

        LibraryMove.lapse(server, into: local, account: "a", defaults: defaults)
        #expect(Set(local.links()) == Set(after), "a second lapse changes nothing")
    }

    @Test func openingAPendingLinkOnProEnrichesItOnce() async throws {
        var pending = link("p", url: "https://example.com/p")
        pending.aiPending = true
        let free = LibraryStore(api: MockAPI(links: [pending], trashed: [], collections: [], latency: false),
                                snapshot: LibrarySnapshot(links: [pending], trashed: [], collections: [], plan: "free"))
        await free.enrichIfPending("p")
        #expect(free.link("p")?.aiPending == true, "Free never asks")

        let pro = LibraryStore(api: MockAPI(links: [pending], trashed: [], collections: [], latency: false),
                               snapshot: LibrarySnapshot(links: [pending], trashed: [], collections: [], plan: "pro"))
        await pro.enrichIfPending("p")
        #expect(pro.link("p")?.aiPending == false)
    }
}
