import Foundation
import Models

/// Settings → Export (Pro): what `GET /api/v1/export?format=` writes (`src/lib/export.ts`).
public enum ExportFormat: String, CaseIterable, Sendable {
    /// Netscape bookmarks with collections as folders, for any browser.
    case html
    /// Every field of every link and collection.
    case json
    /// One row per link, for a spreadsheet.
    case csv
}

/// A free account's 403 body: `{ "ok": false, "reason": "pro" }`.
private struct ProRefusal: Decodable { let reason: String }

extension LiveAPI {
    /// `GET /api/v1/export?format=`, saved to the temp directory under the server's dated filename. A free account
    /// gets 403 `{ "ok": false, "reason": "pro" }`, which throws `.proRequired`. It's never a 401, so nobody is
    /// signed out.
    public func export(format: ExportFormat) async throws -> URL {
        let url = base.appending(path: "api/v1/export").appending(queryItems: [URLQueryItem(name: "format", value: format.rawValue)])
        var r = URLRequest(url: url, timeoutInterval: 120)
        if let t = await token() { r.setValue("Bearer \(t)", forHTTPHeaderField: "Authorization") }
        do {
            let (data, response) = try await session.data(for: r)
            if (response as? HTTPURLResponse)?.statusCode == 403,
               (try? JSONDecoder().decode(ProRefusal.self, from: data))?.reason == "pro" {
                throw AppError.proRequired
            }
            try Self.check(response)
            let file = URL.temporaryDirectory.appending(path: response.suggestedFilename ?? "anylink.\(format.rawValue)")
            try data.write(to: file, options: .atomic)
            return file
        } catch {
            throw Self.map(error)
        }
    }
}

extension MockAPI {
    /// The mock library in the server's JSON shape, whatever the format: the screens only need a file to hand on.
    public func export(format: ExportFormat) async throws -> URL {
        struct Export: Encodable {
            var format = "anylink", version = 1
            let exportedAt: String, collections: [LinkCollection], links: [LinkItem]
        }
        let snapshot = try await library(since: nil)
        let file = URL.temporaryDirectory.appending(path: "anylink-\(Date.now.formatted(.iso8601.year().month().day())).json")
        let export = Export(exportedAt: Date.now.formatted(.iso8601), collections: snapshot.collections, links: snapshot.links)
        try JSONEncoder().encode(export).write(to: file, options: .atomic)
        return file
    }
}
