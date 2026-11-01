import Foundation
import Models

public enum ArticleBody {
    /// Words in paragraphs of 8+ words. Shorter blocks are captions, bylines and nav crumbs.
    public static func proseWordCount(_ blocks: [String]) -> Int {
        blocks.map { $0.split(whereSeparator: \.isWhitespace).count }.filter { $0 >= 8 }.reduce(0, +)
    }

    /// Under 40 words of prose, the reader shows the excerpt plus the "summary only" notice.
    public static func hasEnoughProse(_ blocks: [String]?) -> Bool { proseWordCount(blocks ?? []) >= 40 }
}

// MARK: - Templates (04-screens S15)

public extension TemplateData {
    /// The privacy-enhanced YouTube or Vimeo player, playing inline at once: the user has just tapped Play. Nil for
    /// any other site, or for an id with characters a URL or an HTML string shouldn't carry (the web's rule too).
    var embedURL: URL? {
        guard let id = videoId, (1...64).contains(id.count),
              id.allSatisfy({ $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "_" || $0 == "-") }) else { return nil }
        switch provider {
        case "youtube": return URL(string: "https://www.youtube-nocookie.com/embed/\(id)?playsinline=1&autoplay=1")
        case "vimeo": return URL(string: "https://player.vimeo.com/video/\(id)?dnt=1&playsinline=1&autoplay=1")
        default: return nil
        }
    }

    /// "Systems Live · 2:01:02", either part alone.
    var videoMeta: String? {
        let length = durationSeconds.flatMap { s in
            s > 0 ? Duration.seconds(s).formatted(.time(pattern: s >= 3600 ? .hourMinuteSecond : .minuteSecond)) : nil
        }
        return Self.joined([channel, length])
    }

    /// "By Mark Garcia · Sep 29, 2026", either part alone.
    var byline: String? {
        let date = publishedAt.flatMap(DateSections.date).map { $0.formatted(date: .abbreviated, time: .omitted) }
        return Self.joined([author.map { "By \($0)" }, date])
    }

    /// Enough for the recipe card: some ingredients or steps.
    var hasRecipe: Bool { !(ingredients ?? []).isEmpty || !(steps ?? []).isEmpty }

    /// "Prep 15 min", "Cook 45 min", "Total 1 h", "Makes 2 bowls": only what the page gave.
    var recipeTimes: [String] {
        [prepMinutes.map { "Prep \(Self.minutes($0))" }, cookMinutes.map { "Cook \(Self.minutes($0))" },
         totalMinutes.map { "Total \(Self.minutes($0))" }, yield.map { "Makes \($0)" }].compactMap { $0 }
    }

    /// 45 → "45 min", 60 → "1 h", 75 → "1 h 15 min". Same as the web's `minutesLabel`.
    static func minutes(_ total: Int) -> String {
        let h = total / 60, m = total % 60
        return h == 0 ? "\(m) min" : m == 0 ? "\(h) h" : "\(h) h \(m) min"
    }

    private static func joined(_ parts: [String?]) -> String? {
        let text = parts.compactMap { $0 }.joined(separator: " · ")
        return text.isEmpty ? nil : text
    }
}

public enum PriceRange: String, CaseIterable, Identifiable, Sendable {
    case month = "1M", quarter = "3M", all = "All"
    public var id: Self { self }
    var months: Int? { switch self { case .month: 1; case .quarter: 3; case .all: nil } }
}

public struct PriceSummary: Sendable {
    public let product: ProductDetails
    public init(_ product: ProductDetails) { self.product = product }

    var history: [PriceSnapshot] { product.priceHistory.sorted { $0.date < $1.date } }
    public var first: PriceSnapshot? { history.first }
    public var latest: PriceSnapshot? { history.last }
    public var current: Double? { product.price ?? latest?.price }

    /// "−{n}% since saved": first snapshot vs the latest. nil when the price hasn't dropped.
    public var percentSinceSaved: Int? {
        guard let f = first?.price, f > 0, let now = latest?.price else { return nil }
        let pct = Int(((f - now) / f * 100).rounded())
        return pct > 0 ? pct : nil
    }

    /// The latest price is at or under the alert threshold: "Under your price".
    public var isUnderAlert: Bool {
        guard let threshold = product.alertThreshold, let now = current else { return false }
        return now <= threshold
    }

    /// The chart needs at least two snapshots.
    public var showsChart: Bool { history.count >= 2 }

    public func points(in range: PriceRange, calendar: Calendar = .current) -> [PriceSnapshot] {
        guard let months = range.months, let end = latest?.day,
              let start = calendar.date(byAdding: .month, value: -months, to: end) else { return history }
        let pts = history.filter { ($0.day ?? .distantPast) >= start }
        return pts.count >= 2 ? pts : Array(history.suffix(2))
    }

    /// Y domain covering the points and the alert threshold, padded 8 %.
    public func yDomain(for points: [PriceSnapshot]) -> ClosedRange<Double> {
        let values = points.map(\.price) + [product.alertThreshold].compactMap { $0 }
        guard let lo = values.min(), let hi = values.max() else { return 0...1 }
        let pad = max((hi - lo) * 0.08, hi * 0.01)
        return (lo - pad)...(hi + pad)
    }

    public static func format(_ value: Double, _ currency: String) -> String {
        "\(currency)\(Int(value.rounded()).formatted(.number.grouping(.automatic)))"
    }
}

extension LibraryStore {
    public func setPriceAlert(_ id: LinkItem.ID, threshold: Double) {
        guard let currency = link(id)?.product?.currency else { return }
        let before = links[id].map { [$0] } ?? []
        if var l = links[id] { l.product?.alertThreshold = threshold; links[id] = l }
        syncPriceAlert(id: id, threshold: threshold, currency: currency, before: before)
    }

    /// Links sharing this one's collection, newest first.
    public func alsoIn(_ link: LinkItem) -> [LinkItem] {
        live.filter { $0.collectionId == link.collectionId && $0.id != link.id }
    }
}
