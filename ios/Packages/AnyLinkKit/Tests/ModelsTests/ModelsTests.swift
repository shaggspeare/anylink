import Testing
import Foundation
import Models

@Suite struct CopyTests {
    @Test func linkCountPluralizes() {
        #expect(0.linkCount == "0 links")
        #expect(1.linkCount == "1 link")
        #expect(2.linkCount == "2 links")
    }
}

@Suite struct PlanTests {
    private func library(_ extra: String = "") throws -> LibrarySnapshot {
        try JSONDecoder().decode(LibrarySnapshot.self, from: Data(#"{"links":[],"trashed":[],"collections":[]\#(extra)}"#.utf8))
    }

    @Test func libraryDecodesWithAndWithoutPlan() throws {
        #expect(try library().plan == nil)
        #expect(try !library().isPro, "a server or cache from before plans reads as free")
        #expect(try library(#","plan":"pro""#).isPro)
        #expect(try !library(#","plan":"free""#).isPro)
    }
}
