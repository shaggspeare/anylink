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
