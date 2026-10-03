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
