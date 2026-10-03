import Foundation
import ImageIO
import SwiftUI

/// One shared loader for hero images: URLCache-backed memory + disk cache, decoded and downsampled to the
/// display size with ImageIO (WebP included), so grids don't hold full-size bitmaps.
public actor ImageLoader {
    public static let shared = ImageLoader()

    private let session: URLSession
    private let decoded = NSCache<NSString, CGImageBox>()

    init() {
        let config = URLSessionConfiguration.default
        config.urlCache = URLCache(memoryCapacity: 32 << 20, diskCapacity: 256 << 20)
        config.requestCachePolicy = .returnCacheDataElseLoad
        session = URLSession(configuration: config)
        decoded.countLimit = 300
    }

    final class CGImageBox: @unchecked Sendable { let image: CGImage; init(_ i: CGImage) { image = i } }

    /// `maxPixels` is the longest side in pixels (points × display scale).
    public func image(for url: URL, maxPixels: Int) async throws -> CGImage {
        let key = "\(url.absoluteString)#\(maxPixels)" as NSString
        if let hit = decoded.object(forKey: key) { return hit.image }
        let (data, _) = try await session.data(from: url)
        guard let image = Self.downsample(data, maxPixels: maxPixels) else { throw URLError(.cannotDecodeContentData) }
        decoded.setObject(CGImageBox(image), forKey: key)
        return image
    }

    static func downsample(_ data: Data, maxPixels: Int) -> CGImage? {
        guard let src = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary) else { return nil }
        return CGImageSourceCreateThumbnailAtIndex(src, 0, [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: max(1, maxPixels),
        ] as CFDictionary)
    }
}
