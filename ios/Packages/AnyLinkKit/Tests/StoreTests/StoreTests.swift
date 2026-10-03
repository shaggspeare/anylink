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
