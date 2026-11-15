import AppIntents
import Foundation
import Models
import Persistence
import UIKit
import UniformTypeIdentifiers

/// Puts a saved image on the clipboard: a GIF as a GIF, anything else as a picture, so X, Threads or Messages
/// paste it. Shared by the Memes widget, Siri and Shortcuts. In both the app and the widget extension, so the
/// system runs it in the app.
enum ImageClipboard {
    /// The library as the app last left it in the App Group: the store writes its cache after every change.
    @MainActor
    static func images() -> [LinkItem] { ImageLibrary.links() }

    /// The file for Shortcuts to pass on, once it's on the clipboard. Nil when the image can't be read.
    @MainActor
    static func copy(_ link: LinkItem) async -> IntentFile? {
        guard let data = await ImageLibrary.data(for: link) else { return nil }
        let gif = LocalImages.isGIF(data)
        if gif {
            UIPasteboard.general.setData(data, forPasteboardType: UTType.gif.identifier)
        } else if let image = UIImage(data: data) {
            UIPasteboard.general.image = image
        } else {
            return nil
        }
        return IntentFile(data: data, filename: "\(link.title.prefix(60)).\(gif ? "gif" : "png")", type: gif ? .gif : .image)
    }
}

/// One image by id: the Memes widget's tap.
struct CopyImageIntent: AppIntent {
    static let title: LocalizedStringResource = "Copy Image"
    static let description = IntentDescription("Copies a saved image so you can paste it anywhere.")
    static let isDiscoverable = false

    @Parameter(title: "Image") var linkID: String

    init() {}
    init(linkID: String) { self.linkID = linkID }

    @MainActor
    func perform() async throws -> some IntentResult & ReturnsValue<IntentFile?> {
        guard let link = ImageClipboard.images().first(where: { $0.id == linkID }) else { return .result(value: nil) }
        return .result(value: await ImageClipboard.copy(link))
    }
}

/// "Copy a meme": the newest saved image whose words, title or tags match, or just the newest.
struct CopyMemeIntent: AppIntent {
    static let title: LocalizedStringResource = "Copy Meme"
    static let description = IntentDescription("Finds a saved image by the words on it and copies it, ready to paste.")

    @Parameter(title: "Words on it", requestValueDialog: "Which meme? Say a few words from it.") var query: String?

    @MainActor
    func perform() async throws -> some IntentResult & ReturnsValue<IntentFile?> & ProvidesDialog {
        let query = query?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard let link = ImageLibrary.matching(query, in: ImageClipboard.images()).first else {
            return .result(value: nil, dialog: query.isEmpty ? "You haven't saved any images yet." : "No saved image matches \(query).")
        }
        guard let file = await ImageClipboard.copy(link) else { return .result(value: nil, dialog: "That image couldn't be read.") }
        return .result(value: file, dialog: "Copied \(link.title). Paste it anywhere.")
    }
}
