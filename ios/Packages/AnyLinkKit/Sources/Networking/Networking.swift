import Foundation
import Models

// MARK: - AnyLinkAPI protocol

public protocol AnyLinkAPI: Sendable {
    func crawl(_ url: URL) async -> AsyncThrowingStream<CrawlEvent, Error>
    func checkImportedLinks() async -> AsyncThrowingStream<LinkCheckEvent, Error>
    func library(since: Date?) async throws -> LibrarySnapshot
    func createLink(_ draft: LinkDraft) async throws -> LinkItem
    func createNote(_ text: String, collectionId: LinkCollection.ID?) async throws -> LinkItem
    /// `data` is a prepared JPEG (`LocalImages.prepare`); the server re-encodes and stores it.
    func createImage(_ data: Data, collectionId: LinkCollection.ID?, caption: String?) async throws -> LinkItem
    func setNoteText(_ id: LinkItem.ID, _ text: String) async throws
    func updateLink(_ id: LinkItem.ID, _ patch: LinkPatch) async throws
    func bulk(_ action: BulkAction, ids: [LinkItem.ID]) async throws
    func reorder(_ ids: [LinkItem.ID]) async throws
    func reorderCollections(_ ids: [LinkCollection.ID]) async throws
    func createCollection(name: String, color: String) async throws -> LinkCollection
    func createFilter(name: String, query: String) async throws -> LinkCollection
    func updateCollection(_ id: LinkCollection.ID, name: String) async throws
    func deleteCollection(_ id: LinkCollection.ID) async throws -> [LinkItem.ID]
    func deleteEmptyCollections() async throws -> [LinkCollection.ID]
    func addHighlight(_ id: LinkItem.ID, quote: String) async throws
    func setPriceAlert(_ id: LinkItem.ID, threshold: Double, currency: String) async throws
    func importLinks(_ items: [ImportItem]) async throws -> ImportResult
    func groupInbox(_ priorities: GroupingPriorities) async throws -> [GroupedResult]
    func logSignal(_ signal: Signal) async
    func deleteAccount() async throws
}

public extension AnyLinkAPI {
    // Defaults so test doubles that only care about links don't have to stub these.
    func createNote(_ text: String, collectionId: LinkCollection.ID?) async throws -> LinkItem { throw AppError.server(501) }
    func createImage(_ data: Data, collectionId: LinkCollection.ID?, caption: String?) async throws -> LinkItem { throw AppError.server(501) }
    func setNoteText(_ id: LinkItem.ID, _ text: String) async throws { throw AppError.server(501) }
}

// MARK: - NDJSON decoder

public enum NDJSONDecoder {
    public static func decodeLine<T: Decodable>(_ line: String, as type: T.Type) throws -> T {
        guard let data = line.data(using: .utf8) else { throw AppError.decoding }
        return try JSONDecoder().decode(type, from: data)
    }

    public static func delayMs(from line: String) -> Int? {
        guard let data = line.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return obj["_delayMs"] as? Int
    }
}
