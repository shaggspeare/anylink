import Foundation
import Models

/// What an iOS install without an account asks the server for (docs/adr/0002): the import's dead-link check and its AI
/// grouping, each signed with App Attest. The server stores nothing. A local library calls these where `LiveAPI` calls
/// `checkImportedLinks` and `groupInbox`, and gets the same shapes back.
public struct LocalServices: Sendable {
    let base: URL
    let attest: any AppAttesting
    let session: URLSession

    public init(base: URL, attest: any AppAttesting, session: URLSession = .shared) {
        self.base = base; self.attest = attest; self.session = session
    }

    /// `POST /api/v1/local/check`: `checkImportedLinks`' events for up to 600 links a call. Links are checked in order,
    /// and `remaining` counts the ones at the end that the call didn't reach.
    public func check(_ links: [LinkItem]) -> AsyncThrowingStream<LinkCheckEvent, Error> {
        let request = post("api/v1/local/check", ["links": links.map { ["id": $0.id, "url": $0.url, "title": $0.title] }], timeout: 300)
        let attest = attest, session = session
        let (stream, cont) = AsyncThrowingStream.makeStream(of: LinkCheckEvent.self)
        let task = Task {
            do {
                let (bytes, response) = try await attest.bytes(for: request, session: session)
                try LiveAPI.check(response)
                for try await line in bytes.lines where !line.isEmpty {
                    cont.yield(try NDJSONDecoder.decodeLine(line, as: LinkCheckEvent.self))
                }
                cont.finish()
            } catch {
                cont.finish(throwing: LiveAPI.map(error))
            }
        }
        cont.onTermination = { _ in task.cancel() }
        return stream
    }

    /// `POST /api/v1/local/group`: `groupInbox` for links the server has never seen. Dead links stay out, as they do
    /// there; each result's collection is new, for the caller to create.
    public func group(_ links: [LinkItem], priorities: GroupingPriorities) async throws -> [GroupedResult] {
        struct Link: Encodable { let id, title, domain: String; let note: String? }
        struct Body: Encodable { let priorities: GroupingPriorities; let links: [Link] }
        let alive = links.filter { !$0.isBroken }.map {
            Link(id: $0.id, title: $0.title, domain: $0.domain, note: $0.importMeta?.folder ?? $0.importMeta?.context)
        }
        guard !alive.isEmpty else { return [] }
        let request = post("api/v1/local/group", Body(priorities: priorities, links: alive), timeout: 180)
        do {
            let (bytes, response) = try await attest.bytes(for: request, session: session)
            try LiveAPI.check(response)
            var data = Data()
            for try await byte in bytes { data.append(byte) }
            return try JSONDecoder().decode([GroupedResult].self, from: data)
        } catch {
            throw LiveAPI.map(error)
        }
    }

    private func post(_ path: String, _ body: some Encodable, timeout: TimeInterval) -> URLRequest {
        var request = URLRequest(url: base.appending(path: path), timeoutInterval: timeout)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONEncoder().encode(body)
        return request
    }
}
