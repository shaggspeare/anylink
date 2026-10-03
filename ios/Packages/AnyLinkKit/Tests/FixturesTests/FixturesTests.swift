import Testing
import Foundation
import Models
@testable import Fixtures

@Suite struct FixturesTests {
    @Test func libraryDecodes() {
        let lib = Fixtures.library
        #expect(lib.links.count == 18)
        #expect(lib.trashed.count == 2)
        #expect(lib.collections.count == 7)
    }

    @Test func linksHaveIds() {
        for link in Fixtures.links {
            #expect(!link.id.isEmpty)
            #expect(!link.domain.isEmpty)
        }
    }

    @Test func productLinkHasDetails() {
        let iph = Fixtures.links.first { $0.id == "iph" }
        #expect(iph != nil)
        #expect(iph?.contentType == .product)
        #expect(iph?.product != nil)
        #expect(iph?.product?.priceHistory.count == 10)
    }

    @Test func crawlSuccessDecodes() {
        let lines = Fixtures.crawlSuccessLines
        #expect(lines.count == 5)
        let decoder = JSONDecoder()
        for line in lines {
            let event = try? decoder.decode(CrawlEvent.self, from: Data(line.utf8))
            #expect(event != nil)
        }
    }

    @Test func crawlFailedDecodes() {
        let lines = Fixtures.crawlFailedLines
        #expect(lines.count == 2)
        let decoder = JSONDecoder()
        let last = try? decoder.decode(CrawlEvent.self, from: Data(lines.last!.utf8))
        if case .failed(let f) = last {
            #expect(f.reason == "not-found")
        } else {
            Issue.record("Expected .failed")
        }
    }

    @Test func crawlExcerptOnlyDecodes() {
        let lines = Fixtures.crawlExcerptOnlyLines
        #expect(lines.count == 4)
        let decoder = JSONDecoder()
        if let doneLine = lines.last, let event = try? decoder.decode(CrawlEvent.self, from: Data(doneLine.utf8)) {
            if case .done(let r) = event {
                #expect(r.excerptOnly == true)
            } else {
                Issue.record("Expected .done")
            }
        }
    }
}
