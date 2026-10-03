import Testing
import Foundation
import Models
import Networking
import Persistence
import Fixtures
@testable import Store

/// Programmable HTTP for LiveAPI: `nil` from the handler means "no network".
final class APIStub: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var handler: (URLRequest, Data) -> (Int, String)? = { _, _ in (200, "null") }
    nonisolated(unsafe) static var log: [(path: String, body: String)] = []

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func stopLoading() {}
    override func startLoading() {
        var body = request.httpBody ?? Data()
        if body.isEmpty, let stream = request.httpBodyStream {
            stream.open()
            var buf = [UInt8](repeating: 0, count: 4096)
            while stream.hasBytesAvailable { let n = stream.read(&buf, maxLength: buf.count); if n <= 0 { break }; body.append(buf, count: n) }
            stream.close()
        }
        Self.log.append((request.url?.path() ?? "", String(decoding: body, as: UTF8.self)))
        guard let (code, text) = Self.handler(request, body) else {
            client?.urlProtocol(self, didFailWithError: URLError(.notConnectedToInternet))
            return
        }
        client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: code, httpVersion: nil, headerFields: nil)!, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(text.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    static func api() -> LiveAPI {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [APIStub.self]
        return LiveAPI(base: URL(string: "https://anylink.test")!, session: URLSession(configuration: config)) { "secret" }
    }

    static func reset(_ h: @escaping (URLRequest, Data) -> (Int, String)? = { _, _ in (200, "null") }) {
        handler = h
        log = []
    }
}

@MainActor
@Suite(.serialized) struct SyncTests {
    func store(cache: LocalCache? = nil) -> LibraryStore {
        let s = LibraryStore(api: APIStub.api(), snapshot: Fixtures.library, cache: cache)
        s.retryBase = .milliseconds(1)
        return s
    }

    @Test func offlineIntentQueuesThenRetrySucceeds() async {
        APIStub.reset { _, _ in nil }                       // no network
        let s = store()
        s.setFavorite("iph", true)
        await s.settle()
        #expect(s.link("iph")?.favorite == true)           // optimistic change kept
        #expect(s.outbox.map(\.op) == [.patch("iph", note: nil, favorite: true)])
        #expect(s.syncState == .offline)
        #expect(s.toasts.current?.message == "You're offline. Changes are saved and will sync when you're back.")

        APIStub.reset()                                      // back online
        s.drainOutbox()
        await s.settle()
        #expect(s.outbox.isEmpty)
        #expect(s.syncState == .idle)
        #expect(APIStub.log.map(\.path) == ["/api/v1/actions/setFavorite"])
        #expect(APIStub.log.first?.body == #"["iph",true]"#)
        #expect(s.link("iph")?.favorite == true)
    }

    @Test func queuedOpsKeepTheirOrder() async {
        APIStub.reset { _, _ in nil }
        let s = store()
        s.trash(["nasa"])
        s.restore(["nasa"], announce: false)
        s.move(["iph"], to: "home")
        await s.settle()
        #expect(s.outbox.count == 3)
        APIStub.reset()
        s.drainOutbox()
        await s.settle()
        #expect(APIStub.log.map(\.path) == ["/api/v1/actions/deleteLinks", "/api/v1/actions/restoreLinks", "/api/v1/actions/moveLinks"])
    }

    @Test func serverErrorsRetryWithBackoffThenGiveUp() async {
        var calls = 0
        APIStub.reset { _, _ in nil }
        let s = store()
        s.tag(["iph"], "later")
        await s.settle()
        APIStub.reset { _, _ in calls += 1; return calls < 3 ? (503, #"{"error":"busy"}"#) : (200, "null") }
        s.drainOutbox()
        await s.settle()
        #expect(s.outbox.isEmpty)
        #expect(calls == 3)

        APIStub.reset { _, _ in nil }
        s.tag(["iph"], "again")
        await s.settle()
        APIStub.reset { _, _ in (500, #"{"error":"no"}"#) }
        s.drainOutbox()
        await s.settle()
        #expect(s.outbox.isEmpty)                           // dropped after 5 attempts
        #expect(APIStub.log.count == 5)
        #expect(s.toasts.current?.message == "That didn't go through. Try again.")
    }

    @Test func unauthorizedSignsOut() async {
        APIStub.reset { _, _ in (401, #"{"error":"Unauthorized"}"#) }
        let s = store()
        var signedOut = false
        s.onUnauthorized = { signedOut = true }
        await s.refresh()
        #expect(signedOut)
        signedOut = false
        s.setFavorite("iph", true)
        await s.settle()
        #expect(signedOut)
        #expect(s.link("iph")?.favorite == false)           // rolled back
    }

    @Test func outboxSurvivesRelaunch() async throws {
        let cache = try LocalCache(inMemory: true)
        APIStub.reset { _, _ in nil }
        let s1 = store(cache: cache)
        s1.archive(["nasa"])
        await s1.settle()
        let s2 = store(cache: cache)
        #expect(s2.outbox.map(\.op) == [.archive(["nasa"])])
    }

    @Test func coldLaunchShowsCacheBeforeNetwork() async throws {
        let cache = try LocalCache(inMemory: true)
        cache.save(Fixtures.library)
        APIStub.reset { _, _ in nil }
        let s = LibraryStore(api: APIStub.api(), cache: cache)   // no snapshot passed in
        #expect(s.live.count == 18)                          // before any network call
        #expect(APIStub.log.isEmpty)
    }

    @Test func refreshKeepsLocalWhilePending() async {
        APIStub.reset { _, _ in nil }
        let s = store()
        s.setNote("iph", "mine")
        await s.settle()
        await s.refresh()                                    // still offline: nothing replaced
        #expect(s.link("iph")?.note == "mine")
        #expect(s.syncState == .offline)
    }

    @Test func liveLibraryDecodes() async throws {
        let json = String(decoding: try JSONEncoder().encode(Fixtures.library), as: UTF8.self)
        APIStub.reset { req, _ in req.url?.path() == "/api/v1/library" ? (200, json) : (404, "{}") }
        let s = LibraryStore(api: APIStub.api())
        await s.refresh()
        #expect(s.live.count == 18)
        #expect(s.lastSynced != nil)
    }

    @Test func createLinkSendsBackendShape() async throws {
        let saved = String(decoding: try JSONEncoder().encode(Fixtures.links[0]), as: UTF8.self)
        APIStub.reset { _, _ in (200, saved) }
        _ = try await APIStub.api().createLink(LinkDraft(url: "https://www.example.com/a", title: "A", collectionId: "reading", tags: ["x"]))
        let body = APIStub.log.last?.body ?? ""
        #expect(APIStub.log.last?.path == "/api/v1/actions/createLink")
        for key in [#""url":"https:\/\/www.example.com\/a""#, #""domain":"example.com""#, #""collectionId":"reading""#, #""contentType":"article""#, ##""tint":"#9AA3AD""##] {
            #expect(body.contains(key), "missing \(key) in \(body)")
        }
    }
}

@MainActor
@Suite struct ShareSessionTests {
    let url = URL(string: "https://www.theverge.com/2026/10/story")!

    @Test func savesImmediatelyWhenLive() async throws {
        let api = MockAPI.fixtures(latency: false)
        let cache = try LocalCache(inMemory: true)
        cache.saveRecentCollections([LinkCollection(id: "reading", name: "Reading", color: "#7C8CFF")])
        let s = ShareSession(api: api, cache: cache, signedIn: true)
        let start = ContinuousClock.now
        await s.start(url: url, title: "A story")
        #expect(ContinuousClock.now - start < .seconds(1))
        #expect(s.mode == .saved)
        #expect(s.headline == "Saved to Unsorted")
        await s.move(to: s.recent[0])
        #expect(s.headline == "Saved to Reading")
        await s.finish(note: "for later")
        let server = try await api.library(since: nil).links.first { $0.id == s.saved?.id }
        #expect(server?.collectionId == "reading")
        #expect(server?.note == "for later")
    }

    @Test func pendingWithoutBackendThenAppDrains() async throws {
        let cache = try LocalCache(inMemory: true)
        let s = ShareSession(api: nil, cache: cache, signedIn: true)
        await s.start(url: url, title: "A story")
        #expect(s.mode == .pending)
        await s.move(to: LinkCollection(id: "ios", name: "iOS design", color: "#7C8CFF"))
        await s.finish(note: "tab bars")
        #expect(cache.pendingSaves().count == 1)

        let store = LibraryStore(api: MockAPI.fixtures(latency: false), snapshot: Fixtures.library)
        await store.drainPendingSaves(from: cache)
        #expect(cache.pendingSaves().isEmpty)
        let added = store.live.first!
        #expect(added.url == url.absoluteString && added.collectionId == "ios" && added.note == "tab bars")
    }

    @Test func offlineFallsBackToPending() async throws {
        let api = MockAPI.fixtures(latency: false)
        await api.failNext(.offline)
        let cache = try LocalCache(inMemory: true)
        let s = ShareSession(api: api, cache: cache, signedIn: true)
        await s.start(url: url, title: nil)
        #expect(s.mode == .pending)
        #expect(cache.pendingSaves().map(\.url) == [url.absoluteString])
    }

    @Test func signedOutAndNoLink() async {
        let a = ShareSession(api: nil, cache: nil, signedIn: false)
        await a.start(url: url, title: nil)
        #expect(a.mode == .signedOut)
        let b = ShareSession(api: nil, cache: nil, signedIn: true)
        await b.start(url: nil, title: nil)
        #expect(b.mode == .noLink)
    }

    @Test func recentCollectionsOrder() {
        let store = LibraryStore(api: MockAPI.fixtures(latency: false), snapshot: Fixtures.library)
        #expect(store.recentCollections.count == 4)
        #expect(!store.recentCollections.contains { $0.isInbox == true || $0.isSmart == true })
    }
}

import CoreSpotlight

@Suite struct SpotlightTests {
    @Test func itemCarriesTitleSummaryDomain() {
        let l = Fixtures.links.first { $0.id == "nasa" }!
        let item = Spotlight.item(for: l)
        #expect(item.uniqueIdentifier == "nasa")
        #expect(item.domainIdentifier == "links")
        #expect(item.attributeSet.title == l.title)
        #expect(item.attributeSet.contentDescription == l.excerpt)
        #expect(item.attributeSet.keywords?.contains("nasa.gov") == true)
    }

    @MainActor
    @Test func continuationOpensTheLink() {
        let activity = NSUserActivity(activityType: CSSearchableItemActionType)
        activity.userInfo = [CSSearchableItemActivityIdentifier: "nasa"]
        let r = Router()
        r.tab = .search
        if let id = Spotlight.linkID(from: activity) { r.handle(URL(string: "anylink://link/\(id)")!) }
        #expect(r.tab == .library && r.library == [.link("nasa")])
        #expect(Spotlight.linkID(from: NSUserActivity(activityType: "other")) == nil)
    }
}
