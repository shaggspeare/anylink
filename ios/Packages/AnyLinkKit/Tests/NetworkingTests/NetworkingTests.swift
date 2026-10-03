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
