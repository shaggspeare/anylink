import Testing
import Foundation
import Models
import Fixtures
@testable import Networking

@Suite struct NetworkingTests {
    @Test func crawlReplayOrdering() async throws {
        let mock = MockAPI(
            links: Fixtures.links, trashed: Fixtures.trashed,
            collections: Fixtures.collections,
            crawlLines: [
                "success": Fixtures.crawlSuccessLines,
                "excerpt-only": Fixtures.crawlExcerptOnlyLines,
                "failed": Fixtures.crawlFailedLines
            ],
            latency: false
        )

        var events: [String] = []
        let stream = await mock.crawl(URL(string: "https://example.com/page")!)
        for try await event in stream {
            switch event {
            case .step(let s): events.append("step:\(s)")
            case .preview: events.append("preview")
            case .done: events.append("done")
            case .failed: events.append("failed")
            }
        }
        #expect(events == ["step:fetch", "step:parse", "preview", "step:tags", "done"])
    }

    @Test func crawlFailedReplay() async throws {
        let mock = MockAPI(
            links: [], trashed: [], collections: [],
            crawlLines: ["failed": Fixtures.crawlFailedLines],
            latency: false
        )

        var events: [String] = []
        let stream = await mock.crawl(URL(string: "https://dead.example.com")!)
        for try await event in stream {
            switch event {
            case .step(let s): events.append("step:\(s)")
            case .failed(let f): events.append("failed:\(f.reason)")
            default: events.append("other")
            }
        }
        #expect(events == ["step:fetch", "failed:not-found"])
    }

    @Test func failNextWorks() async throws {
        let mock = MockAPI(links: [], trashed: [], collections: [], latency: false)
        await mock.failNext(.offline)
        do {
            _ = try await mock.library(since: nil)
            Issue.record("Should have thrown")
        } catch let e as AppError {
            #expect(e == .offline)
        }
        // Next call succeeds
        let lib = try await mock.library(since: nil)
        #expect(lib.links.isEmpty)
    }

    @Test func ndJsonDecoder() throws {
        let line = """
        {"type":"step","step":"fetch","_delayMs":300}
        """
        let event = try NDJSONDecoder.decodeLine(line, as: CrawlEvent.self)
        if case .step(let s) = event {
            #expect(s == "fetch")
        } else {
            Issue.record("Expected .step")
        }
        #expect(NDJSONDecoder.delayMs(from: line) == 300)
    }
}

// MARK: - LiveCrawler against a stubbed URLProtocol

final class StubProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var status = 200
    nonisolated(unsafe) static var body = ""
    nonisolated(unsafe) static var lastRequest: URLRequest?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.lastRequest = request
        let resp = HTTPURLResponse(url: request.url!, statusCode: Self.status, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: resp, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(Self.body.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

@Suite(.serialized) struct LiveCrawlerTests {
    func crawler() -> LiveCrawler {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubProtocol.self]
        return LiveCrawler(base: URL(string: "https://anylink.test")!, token: "secret", session: URLSession(configuration: config))
    }

    func events(_ status: Int, _ body: String) async throws -> [String] {
        StubProtocol.status = status
        StubProtocol.body = body
        var out: [String] = []
        for try await e in crawler().crawl(URL(string: "https://nasa.gov/x")!) {
            switch e {
            case .step(let s): out.append("step:\(s)")
            case .preview: out.append("preview")
            case .done: out.append("done")
            case .failed(let f): out.append("failed:\(f.reason)")
            }
        }
        return out
    }

    @Test func streamsRecordedSuccess() async throws {
        let body = Fixtures.crawlSuccessLines.joined(separator: "\n")
        #expect(try await events(200, body) == ["step:fetch", "step:parse", "preview", "step:tags", "done"])
        #expect(StubProtocol.lastRequest?.value(forHTTPHeaderField: "Authorization") == "Bearer secret")
        #expect(StubProtocol.lastRequest?.url?.path() == "/api/crawl")
    }

    @Test func badRequestIsInvalidURL() async throws {
        #expect(try await events(400, "{\"error\":\"bad\"}") == ["failed:invalid-url"])
    }

    @Test func streamWithoutTerminalIsNetworkFailure() async throws {
        #expect(try await events(200, "{\"type\":\"step\",\"step\":\"fetch\"}\n") == ["step:fetch", "failed:network"])
    }
}

@Suite struct MockCrawlTests {
    @Test func cancellingStopsTheStream() async throws {
        let api = MockAPI.fixtures(latency: true)
        let task = Task {
            for try await _ in await api.crawl(URL(string: "https://example.com/a")!) {}
        }
        try await Task.sleep(for: .milliseconds(100))
        task.cancel()
        _ = await task.result
        try await Task.sleep(for: .milliseconds(100))
        #expect(await api.crawlsStarted == 1)
        #expect(await api.crawlsCancelled == 1)
    }

    @Test func successStreamTakesThePastedDomain() async throws {
        var domains: [String] = []
        for try await e in await MockAPI.fixtures(latency: false).crawl(URL(string: "https://www.theverge.com/x")!) {
            if case .done(let r) = e { domains.append(r.domain) }
        }
        #expect(domains == ["theverge.com"])
    }
}
