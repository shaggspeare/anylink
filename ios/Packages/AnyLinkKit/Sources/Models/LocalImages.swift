import Foundation
import ImageIO
import UniformTypeIdentifiers
import Vision

/// The on-device copy of saved images, in the App Group so the share extension and the app see the same
/// files. A card shows the local file when there is one — instantly, offline — and the uploaded copy otherwise.
public enum LocalImages {
    public static let group = "group.com.shaggspeare.anylink"

    static var directory: URL {
        let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)
            ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let dir = base.appending(path: "Images", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    /// A JPEG, or a GIF kept as it came: a meme that moves is the whole point of it.
    public static func url(for id: String, gif: Bool = false) -> URL { directory.appending(path: "\(id).\(gif ? "gif" : "jpg")") }

    /// The local file for a link, if this device has one.
    public static func existing(for id: String) -> URL? {
        [url(for: id, gif: true), url(for: id)].first { FileManager.default.fileExists(atPath: $0.path(percentEncoded: false)) }
    }

    public static func isGIF(_ data: Data) -> Bool { data.starts(with: Array("GIF8".utf8)) }

    /// The server takes an original up to this size; a bigger GIF is flattened to a JPEG like any other image.
    public static let maxGIFBytes = 25 << 20

    @discardableResult
    public static func write(_ data: Data, id: String) -> URL? {
        let u = url(for: id, gif: isGIF(data))
        return (try? data.write(to: u, options: .atomic)) == nil ? nil : u
    }

    /// Temp id → server id once the upload lands, so the card keeps its local file.
    public static func rename(_ from: String, to: String) {
        for gif in [true, false] { try? FileManager.default.moveItem(at: url(for: from, gif: gif), to: url(for: to, gif: gif)) }
    }

    public static func remove(_ id: String) {
        for gif in [true, false] { try? FileManager.default.removeItem(at: url(for: id, gif: gif)) }
    }

    /// Any image (HEIC, PNG, …) → a JPEG no longer than `maxPixels` on its long side, orientation applied.
    /// The server can't read HEIC, and a phone photo doesn't need 48 MP to be remembered. A GIF the server
    /// would keep passes through untouched. Uses ImageIO's thumbnailer, so the share extension never decodes
    /// the full bitmap.
    public static func prepare(_ data: Data, maxPixels: Int = 2400) -> Data? {
        if isGIF(data), data.count <= maxGIFBytes { return data }
        guard let src = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary),
              let image = CGImageSourceCreateThumbnailAtIndex(src, 0, [
                  kCGImageSourceCreateThumbnailFromImageAlways: true,
                  kCGImageSourceCreateThumbnailWithTransform: true,
                  kCGImageSourceThumbnailMaxPixelSize: maxPixels,
              ] as CFDictionary) else { return nil }
        let out = NSMutableData()
        guard let dest = CGImageDestinationCreateWithData(out, UTType.jpeg.identifier as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(dest, image, [kCGImageDestinationLossyCompressionQuality: 0.86] as CFDictionary)
        return CGImageDestinationFinalize(dest) ? out as Data : nil
    }

    /// The words on the image, one line per line of text, read on the device: that's how a meme or a
    /// screenshot gets found again. "" when there's none, or when Vision can't read the file.
    public static func text(in data: Data) async -> String {
        var request = RecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.automaticallyDetectsLanguage = true
        request.usesLanguageCorrection = true
        guard let lines = try? await request.perform(on: data) else { return "" }
        return lines.compactMap { $0.topCandidates(1).first?.string.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
            .joined(separator: "\n")
    }

    /// A title for an image nobody captioned: its first line of text, like a note's.
    public static func title(caption: String?, text: String) -> String {
        if let caption = caption?.trimmingCharacters(in: .whitespacesAndNewlines), !caption.isEmpty { return caption }
        let line = text.split(separator: "\n").lazy.map { $0.trimmingCharacters(in: .whitespaces) }.first { !$0.isEmpty } ?? ""
        if line.isEmpty { return "Image" }
        return line.count > 120 ? String(line.prefix(119)).trimmingCharacters(in: .whitespaces) + "…" : line
    }
}

public extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}

/// A note's title is its first non-empty line — same rule as the web's `noteTitle`.
public func noteTitle(_ text: String, max: Int = 120) -> String {
    let line = text.split(separator: "\n").lazy.map { $0.trimmingCharacters(in: .whitespaces) }.first { !$0.isEmpty } ?? ""
    if line.isEmpty { return "Note" }
    return line.count > max ? String(line.prefix(max - 1)).trimmingCharacters(in: .whitespaces) + "…" : line
}
