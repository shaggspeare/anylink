import Testing
import Foundation
import CryptoKit
import DeviceCheck
import Models
import Fixtures
@testable import Networking

/// Answers by path, in order (the last answer repeats), and records each request with its body.
final class RouteStub: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var answers: [String: [(Int, String)]] = [:]
    nonisolated(unsafe) static var requests: [(request: URLRequest, body: Data)] = []

    static func reset(_ answers: [String: [(Int, String)]]) {
        self.answers = answers
        requests = []
    }

    static func sent(to path: String) -> [(request: URLRequest, body: Data)] {
        requests.filter { $0.request.url?.path() == path }
    }

    static var session: URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [RouteStub.self]
        return URLSession(configuration: config)
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        let path = request.url?.path() ?? ""
        Self.requests.append((request, Self.body(of: request)))
        var queue = Self.answers[path] ?? [(404, "{}")]
        let (status, body) = queue.count > 1 ? queue.removeFirst() : queue[0]
        Self.answers[path] = queue
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(body.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}

    /// URLSession hands a protocol the body as a stream.
    static func body(of request: URLRequest) -> Data {
        if let body = request.httpBody { return body }
        guard let stream = request.httpBodyStream else { return Data() }
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 4096)
        while stream.hasBytesAvailable {
            let read = stream.read(&buffer, maxLength: buffer.count)
            if read <= 0 { break }
            data.append(buffer, count: read)
        }
        return data
    }
}

/// The Secure Enclave, faked: numbered keys, and an assertion that names its key.
actor FakeAttestService: AttestService {
    nonisolated let isSupported: Bool
    var keysMade = 0
    var attested: [Data] = []
    var signed: [Data] = []
    var rejectsEveryKey = false
    private var rejected: Set<String> = []

    init(supported: Bool = true) { isSupported = supported }

    func generateKey() -> String {
        keysMade += 1
        return "key-\(keysMade)"
    }
    func attestKey(_ keyId: String, clientDataHash: Data) -> Data {
        attested.append(clientDataHash)
        return Data("attestation-\(keyId)".utf8)
    }
    func generateAssertion(_ keyId: String, clientDataHash: Data) throws -> Data {
        if rejectsEveryKey || rejected.contains(keyId) { throw DCError(.invalidKey) }
        signed.append(clientDataHash)
        return Data("assertion-\(keyId)".utf8)
    }
    func reject(_ keyId: String) { rejected.insert(keyId) }
    func rejectEveryKey() { rejectsEveryKey = true }
}

/// An `AppAttestClient` stand-in for the calls that use one.
actor FakeSigner: AppAttesting {
    var bodies: [Data] = []
    var forgotten = 0
    func headers(for body: Data) -> [String: String] {
        bodies.append(body)
        return ["X-AnyLink-Key": "key", "X-AnyLink-Assertion": "signature"]
    }
    func forgetKey() { forgotten += 1 }
}

@Suite(.serialized) struct AppAttestTests {
    let base = URL(string: "https://anylink.test")!
    let registration: [String: [(Int, String)]] = [
        "/api/attest/challenge": [(200, #"{"challenge":"c1"}"#)],
        "/api/attest/register": [(200, #"{"ok":true}"#)],
    ]
    func sha(_ text: String) -> Data { Data(SHA256.hash(data: Data(text.utf8))) }

    func client(_ service: FakeAttestService, devSecret: String? = nil) -> AppAttestClient {
        AppAttestClient(base: base, session: RouteStub.session, service: service, keychain: nil, devSecret: devSecret)
    }

    // MARK: AppAttestClient

    @Test func registersOnceThenSignsEachBody() async throws {
        RouteStub.reset(registration)
        let service = FakeAttestService()
        let attest = client(service)

        let first = await attest.headers(for: Data("one".utf8))
        let second = await attest.headers(for: Data("two".utf8))

        #expect(first == ["X-AnyLink-Key": "key-1", "X-AnyLink-Assertion": Data("assertion-key-1".utf8).base64EncodedString()])
        #expect(second["X-AnyLink-Key"] == "key-1")
        #expect(await service.keysMade == 1)
        #expect(await service.attested == [sha("c1")])
        #expect(await service.signed == [sha("one"), sha("two")])
        let sent = try #require(RouteStub.sent(to: "/api/attest/register").first)
        #expect(try JSONDecoder().decode([String: String].self, from: sent.body) == [
            "keyId": "key-1", "attestation": Data("attestation-key-1".utf8).base64EncodedString(), "challenge": "c1",
        ])
    }

    @Test func aKeyAppleRejectsIsReplacedOncePerCall() async {
        RouteStub.reset(registration)
        let service = FakeAttestService()
        let attest = client(service)
        _ = await attest.headers(for: Data("a".utf8))

        await service.reject("key-1")
        #expect(await attest.headers(for: Data("b".utf8))["X-AnyLink-Key"] == "key-2")

        // Rejected again straight away: one new key, then the call goes out unsigned rather than looping.
        await service.rejectEveryKey()
        #expect(await attest.headers(for: Data("c".utf8)) == [:])
        #expect(await service.keysMade == 3)
    }

    @Test func forgettingTheKeyRegistersANewOne() async {
        RouteStub.reset(registration)
        let service = FakeAttestService()
        let attest = client(service)
        _ = await attest.headers(for: Data("a".utf8))
        await attest.forgetKey()
        #expect(await attest.headers(for: Data("b".utf8))["X-AnyLink-Key"] == "key-2")
    }

    @Test func withoutAppAttestOnlyTheDevSecretGoesOut() async {
        RouteStub.reset(registration)
        let service = FakeAttestService(supported: false)
        #expect(await client(service, devSecret: "s3cret").headers(for: Data()) == ["X-AnyLink-Dev": "s3cret"])
        #expect(await client(service).headers(for: Data()) == [:])
        #expect(await service.keysMade == 0)
    }

    @Test func aFailedRegistrationSendsTheCallUnsigned() async {
        RouteStub.reset(["/api/attest/challenge": [(503, #"{"error":"App Attest isn't set up on this server."}"#)]])
        #expect(await client(FakeAttestService()).headers(for: Data("x".utf8)) == [:])
    }

    // MARK: LiveCrawler

    func crawl(_ crawler: LiveCrawler) async throws -> [String] {
        var out: [String] = []
        for try await event in crawler.crawl(URL(string: "https://nasa.gov/x")!) {
            switch event {
            case .done: out.append("done")
            case .failed(let f): out.append("failed:\(f.reason)")
            default: break
            }
        }
        return out
    }

    @Test func signedOutCrawlsAreSignedAndA403IsRetriedOnce() async throws {
        RouteStub.reset(["/api/crawl": [
            (403, #"{"error":"This call couldn't be verified.","reason":"unknown-key"}"#),
            (200, Fixtures.crawlSuccessLines.joined(separator: "\n")),
        ]])
        let signer = FakeSigner()
        let events = try await crawl(LiveCrawler(base: base, token: nil, session: RouteStub.session, attest: signer))

        #expect(events == ["done"])
        #expect(await signer.forgotten == 1)
        let sent = RouteStub.sent(to: "/api/crawl")
        #expect(sent.count == 2)
        #expect(sent.allSatisfy { $0.request.value(forHTTPHeaderField: "X-AnyLink-Assertion") == "signature" })
        #expect(await signer.bodies == sent.map(\.body))
    }

    @Test func aSignedInCrawlIsNotSigned() async throws {
        RouteStub.reset(["/api/crawl": [(200, Fixtures.crawlSuccessLines.joined(separator: "\n"))]])
        let signer = FakeSigner()
        _ = try await crawl(LiveCrawler(base: base, token: "secret", session: RouteStub.session, attest: signer))

        let sent = try #require(RouteStub.sent(to: "/api/crawl").first)
        #expect(sent.request.value(forHTTPHeaderField: "Authorization") == "Bearer secret")
        #expect(sent.request.value(forHTTPHeaderField: "X-AnyLink-Assertion") == nil)
        #expect(await signer.bodies.isEmpty)
    }

    // MARK: LocalServices

    func link(_ id: String, status: Int? = nil, folder: String? = nil) -> LinkItem {
        LinkItem(
            id: id, url: "https://\(id).example/post", domain: "\(id).example", title: "Title \(id)", excerpt: "",
            tint: "#9AA3AD", stripe: "#FFFFFF", initial: "A", contentType: .article, collectionId: "inbox", tags: [],
            size: .M, status: .ready, createdAt: "2026-11-01T00:00:00Z", importMeta: ImportMeta(folder: folder),
            httpStatus: status
        )
    }

    @Test func localCheckStreamsTheImportCheckEvents() async throws {
        RouteStub.reset(["/api/v1/local/check": [(200, """
        {"type":"start","total":2}
        {"type":"progress","checked":1,"dead":1}
        {"type":"progress","checked":2,"dead":1}
        {"type":"done","checked":2,"dead":[{"id":"a","url":"https://a.example/post","title":"Title a","status":404}],"remaining":0}
        """)]])
        let signer = FakeSigner()
        var events: [LinkCheckEvent] = []
        for try await event in LocalServices(base: base, attest: signer, session: RouteStub.session).check([link("a"), link("b")]) {
            events.append(event)
        }

        #expect(events.map(\.type) == ["start", "progress", "progress", "done"])
        #expect(events.last?.dead == [.init(id: "a", url: "https://a.example/post", title: "Title a", status: 404)])
        let sent = try #require(RouteStub.sent(to: "/api/v1/local/check").first)
        #expect(try JSONDecoder().decode([String: [[String: String]]].self, from: sent.body)["links"]?.last
            == ["id": "b", "url": "https://b.example/post", "title": "Title b"])
        #expect(await signer.bodies == [sent.body])
    }

    @Test func localGroupLeavesDeadLinksOutAndDecodesGroupInboxResults() async throws {
        RouteStub.reset(["/api/v1/local/group": [(200, """
        [{"collection":{"id":"c1","name":"Rust","color":"#ff5a1f","reasoning":"Same folder.","createdBy":"system"},"linkIds":["a"],"reasoning":"Same folder."}]
        """)]])
        let services = LocalServices(base: base, attest: FakeSigner(), session: RouteStub.session)
        let results = try await services.group([link("a", folder: "Bar/Rust"), link("b", status: 404)], priorities: GroupingPriorities(focus: "rust"))

        #expect(results.map(\.collection.name) == ["Rust"])
        #expect(results.first?.linkIds == ["a"])
        struct Sent: Decodable { let priorities: GroupingPriorities; let links: [[String: String]] }
        let sent = try JSONDecoder().decode(Sent.self, from: try #require(RouteStub.sent(to: "/api/v1/local/group").first).body)
        #expect(sent.priorities.focus == "rust")
        #expect(sent.links == [["id": "a", "title": "Title a", "domain": "a.example", "note": "Bar/Rust"]])
    }

    @Test func aDailyCapIsAServerErrorNotASignOut() async {
        RouteStub.reset(["/api/v1/local/group": [(429, #"{"error":"That's today's limit for this device.","reason":"daily-cap"}"#)]])
        let services = LocalServices(base: base, attest: FakeSigner(), session: RouteStub.session)
        await #expect(throws: AppError.server(429)) {
            try await services.group([link("a")], priorities: GroupingPriorities())
        }
    }
}
