import Testing
import Foundation
import Models

@Suite struct LocalImagesTests {
    /// A 1×1 GIF: the server keeps GIFs as they are, so prepare must not flatten one.
    private let gif = Data([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0x80, 0, 0, 0, 0, 0, 0xff, 0xff, 0xff,
                            0x21, 0xf9, 4, 0, 0, 0, 0, 0, 0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x44, 1, 0, 0x3b])

    @Test func gifPassesThroughPrepareUntouched() {
        #expect(LocalImages.isGIF(gif))
        #expect(LocalImages.prepare(gif) == gif)
        #expect(!LocalImages.isGIF(Data("not an image".utf8)))
    }

    @Test func gifKeepsItsExtensionOnDisk() {
        let id = "test-\(UUID().uuidString)"
        defer { LocalImages.remove(id) }
        LocalImages.write(gif, id: id)
        #expect(LocalImages.existing(for: id)?.pathExtension == "gif")
        let renamed = "\(id)-renamed"
        LocalImages.rename(id, to: renamed)
        #expect(LocalImages.existing(for: id) == nil)
        #expect(LocalImages.existing(for: renamed)?.pathExtension == "gif")
        LocalImages.remove(renamed)
        #expect(LocalImages.existing(for: renamed) == nil)
    }

    @Test func titleFallsBackToTheFirstLineOfText() {
        #expect(LocalImages.title(caption: " Cat ", text: "ignored") == "Cat")
        #expect(LocalImages.title(caption: nil, text: "\n  THIS IS FINE \nsecond line") == "THIS IS FINE")
        #expect(LocalImages.title(caption: "", text: "") == "Image")
    }
}
