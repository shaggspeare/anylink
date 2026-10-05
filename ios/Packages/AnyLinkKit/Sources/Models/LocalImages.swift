import Foundation
import ImageIO
import UniformTypeIdentifiers

/// The on-device copy of saved images, in the App Group so the share extension and the app see the same
/// files. A card shows the local file when there is one — instantly, offline — and the uploaded copy otherwise.
public enum LocalImages {
    public static let group = "group.app.anylink.ios"

    static var directory: URL {
        let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)
            ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let dir = base.appending(path: "Images", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    public static func url(for id: String) -> URL { directory.appending(path: "\(id).jpg") }

    /// The local file for a link, if this device has one.
    public static func existing(for id: String) -> URL? {
        let u = url(for: id)
        return FileManager.default.fileExists(atPath: u.path()) ? u : nil
    }

    @discardableResult
    public static func write(_ data: Data, id: String) -> URL? {
        let u = url(for: id)
        return (try? data.write(to: u, options: .atomic)) == nil ? nil : u
    }

    /// Temp id → server id once the upload lands, so the card keeps its local file.
    public static func rename(_ from: String, to: String) {
        try? FileManager.default.moveItem(at: url(for: from), to: url(for: to))
    }

    public static func remove(_ id: String) { try? FileManager.default.removeItem(at: url(for: id)) }

    /// Any image (HEIC, PNG, …) → a JPEG no longer than `maxPixels` on its long side, orientation applied.
    /// The server can't read HEIC, and a phone photo doesn't need 48 MP to be remembered.
    /// Uses ImageIO's thumbnailer, so the share extension never decodes the full bitmap.
    public static func prepare(_ data: Data, maxPixels: Int = 2400) -> Data? {
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
