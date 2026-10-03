import Foundation
import Models

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

    public static let crawlSuccessLines = crawlLines("crawl-success")
    public static let crawlExcerptOnlyLines = crawlLines("crawl-excerpt-only")
    public static let crawlFailedLines = crawlLines("crawl-failed")
}
