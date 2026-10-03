import Foundation

// MARK: - Enums

public enum CardSize: String, Codable, CaseIterable, Sendable { case S, M, L }
public enum ContentType: String, Codable, Sendable { case article, video, product }
public enum LinkStatus: String, Codable, Sendable { case crawling, ready, failed }

// MARK: - Supporting types

public struct Highlight: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var quote: String
    public var note: String?
    public init(id: String, quote: String, note: String? = nil) { self.id = id; self.quote = quote; self.note = note }
}

public struct PriceSnapshot: Codable, Hashable, Sendable {
    public let date: String
    public let price: Double
    public var day: Date? { Self.dayFormatter.date(from: date) }
    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX"); return f
    }()
}

public struct Variant: Codable, Hashable, Sendable {
    public let label: String
    public let swatch: String
}

public struct Spec: Codable, Hashable, Sendable {
    public let label: String
    public let value: String
}

public struct ProductDetails: Codable, Hashable, Sendable {
    public var retailer: String
    public var retailerInitial: String
    public var retailerColor: String
    public var code: String?
    public var price: Double?
    public var previousPrice: Double?
    public var currency: String
    public var inStock: Bool?
    public var delivery: String?
    public var rating: Double?
    public var reviewCount: Int?
    public var warranty: String?
    public var variants: [Variant]
    public var specs: [Spec]
    public var totalSpecCount: Int
    public var priceHistory: [PriceSnapshot]
    public var alertThreshold: Double?
}

public struct ImportMeta: Codable, Hashable, Sendable {
    public var folder: String?
    public var savedAt: String?
    public var context: String?
}

// MARK: - LinkItem

public struct LinkItem: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var url: String
    public var domain: String
    public var title: String
    public var excerpt: String
    public var articleText: [String]?
    public var heroImage: String?
    public var tint: String
    public var stripe: String
    public var initial: String
    public var contentType: ContentType
    public var readingTimeMinutes: Int?
    public var collectionId: String
    public var tags: [String]
    public var size: CardSize
    public var position: Int?
    public var status: LinkStatus
    public var createdAt: String
    public var source: String?
    public var importMeta: ImportMeta?
    public var note: String?
    public var favorite: Bool?
    public var httpStatus: Int?
    public var archived: Bool?
    public var deleted: Bool?
    public var highlights: [Highlight]?
    public var product: ProductDetails?

    public init(id: String, url: String, domain: String, title: String, excerpt: String, articleText: [String]? = nil, heroImage: String? = nil, tint: String, stripe: String, initial: String, contentType: ContentType, readingTimeMinutes: Int? = nil, collectionId: String, tags: [String], size: CardSize, position: Int? = nil, status: LinkStatus, createdAt: String, source: String? = nil, importMeta: ImportMeta? = nil, note: String? = nil, favorite: Bool? = nil, httpStatus: Int? = nil, archived: Bool? = nil, deleted: Bool? = nil, highlights: [Highlight]? = nil, product: ProductDetails? = nil) {
        self.id = id; self.url = url; self.domain = domain; self.title = title; self.excerpt = excerpt; self.articleText = articleText; self.heroImage = heroImage; self.tint = tint; self.stripe = stripe; self.initial = initial; self.contentType = contentType; self.readingTimeMinutes = readingTimeMinutes; self.collectionId = collectionId; self.tags = tags; self.size = size; self.position = position; self.status = status; self.createdAt = createdAt; self.source = source; self.importMeta = importMeta; self.note = note; self.favorite = favorite; self.httpStatus = httpStatus; self.archived = archived; self.deleted = deleted; self.highlights = highlights; self.product = product
    }
}

public extension LinkItem {
    var isBroken: Bool {
        guard let s = httpStatus else { return false }
        return [0, 1, 404, 410].contains(s)
    }

    var hasNote: Bool { note != nil && !(note!.isEmpty) }

    var readingMeta: String? {
        switch contentType {
        case .video: return "\u{25B6}\u{FE0E} Video"
        case .product:
            guard let p = product, let price = p.price else { return nil }
            return "\(p.currency)\(Int(price))"
        case .article:
            guard let m = readingTimeMinutes else { return nil }
            return "\(m) min read"
        }
    }

    var retailerShortName: String? {
        domain.split(separator: ".").first.map(String.init)
    }
}

// MARK: - LinkCollection

public struct LinkCollection: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public var name: String
    public var color: String
    public var isSmart: Bool?
    public var smartQuery: String?
    public var isInbox: Bool?
    public var reasoning: String?
    public var createdBy: String?

    public init(id: String, name: String, color: String, isSmart: Bool? = nil, smartQuery: String? = nil, isInbox: Bool? = nil, reasoning: String? = nil, createdBy: String? = nil) {
        self.id = id; self.name = name; self.color = color; self.isSmart = isSmart; self.smartQuery = smartQuery; self.isInbox = isInbox; self.reasoning = reasoning; self.createdBy = createdBy
    }
}

// MARK: - Crawl types

public struct CrawlResult: Codable, Sendable, Hashable {
    public let domain: String
    public let canonicalUrl: String
    public let title: String
    public let excerpt: String
    public let articleText: [String]
    public let heroImage: String?
    public let favicon: String?
    public let tint: String
    public let stripe: String
    public let initial: String
    public let contentType: ContentType
    public let suggestedTags: [String]
    public let readingTimeMinutes: Int?
    public let excerptOnly: Bool?
    public let product: ProductDetails?
}

public struct CrawlFailure: Codable, Sendable, Hashable {
    public let reason: String
    public let domain: String?
    public let tint: String?
    public let stripe: String?
    public let initial: String?
    public let suggestedTitle: String?
}

public enum CrawlEvent: Sendable {
    case step(String)
    case preview(CrawlResult)
    case done(CrawlResult)
    case failed(CrawlFailure)
}

extension CrawlEvent: Decodable {
    private enum K: String, CodingKey { case type, step, result }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: K.self)
        switch try c.decode(String.self, forKey: .type) {
        case "step": self = .step(try c.decode(String.self, forKey: .step))
        case "preview": self = .preview(try c.decode(CrawlResult.self, forKey: .result))
        case "done": self = .done(try c.decode(CrawlResult.self, forKey: .result))
        default: self = .failed(try CrawlFailure(from: decoder))
        }
    }
}

// MARK: - LinkDraft

public struct LinkDraft: Sendable {
    public var url: String
    public var title: String?
    public var excerpt: String?
    public var collectionId: String?
    public var tags: [String]
    public var size: CardSize
    public var note: String?
    public var crawl: CrawlResult?

    public init(url: String, title: String? = nil, excerpt: String? = nil, collectionId: String? = nil, tags: [String] = [], size: CardSize = .M, note: String? = nil, crawl: CrawlResult? = nil) {
        self.url = url; self.title = title; self.excerpt = excerpt; self.collectionId = collectionId; self.tags = tags; self.size = size; self.note = note; self.crawl = crawl
    }
}

// MARK: - API support types

public struct LibrarySnapshot: Sendable, Decodable {
    public let links: [LinkItem]
    public let trashed: [LinkItem]
    public let collections: [LinkCollection]

    public init(links: [LinkItem], trashed: [LinkItem], collections: [LinkCollection]) {
        self.links = links; self.trashed = trashed; self.collections = collections
    }
}

public struct LinkPatch: Sendable {
    public var note: String?
    public var favorite: Bool?
    public var size: CardSize?
    public var collectionId: String?
    public init(note: String? = nil, favorite: Bool? = nil, size: CardSize? = nil, collectionId: String? = nil) {
        self.note = note; self.favorite = favorite; self.size = size; self.collectionId = collectionId
    }
}

public enum BulkAction: Sendable {
    case move(to: String)
    case tag(String)
    case archive, trash, restore, purge
}

public struct LinkCheckEvent: Sendable {
    public let type: String
    public let total: Int?
    public let checked: Int?
    public let dead: [DeadLink]?
    public let remaining: Int?
    public let reason: String?

    public struct DeadLink: Codable, Sendable {
        public let id: String
        public let url: String
        public let title: String
        public let status: Int
    }
}

extension LinkCheckEvent: Decodable {
    private enum CodingKeys: String, CodingKey { case type, total, checked, dead, remaining, reason }
}

public struct ImportItem: Codable, Sendable {
    public var url: String
    public var title: String?
    public var folder: String?
    public var savedAt: String?
    public var context: String?
}

public struct ImportResult: Codable, Sendable {
    public let links: [LinkItem]
    public let skipped: Int
    public init(links: [LinkItem], skipped: Int) { self.links = links; self.skipped = skipped }
}

public struct GroupingPriorities: Codable, Sendable {
    public var focus: String?
    public var topics: [String]?
    public var kept: [String]?
}

public struct GroupedResult: Codable, Sendable {
    public let collection: LinkCollection
    public let linkIds: [String]
    public let reasoning: String
}

public struct Signal: Codable, Sendable {
    public let action: String
    public let linkId: String?
    public let linkIds: [String]?
    public let collectionId: String?
    public let payload: [String: String]?

    public init(action: String, linkId: String? = nil, linkIds: [String]? = nil, collectionId: String? = nil, payload: [String: String]? = nil) {
        self.action = action; self.linkId = linkId; self.linkIds = linkIds; self.collectionId = collectionId; self.payload = payload
    }
}

// MARK: - Errors

public enum AppError: Error, Equatable, Sendable {
    case offline, unauthorized, notFound, server(Int), invalidURL, decoding, unknown
}
