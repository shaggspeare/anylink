import Testing
import Foundation
import Models
import Networking
import QueryLanguage
import Fixtures
@testable import Store

@MainActor
@Suite struct LibraryStoreTests {
    let api = MockAPI.fixtures(latency: false)
    let store: LibraryStore

    init() {
        store = LibraryStore(api: api, snapshot: Fixtures.library)
    }

    struct State: Equatable {
        let links: [LinkItem.ID: LinkItem]
        let order: [LinkItem.ID]
        let collections: [LinkCollection]
    }
    var state: State { State(links: store.links, order: store.order, collections: store.collections) }
    let generic = "That didn't go through. Try again."

    // MARK: Loading

    @Test func loadsSnapshot() {
        #expect(store.live.count == 18)
        #expect(store.trash.map(\.id).sorted() == ["tr1", "tr2"])
        #expect(store.inboxID == "unsorted")
        #expect(store.order.first == store.live.map(\.id).first)
    }

    @Test func smartCollectionCountsByQuery() {
        let smart = store.collections.first { $0.isSmart == true }!
        #expect(store.count(in: smart.id) == store.links(matching: Query(smart.smartQuery ?? "")).count)
    }

    @Test func refreshReplacesState() async throws {
        let empty = LibraryStore(api: api)
        await empty.refresh()
        #expect(empty.live.count == 18)
        #expect(empty.syncState == .idle)
    }

    @Test func refreshOfflineSetsState() async throws {
        await api.failNext(.offline)
        await store.refresh()
        #expect(store.syncState == .offline)
    }

    // MARK: Move

    @Test func moveThenUndoRestoresExactState() async throws {
        let before = state
        store.move(["nasa", "iph"], to: "cooking")
        #expect(store.link("nasa")?.collectionId == "cooking")
        #expect(store.toasts.current?.message == "Moved to Cooking")
        store.toasts.performUndo()
        #expect(state == before)
        await store.settle()
        let server = try? await api.library(since: nil)
        #expect(server?.links.first { $0.id == "nasa" }?.collectionId == "reading")
        #expect(server?.links.first { $0.id == "iph" }?.collectionId == "unsorted")
    }

    @Test func moveRollsBackOnFailure() async throws {
        let before = state
        await api.failNext(.server(500))
        store.move(["nasa"], to: "cooking")
        await store.settle()
        #expect(state == before)
        #expect(store.toasts.current?.message == generic)
    }

    @Test func undoRunsOnce() {
        let before = state
        store.move(["nasa"], to: "cooking")
        let undo = store.toasts.current?.undo
        undo?()
        store.move(["nasa"], to: "home")
        undo?()   // stale Undo must not revert the newer move
        #expect(store.link("nasa")?.collectionId == "home")
        _ = before
    }

    // MARK: Trash / restore / purge

    @Test func trashThenUndo() async throws {
        let before = state
        store.trash(["nasa"])
        #expect(store.link("nasa")?.deleted == true)
        #expect(store.toasts.current?.message == "Moved to Trash")
        store.toasts.performUndo()
        #expect(state == before)
        await store.settle()
        #expect(try await api.library(since: nil).links.contains { $0.id == "nasa" })
    }

    @Test func trashManyCopy() {
        store.trash(["nasa", "iph", "glass"])
        #expect(store.toasts.current?.message == "3 links moved to Trash")
    }

    @Test func trashRollsBack() async throws {
        let before = state
        await api.failNext(.offline)
        store.trash(["nasa"])
        await store.settle()
        #expect(state == before)
    }

    @Test func restore() async throws {
        store.restore(["tr1"])
        #expect(store.link("tr1")?.deleted == false)
        #expect(store.toasts.current?.message == "Restored to Rust & async" || store.toasts.current?.message.hasPrefix("Restored to") == true)
        await store.settle()
        #expect(try await api.library(since: nil).links.contains { $0.id == "tr1" })
    }

    @Test func purgeAndRollback() async throws {
        store.purge(["tr1"])
        #expect(store.link("tr1") == nil)
        await store.settle()
        let before = state
        await api.failNext(.server(500))
        store.purge(["tr2"])
        await store.settle()
        #expect(state == before)
    }

    @Test func emptyTrash() async throws {
        store.emptyTrash()
        #expect(store.trash.isEmpty)
        #expect(store.toasts.current?.message == "Trash emptied")
        await store.settle()
        #expect(try await api.library(since: nil).trashed.isEmpty)
    }

    // MARK: Field edits

    @Test func favoriteNoteHighlightTag() async throws {
        store.setFavorite("iph", true)
        #expect(store.toasts.current?.message == "Added to favorites")
        store.setNote("iph", "read later")
        #expect(store.link("iph")?.note == "read later")
        store.addHighlight("iph", quote: "quote")
        #expect(store.link("iph")?.highlights?.last?.quote == "quote")
        store.tag(["iph", "water"], "#later")
        #expect(store.toasts.current?.message == "Tagged 2 links #later")
        #expect(store.link("water")?.tags.contains("later") == true)
        await store.settle()
        let server = try? await api.library(since: nil).links.first { $0.id == "iph" }
        #expect(server?.favorite == true)
        #expect(server?.note == "read later")
        #expect(server?.tags.contains("later") == true)
    }

    @Test func favoriteRollsBack() async throws {
        let before = state
        await api.failNext(.server(503))
        store.setFavorite("iph", true)
        await store.settle()
        #expect(state == before)
    }

    @Test func archiveThenUndo() {
        let before = state
        store.archive(["nasa"])
        #expect(!store.live.contains { $0.id == "nasa" })
        #expect(store.toasts.current?.message == "Archived 1 link")
        store.toasts.performUndo()
        #expect(state == before)
    }

    // MARK: Save

    @Test func saveReplacesTempWithServerCopy() async throws {
        let saved = await store.save(LinkDraft(url: "https://example.com/a"))
        #expect(saved != nil)
        #expect(store.order.first == saved?.id)
        #expect(!store.links.keys.contains { $0.hasPrefix("local-") })
        #expect(store.toasts.current?.message == "Saved to Unsorted")
    }

    @Test func saveFailureRemovesTemp() async throws {
        let before = state
        await api.failNext(.offline)
        let saved = await store.save(LinkDraft(url: "https://example.com/a"))
        #expect(saved == nil)
        #expect(state == before)
    }

    // MARK: Collections

    @Test func renameAndRollback() async throws {
        store.rename("home", to: "House")
        #expect(store.name(of: "home") == "House")
        await store.settle()
        await api.failNext(.server(500))
        store.rename("home", to: "Flat")
        await store.settle()
        #expect(store.name(of: "home") == "House")
    }

    @Test func dissolveThenUndo() async throws {
        let before = state
        let members = store.links(in: "cooking").map(\.id)
        store.dissolve("cooking")
        #expect(store.collection("cooking") == nil)
        #expect(members.allSatisfy { store.link($0)?.collectionId == "unsorted" })
        #expect(store.toasts.current?.message == "Cooking dissolved — \(members.count) links back in Unsorted")
        store.toasts.performUndo()
        #expect(state == before)
        await store.settle()
        // The server recreates the collection under a new id; membership and name survive.
        let c = store.collections.first { $0.name == "Cooking" }
        #expect(c != nil)
        #expect(Set(store.links(in: c!.id).map(\.id)) == Set(members))
        let server = try? await api.library(since: nil)
        #expect(server?.links.filter { $0.collectionId == c!.id }.count == members.count)
    }

    @Test func dissolveInboxIsIgnored() {
        let before = state
        store.dissolve("unsorted")
        #expect(state == before)
    }

    @Test func dissolveRollsBack() async throws {
        let before = state
        await api.failNext(.server(500))
        store.dissolve("cooking")
        await store.settle()
        #expect(state == before)
    }

    @Test func createCollectionAndFilter() async throws {
        let c = await store.createCollection(name: "Music", color: "#7C8CFF")
        #expect(store.collection(c!.id)?.name == "Music")
        let f = await store.createFilter(name: "Videos", query: "type:video")
        #expect(store.count(in: f!.id) == 2)
        #expect(store.toasts.current?.message == "Saved as a filter in Collections")
    }

    @Test func deleteEmptyCollections() async throws {
        _ = await store.createCollection(name: "Empty", color: "#9AA3AD")
        await store.deleteEmptyCollections()
        #expect(!store.collections.contains { $0.name == "Empty" })
        #expect(store.toasts.current?.message.hasPrefix("Removed") == true)
    }
}

@MainActor
@Suite struct RouterTests {
    @Test func tappingActiveTabPopsThenScrolls() {
        let r = Router()
        r.open(.trash)
        r.open(.link("nasa"))
        r.select(.library)
        #expect(r.library.isEmpty)
        #expect(r.scrollToTop[.library] == nil)
        r.select(.library)
        #expect(r.scrollToTop[.library] == 1)
    }

    @Test func switchingTabsKeepsPaths() {
        let r = Router()
        r.open(.trash)
        r.select(.collections)
        #expect(r.library == [.trash])
        #expect(r.tab == .collections)
    }

    @Test func accessoryHidesOnDetailAndSelect() {
        let r = Router()
        #expect(r.showsAccessory)
        r.open(.link("nasa"))
        #expect(!r.showsAccessory)
        r.library = []
        r.isSelecting = true
        #expect(!r.showsAccessory)
    }

    @Test func deepLinks() {
        let r = Router()
        #expect(r.handle(URL(string: "anylink://add?url=https%3A%2F%2Fnasa.gov%2Fx")!))
        #expect(r.sheet == .addLink(prefill: URL(string: "https://nasa.gov/x")))
        #expect(r.handle(URL(string: "anylink://link/nasa")!))
        #expect(r.library == [.link("nasa")] && r.sheet == nil)
        r.tab = .search
        #expect(r.handle(URL(string: "https://anylink.app/links/ytrt")!))
        #expect(r.tab == .library && r.library == [.link("ytrt")])
        #expect(!r.handle(URL(string: "https://anylink.app/about")!))
    }
}

@MainActor
@Suite struct LibraryPresentationTests {
    let store = LibraryStore(api: MockAPI.fixtures(latency: false), snapshot: Fixtures.library)

    @Test func scopesFilterAndCount() {
        #expect(store.scopeCount(.all) == 18)
        for scope in LibraryScope.allCases {
            #expect(store.links(in: scope, sortedBy: .newest).count == store.scopeCount(scope))
        }
        #expect(store.links(in: .videos, sortedBy: .newest).allSatisfy { $0.contentType == .video })
        #expect(store.links(in: .unsorted, sortedBy: .newest).allSatisfy { $0.collectionId == "unsorted" })
        #expect(Set(store.links(in: .favorites, sortedBy: .newest).map(\.id)) == ["nasa", "glass", "book"])
    }

    @Test func sorts() {
        let newest = store.links(in: .all, sortedBy: .newest)
        #expect(newest.map(\.createdAt) == newest.map(\.createdAt).sorted(by: >))
        #expect(store.links(in: .all, sortedBy: .oldest).map(\.id) == newest.reversed().map(\.id))
        let titles = store.links(in: .all, sortedBy: .title).map(\.title)
        #expect(titles == titles.sorted { $0.localizedStandardCompare($1) == .orderedAscending })
        let sites = store.links(in: .all, sortedBy: .site).map(\.domain)
        #expect(sites == sites.sorted { $0.localizedStandardCompare($1) == .orderedAscending })
    }

    @Test func manualOrderUsesPositionThenStoreOrder() {
        func l(_ id: String, _ p: Int?) -> LinkItem {
            LinkItem(id: id, url: "", domain: "", title: id, excerpt: "", tint: "#000", stripe: "#FFF", initial: "A",
                     contentType: .article, collectionId: "u", tags: [], size: .M, position: p, status: .ready, createdAt: "")
        }
        #expect(LibrarySort.manual.apply([l("a", nil), l("b", 2), l("c", 1), l("d", nil)]).map(\.id) == ["c", "b", "a", "d"])
    }

    @Test func dateSections() {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        cal.firstWeekday = 2
        let now = DateSections.date("2026-10-03T12:00:00Z")!   // Saturday
        func l(_ id: String, _ at: String) -> LinkItem {
            LinkItem(id: id, url: "", domain: "", title: id, excerpt: "", tint: "#000", stripe: "#FFF", initial: "A",
                     contentType: .article, collectionId: "u", tags: [], size: .M, status: .ready, createdAt: at)
        }
        let links = [
            l("t", "2026-10-03T08:00:00Z"), l("y", "2026-10-02T23:00:00Z"), l("w", "2026-09-28T09:00:00.500Z"),
            l("s1", "2026-09-20T09:00:00Z"), l("s2", "2026-09-02T09:00:00Z"), l("old", "2025-12-01T09:00:00Z"),
        ]
        let sections = DateSections.group(links, now: now, calendar: cal)
        #expect(sections.map(\.title) == ["Today", "Yesterday", "Earlier this week", "September", "December 2025"])
        #expect(sections[3].links.map(\.id) == ["s1", "s2"])
    }

    @Test func selection() {
        let r = Router()
        r.beginSelecting(with: "nasa")
        r.toggleSelection("iph")
        r.toggleSelection("nasa")
        #expect(r.selection == ["iph"])
        r.isSelecting = false
        #expect(r.selection.isEmpty)
    }
}

@MainActor
@Suite struct AddLinkModelTests {
    let api = MockAPI.fixtures(latency: false)
    let store: LibraryStore
    init() { store = LibraryStore(api: api, snapshot: Fixtures.library) }

    func decode(_ line: String) -> CrawlEvent { try! NDJSONDecoder.decodeLine(line, as: CrawlEvent.self) }
    var success: [CrawlEvent] { Fixtures.crawlSuccessLines.map(decode) }

    func run(_ model: AddLinkModel, _ url: String) async {
        model.start(url)
        while model.phase == .crawling || !model.isDone { await Task.yield(); try? await Task.sleep(for: .milliseconds(5)) }
    }

    @Test func titleEditedWhileRefiningSurvivesDone() {
        let m = AddLinkModel(store: store)
        for e in success.prefix(3) { m.apply(e) }          // fetch, parse, preview
        #expect(m.isRefining)
        #expect(m.title == "Designing tab bars for iOS 26 | Smashing Magazine")
        m.title = "My own title"
        for e in success.dropFirst(3) { m.apply(e) }       // tags, done
        #expect(m.title == "My own title")
        #expect(m.excerpt.hasPrefix("How the new floating tab bar"))   // unedited field takes the refined value
        #expect(m.tags == ["design", "ios", "navigation"])
        #expect(!m.isRefining && m.step == 3)
    }

    @Test func editedTagsSurviveDone() {
        let m = AddLinkModel(store: store)
        for e in success.prefix(3) { m.apply(e) }
        m.removeTag("ios")
        m.addTag("#Later")
        for e in success.dropFirst(3) { m.apply(e) }
        #expect(m.tags == ["design", "later"])
    }

    @Test func normalize() {
        #expect(AddLinkModel.normalize("nasa.gov/x")?.absoluteString == "https://nasa.gov/x")
        #expect(AddLinkModel.normalize("  http://a.b  ")?.absoluteString == "http://a.b")
        #expect(AddLinkModel.normalize("hello") == nil)
        #expect(AddLinkModel.normalize("ftp://a.b") == nil)
        #expect(AddLinkModel.normalize("two words.com") == nil)
    }

    @Test func guessTitle() {
        #expect(AddLinkModel.guessTitle(from: URL(string: "https://x.com/2026/09/designing-tab-bars/")) == "Designing tab bars")
        #expect(AddLinkModel.guessTitle(from: URL(string: "https://shop.example/macbook_air.html")) == "Macbook air")
        #expect(AddLinkModel.guessTitle(from: URL(string: "https://nasa.gov")) == "nasa.gov")
    }

    @Test func mockSuccessStream() async {
        let m = AddLinkModel(store: store)
        await run(m, "https://www.theverge.com/a-story")
        #expect(m.phase == .ready)
        #expect(m.domain == "theverge.com")
        #expect(!m.isExcerptOnly)
    }

    @Test func mockExcerptOnlyStream() async {
        let m = AddLinkModel(store: store)
        await run(m, "https://blocked-news.example/story")
        #expect(m.phase == .ready && m.isExcerptOnly)
    }

    @Test func mockFailedStreamGuessesTitle() async {
        let m = AddLinkModel(store: store)
        await run(m, "https://dead-shop.example/apple-macbook-air-m4")
        #expect(m.phase == .failed)
        #expect(m.failure?.reason == "not-found")
        #expect(m.title == "Apple macbook air m4")
        #expect(m.tags.isEmpty)
    }

    @Test func cancelStopsTheNetworkTask() async throws {
        let slow = MockAPI.fixtures(latency: true)
        let m = AddLinkModel(store: LibraryStore(api: slow, snapshot: Fixtures.library))
        m.start("https://example.com/a")
        try await Task.sleep(for: .milliseconds(100))
        m.cancel()
        try await Task.sleep(for: .milliseconds(150))
        #expect(await slow.crawlsStarted == 1)
        #expect(await slow.crawlsCancelled == 1)
        #expect(m.phase == .crawling)   // nothing applied after cancel
    }

    @Test func saveAfterDone() async {
        let m = AddLinkModel(store: store, collectionID: "ios")
        await run(m, "https://www.smashingmagazine.com/x")
        m.note = "for the tab bar work"
        let saved = await m.save()
        #expect(saved?.collectionId == "ios")
        #expect(saved?.title == "Designing tab bars for iOS 26")
        #expect(saved?.note == "for the tab bar work")
        #expect(store.live.first?.id == saved?.id)
        #expect(store.toasts.current?.message == "Saved to iOS design")
    }

    @Test func saveMidCrawlSaysSo() async {
        let m = AddLinkModel(store: store)
        for e in success.prefix(3) { m.apply(e) }
        m.start("https://example.com/a")   // fresh session, then save immediately
        let saved = await m.save()
        #expect(saved != nil)
        #expect(store.toasts.current?.message == "Saved to Unsorted — still reading the page")
    }

    @Test func suggestsCollectionByTags() {
        #expect(store.suggestedCollection(tags: ["rust"], domain: "x.com")?.id == "rust")
        #expect(store.suggestedCollection(tags: ["nothing-like-this"], domain: "x.com") == nil)
        let m = AddLinkModel(store: store)
        for e in success { m.apply(e) }
        #expect(m.suggestedCollection?.id == "ios")
        #expect(m.collectionID == "unsorted")   // never auto-selected
    }
}

@MainActor
@Suite struct LinkPresentationTests {
    @Test func proseRuleCountsOnlyRealParagraphs() {
        let para = "one two three four five six seven eight nine ten"   // 10 words
        #expect(ArticleBody.proseWordCount([para, "By Jane Doe", "Photo: NASA"]) == 10)
        #expect(!ArticleBody.hasEnoughProse([para, para, para]))          // 30
        #expect(ArticleBody.hasEnoughProse([para, para, para, para]))     // 40
        #expect(!ArticleBody.hasEnoughProse(Array(repeating: "short caption of seven words here", count: 20)))
        #expect(!ArticleBody.hasEnoughProse(nil))
        #expect(ArticleBody.hasEnoughProse(Fixtures.links.first { $0.id == "nasa" }?.articleText))
    }

    var product: ProductDetails { Fixtures.links.first { $0.id == "iph" }!.product! }

    @Test func percentSinceSaved() {
        let s = PriceSummary(product)
        let f = s.first!.price, l = s.latest!.price
        #expect(s.percentSinceSaved == (f > l ? Int(((f - l) / f * 100).rounded()) : nil))
        var up = product
        up.priceHistory = [PriceSnapshot(date: "2026-09-01", price: 100), PriceSnapshot(date: "2026-09-10", price: 120)]
        #expect(PriceSummary(up).percentSinceSaved == nil)
        up.priceHistory = [PriceSnapshot(date: "2026-09-01", price: 100), PriceSnapshot(date: "2026-09-10", price: 100)]
        #expect(PriceSummary(up).percentSinceSaved == nil)
        up.priceHistory = [PriceSnapshot(date: "2026-09-01", price: 200), PriceSnapshot(date: "2026-09-10", price: 150)]
        #expect(PriceSummary(up).percentSinceSaved == 25)
    }

    @Test func chartHidesWithFewerThanTwoSnapshots() {
        var p = product
        #expect(PriceSummary(p).showsChart)
        p.priceHistory = [PriceSnapshot(date: "2026-09-01", price: 100)]
        #expect(!PriceSummary(p).showsChart)
        p.priceHistory = []
        #expect(!PriceSummary(p).showsChart)
    }

    @Test func rangesAndDomain() {
        let s = PriceSummary(product)
        #expect(s.points(in: .all).count == product.priceHistory.count)
        #expect(s.points(in: .month).count <= s.points(in: .quarter).count)
        #expect(s.points(in: .month).count >= 2)
        let d = s.yDomain(for: s.points(in: .all))
        #expect(d.contains(product.alertThreshold!))
        #expect(s.points(in: .all).allSatisfy { d.contains($0.price) })
    }

    @Test func formatsWithGrouping() {
        #expect(PriceSummary.format(52999, "₴").hasPrefix("₴52"))
        #expect(PriceSummary.format(52999, "₴").count == 7)   // ₴52,999 / ₴52 999
    }

    @Test func priceAlertIntentAndRollback() async throws {
        let api = MockAPI.fixtures(latency: false)
        let store = LibraryStore(api: api, snapshot: Fixtures.library)
        store.setPriceAlert("iph", threshold: 45000)
        #expect(store.link("iph")?.product?.alertThreshold == 45000)
        await store.settle()
        await api.failNext(.server(500))
        store.setPriceAlert("iph", threshold: 1)
        await store.settle()
        #expect(store.link("iph")?.product?.alertThreshold == 45000)
    }

    @Test func alsoIn() {
        let store = LibraryStore(api: MockAPI.fixtures(latency: false), snapshot: Fixtures.library)
        let nasa = store.link("nasa")!
        #expect(store.alsoIn(nasa).allSatisfy { $0.collectionId == "reading" && $0.id != "nasa" })
    }
}
