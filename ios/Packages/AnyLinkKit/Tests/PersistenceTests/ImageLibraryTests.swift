import Testing
import Foundation
import Models
import Persistence

@Suite struct ImageLibraryTests {
    private func image(_ id: String, title: String, text: String = "", tags: [String] = [], createdAt: String, deleted: Bool? = nil) -> LinkItem {
        LinkItem(id: id, url: "", domain: "", title: title, excerpt: text, tint: "#000000", stripe: "#ffffff", initial: "▣",
                 contentType: .image, collectionId: "c", tags: tags, size: .M, status: .ready, createdAt: createdAt, deleted: deleted)
    }

    @Test func newestLiveImagesFirstAndEveryWordMustMatch() {
        let links = [
            image("old", title: "Drake meme", text: "sleeping\nworking", createdAt: "2026-01-01T00:00:00Z"),
            image("new", title: "Cat", tags: ["reaction"], createdAt: "2026-02-01T00:00:00Z"),
            image("gone", title: "Cat", createdAt: "2026-03-01T00:00:00Z", deleted: true),
            LinkItem(id: "page", url: "https://a.b", domain: "a.b", title: "cat page", excerpt: "", tint: "#000000", stripe: "#ffffff",
                     initial: "A", contentType: .article, collectionId: "c", tags: [], size: .M, status: .ready, createdAt: "2026-04-01T00:00:00Z"),
        ]
        let images = ImageLibrary.newestFirst(links)
        #expect(images.map(\.id) == ["new", "old"])
        #expect(ImageLibrary.matching("cat", in: images).map(\.id) == ["new"])
        #expect(ImageLibrary.matching("drake sleeping", in: images).map(\.id) == ["old"])
        #expect(ImageLibrary.matching("reaction", in: images).map(\.id) == ["new"])
        #expect(ImageLibrary.matching("drake cat", in: images).isEmpty)
        #expect(ImageLibrary.matching("  ", in: images).count == 2)
    }
}
