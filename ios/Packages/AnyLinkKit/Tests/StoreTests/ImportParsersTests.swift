import Testing
import Foundation
import Models
import Fixtures
import Networking
@testable import Store

/// Ported from the web app's src/lib/import/parse.test.ts, plus the Fixtures samples.
@Suite struct ImportParsersTests {
    static let bookmarks = """
    <!DOCTYPE NETSCAPE-Bookmark-file-1>
    <META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
    <TITLE>Bookmarks</TITLE>
    <H1>Bookmarks</H1>
    <DL><p>
        <DT><H3 ADD_DATE="1700000000" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
        <DL><p>
            <DT><A HREF="https://rust-lang.org/" ADD_DATE="1700000000">Rust &amp; friends</A>
            <DT><H3>Reading</H3>
            <DL><p>
                <DT><A HREF="https://example.com/borrow-checker">Borrow checker</A>
                <DT><A HREF="javascript:void(0)">A bookmarklet</A>
                <DT><A HREF="https://rust-lang.org/">Rust again</A>
            </DL><p>
            <DT><A HREF="https://example.com/after-folder">Back out one level</A>
        </DL><p>
        <DT><A HREF="https://example.com/root">Root level</A>
    </DL><p>
    """

    static let telegram = """
    {"name":"Saved Messages","type":"saved_messages","messages":[
     {"id":1,"type":"message","date":"2026-01-04T10:00:00","text_entities":[{"type":"plain","text":"read this about rust macros "},{"type":"link","text":"https://example.com/macros"}]},
     {"id":2,"type":"message","date":"2026-01-05T10:00:00","text_entities":[{"type":"plain","text":"groceries"}]},
     {"id":3,"type":"message","date":"2026-01-06T10:00:00","text_entities":[{"type":"text_link","text":"this post","href":"https://example.com/post"}]},
     {"id":4,"type":"message","date":"2026-01-07T10:00:00","text_entities":[{"type":"link","text":"https://example.com/macros"}]}
    ]}
    """

    @Test func bookmarksFolderTrailEntitiesDedupe() {
        let links = ImportParsers.bookmarks(Self.bookmarks)
        #expect(links.map(\.url) == ["https://rust-lang.org/", "https://example.com/borrow-checker", "https://example.com/after-folder", "https://example.com/root"])
        #expect(links.map(\.title) == ["Rust & friends", "Borrow checker", "Back out one level", "Root level"])
        #expect(links.map(\.meta.folder) == ["Bookmarks bar", "Bookmarks bar / Reading", "Bookmarks bar", nil])
        #expect(links[0].source == "chrome")
        #expect(links[0].meta.savedAt == "2023-11-14T22:13:20.000Z")
    }

    @Test func titlelessAnchorGetsATitle() {
        let links = ImportParsers.bookmarks(#"<DL><DT><A HREF="https://example.com/some-post"></A></DL>"#)
        #expect(links.first?.title == "Some post")
    }

    @Test func telegramEntitiesContextDedupe() throws {
        let links = try ImportParsers.telegram(Data(Self.telegram.utf8))
        #expect(links.map(\.url) == ["https://example.com/macros", "https://example.com/post"])
        #expect(links[0].title == "read this about rust macros")
        #expect(links[0].meta.context == "read this about rust macros")
        #expect(links[0].source == "telegram")
        #expect(links[0].meta.savedAt?.hasSuffix(".000Z") == true)
        #expect(links[1].title == "this post")
    }

    @Test func telegramFullExportReadsOnlySavedMessages() throws {
        let json = #"{"chats":{"list":[{"type":"private_supergroup","messages":[{"text_entities":[{"type":"link","text":"https://example.com/other-chat"}]}]},{"type":"saved_messages","messages":[{"text_entities":[{"type":"link","text":"https://example.com/saved"}]}]}]}}"#
        #expect(try ImportParsers.telegram(Data(json.utf8)).map(\.url) == ["https://example.com/saved"])
    }

    @Test func mergeFirstWins() throws {
        let merged = ImportParsers.merge([ImportParsers.bookmarks(Self.bookmarks), try ImportParsers.telegram(Data(Self.telegram.utf8))])
        let rust = merged.filter { $0.url == "https://rust-lang.org/" }
        #expect(rust.count == 1 && rust[0].source == "chrome")
        #expect(merged.count == 6)
    }

    @Test func dispatchAndErrors() throws {
        #expect(try ImportParsers.parse(fileName: "result.json", data: Data(Self.telegram.utf8))[0].source == "telegram")
        #expect(try ImportParsers.parse(fileName: "bookmarks_9_18_26.html", data: Data(Self.bookmarks.utf8))[0].source == "chrome")
        #expect(throws: ImportParsers.Failure.unreadable) { try ImportParsers.parse(fileName: "x.json", data: Data("PK\u{3}\u{4}zip".utf8)) }
        #expect(throws: ImportParsers.Failure.unreadable) { try ImportParsers.parse(fileName: "x.html", data: Data("PK\u{3}\u{4}zip".utf8)) }
        #expect(throws: ImportParsers.Failure.empty) { try ImportParsers.parse(fileName: "x.html", data: Data("<DL></DL>".utf8)) }
    }

    @Test func titleFromURL() {
        #expect(ImportParsers.titleFromURL("https://www.example.com/2026/09/designing-tab-bars.html") == "Designing tab bars")
        #expect(ImportParsers.titleFromURL("https://example.com/p123456") == "example.com")
        #expect(ImportParsers.titleFromURL("https://example.com/") == "example.com")
    }
}

@Suite struct ImportSampleTests {
    @Test func chromeSampleCounts() throws {
        let links = try ImportParsers.parse(fileName: "sample-bookmarks.html", data: Fixtures.sample("sample-bookmarks.html"))
        #expect(links.count == 25)
        #expect(links.filter { $0.meta.folder == "Bookmarks bar / Rust" }.count == 7)
        #expect(links.filter { $0.meta.folder == nil }.count == 4)
        #expect(links.allSatisfy { $0.meta.savedAt != nil })
    }

    @Test func telegramSampleCounts() throws {
        let links = try ImportParsers.parse(fileName: "result.json", data: Fixtures.sample("sample-telegram.json"))
        #expect(links.count == 11)
        #expect(links.filter { $0.meta.context == "apartment ideas" }.count == 2)
        #expect(links.first { $0.url.contains("dead-shop") }?.meta.context == nil)
    }

    @Test func mergedSamplesDedupe() throws {
        let a = try ImportParsers.parse(fileName: "b.html", data: Fixtures.sample("sample-bookmarks.html"))
        let b = try ImportParsers.parse(fileName: "result.json", data: Fixtures.sample("sample-telegram.json"))
        #expect(ImportParsers.merge([a, b]).count == 25 + 11 - 2)   // smashing + miso salmon appear in both
    }
}

@MainActor
@Suite struct OnboardingModelTests {
    let store = LibraryStore(api: MockAPI.fixtures(latency: false), snapshot: Fixtures.library)

    func loaded() -> OnboardingModel {
        let m = OnboardingModel(store: store)
        m.load(Fixtures.sample("sample-bookmarks.html"), named: "bookmarks.html", as: .bookmarks)
        m.load(Fixtures.sample("sample-telegram.json"), named: "result.json", as: .telegram)
        return m
    }

    @Test func importCountsAndErrors() {
        let m = loaded()
        #expect(m.merged.count == 34)
        m.load(Data("<DL></DL>".utf8), named: "x.html", as: .bookmarks)
        #expect(m.fileErrors[.bookmarks] == "No links in that file. A Chrome bookmarks export or a Telegram result.json both work.")
        m.load(Data("PK\u{3}".utf8), named: "x.json", as: .telegram)
        #expect(m.fileErrors[.telegram] == "Couldn't read that file — is it the export itself, rather than a zip of it?")
    }

    @Test func wholeFlowOnMock() async {
        let m = loaded()
        let before = store.live.count
        await m.runImport()
        #expect(m.step == .clean)
        #expect(store.live.count > before + 30)
        await m.runCheck()
        #expect(m.checkDone && m.checked == m.total && m.total > 0)
        #expect(m.links(in: .gone).contains { $0.url.contains("dead-") || $0.url.contains("gone-") })
        #expect(m.links(in: .parked).contains { $0.url.contains("parked") })
        m.trashSelectedAndContinue()
        #expect(m.step == .keepOrBin)
        #expect(m.sample.count == 8)
        #expect(Set(m.sample.map(\.domain)).count == 8)   // sampled across domains
        for (i, l) in m.sample.enumerated() { if i.isMultiple(of: 3) { m.bin(l) } else { m.keep(l) } }
        #expect(m.step == .focus)
        #expect(!m.suggestionChips.isEmpty)
        m.pick(m.suggestionChips[0])
        await m.buildCollections()
        #expect(m.step == .result)
        #expect(!m.results.isEmpty)
        let first = m.results[0]
        m.toggleBin(first.collection.id)
        #expect(m.linksBackToUnsorted == first.linkIds.count)
        m.finish()
        #expect(store.collection(first.collection.id) == nil)
        #expect(first.linkIds.allSatisfy { store.link($0)?.collectionId == store.inboxID })
    }

    @Test func importFailureCopy() async {
        let api = MockAPI.fixtures(latency: false)
        let s = LibraryStore(api: api, snapshot: Fixtures.library)
        let m = OnboardingModel(store: s)
        m.load(Fixtures.sample("sample-telegram.json"), named: "result.json", as: .telegram)
        await api.failNext(.server(500))
        await m.runImport()
        #expect(m.step == .importFiles)
        #expect(m.importError == "The import didn't go through. Nothing was saved — try again.")
    }
}

@Suite struct MockCheckTests {
    @Test func replays1284LinksInAboutThreeSeconds() async throws {
        let api = MockAPI(links: [], trashed: [], collections: [LinkCollection(id: "unsorted", name: "Unsorted", color: "#9AA3AD", isInbox: true)], latency: true)
        let items = (0..<1284).map { ImportItem(url: "https://site\($0 % 40).example.com/p/\($0)", title: "Link \($0)", source: "chrome", meta: ImportMeta(folder: "Bar")) }
        _ = try await api.importLinks(items)
        let start = ContinuousClock.now
        var checked = 0
        var remaining = 1
        while remaining > 0 {
            for try await e in await api.checkImportedLinks() {
                if e.type == "done" { checked += e.checked ?? 0; remaining = e.remaining ?? 0 }
            }
        }
        let elapsed = ContinuousClock.now - start
        #expect(checked == 1284)
        #expect(elapsed < .seconds(5))   // spec: ~3 s
    }
}
