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

@Suite struct ContentTypeTests {
    @Test func unknownTypeReadsAsArticleAndTheLibraryStillLoads() throws {
        let link = ##"{"id":"x","url":"https://example.com","domain":"example.com","title":"T","excerpt":"","tint":"#9AA3AD","stripe":"#FFFFFF","initial":"E","contentType":"podcast","collectionId":"unsorted","tags":[],"size":"M","status":"ready","createdAt":"2026-11-01T00:00:00Z"}"##
        let json = #"{"links":[\#(link)],"trashed":[],"collections":[]}"#
        let library = try JSONDecoder().decode(LibrarySnapshot.self, from: Data(json.utf8))
        #expect(library.links.map(\.contentType) == [.article])
        #expect(try JSONDecoder().decode([ContentType].self, from: Data(#"["video","product"]"#.utf8)) == [.video, .product])
    }

    @Test func templateDataKeepsWhatDecodesAndDropsTheRest() throws {
        let json = #"{"provider":"youtube","videoId":"abc","durationSeconds":12.5,"ingredients":["salt",1],"yield":"2"}"#
        let t = try JSONDecoder().decode(TemplateData.self, from: Data(json.utf8))
        #expect(t.provider == "youtube" && t.videoId == "abc" && t.yield == "2")
        #expect(t.durationSeconds == nil && t.ingredients == nil)
    }
}
