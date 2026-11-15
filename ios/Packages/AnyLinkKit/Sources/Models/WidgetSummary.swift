import Foundation

/// What the widgets show, in the App Group defaults: written by the app after a library save and by the share
/// extension after a save. Small on purpose: a widget gets ~30 MB, so it never decodes the full library.
public struct WidgetSummary: Codable, Equatable, Sendable {
    public var unsorted: Int
    /// Newest first, without article text or highlights.
    public var recent: [LinkItem]
    /// The newest saved images, for the Memes widget. Missing in a summary from before it: reads as none.
    public var images: [LinkItem]

    public static let limit = 3
    public static let imageLimit = 6
    static let key = "widgetSummary"

    public init(unsorted: Int, recent: [LinkItem], images: [LinkItem] = []) {
        self.unsorted = unsorted
        self.recent = recent.prefix(Self.limit).map { var l = $0; l.articleText = nil; l.highlights = nil; return l }
        self.images = images.prefix(Self.imageLimit).map { var l = $0; l.articleText = nil; l.highlights = nil; return l }
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        unsorted = try c.decode(Int.self, forKey: .unsorted)
        recent = try c.decode([LinkItem].self, forKey: .recent)
        images = try c.decodeIfPresent([LinkItem].self, forKey: .images) ?? []
    }

    private static var defaults: UserDefaults? { UserDefaults(suiteName: LocalImages.group) }

    public static func load() -> WidgetSummary? {
        defaults?.data(forKey: key).flatMap { try? JSONDecoder().decode(Self.self, from: $0) }
    }

    public func save() {
        if let data = try? JSONEncoder().encode(self) { Self.defaults?.set(data, forKey: Self.key) }
    }

    public static func clear() { defaults?.removeObject(forKey: key) }

    /// A save made outside the app shows at once; the app's next sync writes the real summary.
    public func adding(_ link: LinkItem, toUnsorted: Bool) -> WidgetSummary {
        WidgetSummary(unsorted: unsorted + (toUnsorted ? 1 : 0), recent: [link] + recent.filter { $0.id != link.id },
                      images: link.isImage ? [link] + images.filter { $0.id != link.id } : images)
    }
}
