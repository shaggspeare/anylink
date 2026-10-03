import Foundation
import Models
import Networking

public enum Fixtures {
    public static let library: LibrarySnapshot = {
        let url = Bundle.module.url(forResource: "library", withExtension: "json")!
        let data = try! Data(contentsOf: url)
        return try! JSONDecoder().decode(LibrarySnapshot.self, from: data)
    }()

    public static var links: [LinkItem] { library.links }
    public static var trashed: [LinkItem] { library.trashed }
    public static var collections: [LinkCollection] { library.collections }

    public static func crawlLines(_ name: String) -> [String] {
        guard let url = Bundle.module.url(forResource: name, withExtension: "ndjson") else { return [] }
        guard let data = try? Data(contentsOf: url), let text = String(data: data, encoding: .utf8) else { return [] }
        return text.split(separator: "\n", omittingEmptySubsequences: true).map(String.init)
    }

    /// Synthetic Chrome bookmarks export (25 http links, 4 folders, 1 bookmarklet) and Telegram result.json (11 links).
    public static func sample(_ name: String) -> Data {
        let parts = name.split(separator: ".")
        guard let url = Bundle.module.url(forResource: String(parts[0]), withExtension: String(parts[1])),
              let data = try? Data(contentsOf: url) else { return Data() }
        return data
    }

    public static let crawlSuccessLines = crawlLines("crawl-success")
    public static let crawlExcerptOnlyLines = crawlLines("crawl-excerpt-only")
    public static let crawlFailedLines = crawlLines("crawl-failed")
}

extension MockAPI {
    public static func fixtures(latency: Bool = true) -> MockAPI {
        MockAPI(
            links: Fixtures.links, trashed: Fixtures.trashed, collections: Fixtures.collections,
            crawlLines: [
                "success": Fixtures.crawlSuccessLines,
                "excerpt-only": Fixtures.crawlExcerptOnlyLines,
                "failed": Fixtures.crawlFailedLines,
            ],
            latency: latency
        )
    }
}
