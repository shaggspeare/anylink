import Testing
import Foundation
import Models
import Fixtures
import Networking

/// Answers every request with `status`, `headers` and `body`.
final class ExportStub: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var status = 200
    nonisolated(unsafe) static var headers: [String: String] = [:]
    nonisolated(unsafe) static var body = ""
    nonisolated(unsafe) static var lastRequest: URLRequest?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.lastRequest = request
        let response = HTTPURLResponse(url: request.url!, statusCode: Self.status, httpVersion: nil, headerFields: Self.headers)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(Self.body.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}

    static func api(_ status: Int, _ body: String, headers: [String: String] = [:]) -> LiveAPI {
        Self.status = status; Self.body = body; Self.headers = headers
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [ExportStub.self]
        return LiveAPI(base: URL(string: "https://anylink.test")!, session: URLSession(configuration: config)) { "secret" }
    }
}

@Suite(.serialized) struct ExportTests {
    @Test func savesTheFileUnderTheServersName() async throws {
        let api: any AnyLinkAPI = ExportStub.api(200, "url,title\r\n", headers: ["Content-Disposition": #"attachment; filename="anylink-2026-11-01.csv""#])
        let file = try await api.export(format: .csv)
        #expect(file.lastPathComponent == "anylink-2026-11-01.csv")
        #expect(try String(contentsOf: file, encoding: .utf8) == "url,title\r\n")
        #expect(ExportStub.lastRequest?.url?.absoluteString == "https://anylink.test/api/v1/export?format=csv")
        #expect(ExportStub.lastRequest?.value(forHTTPHeaderField: "Authorization") == "Bearer secret")
    }

    @Test func aFreeAccountIsProRequiredNotSignedOut() async {
        await #expect(throws: AppError.proRequired) {
            let api: any AnyLinkAPI = ExportStub.api(403, #"{"ok":false,"reason":"pro"}"#)
            _ = try await api.export(format: .json)
        }
        await #expect(throws: AppError.server(403)) {
            try await ExportStub.api(403, #"{"error":"Forbidden"}"#).export(format: .json)
        }
        await #expect(throws: AppError.unauthorized) {
            try await ExportStub.api(401, #"{"error":"Unauthorized"}"#).export(format: .json)
        }
    }

    @Test func mockWritesItsLibraryAsJSON() async throws {
        let mock = MockAPI.fixtures(latency: false)
        let api: any AnyLinkAPI = mock
        let file = try await api.export(format: .csv)
        #expect(file.pathExtension == "json")
        let json = try #require(try JSONSerialization.jsonObject(with: Data(contentsOf: file)) as? [String: Any])
        #expect(json["format"] as? String == "anylink")
        #expect((json["links"] as? [Any])?.count == Fixtures.links.count)
        await mock.failNext(.proRequired)
        await #expect(throws: AppError.proRequired) { try await api.export(format: .json) }
    }
}
