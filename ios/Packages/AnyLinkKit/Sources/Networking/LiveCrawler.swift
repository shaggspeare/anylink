import Foundation
import Models

/// `POST /api/crawl` → NDJSON `CrawlEvent`s. The route can take 60 s; the request times out at 70.
public struct LiveCrawler: Sendable {
    let base: URL
    let token: String?
    let session: URLSession
    /// Signs the call when there's no token: an install without an account crawls on its App Attest key's daily cap.
    let attest: (any AppAttesting)?

    public init(base: URL, token: String?, session: URLSession = .shared, attest: (any AppAttesting)? = nil) {
        self.base = base; self.token = token; self.session = session; self.attest = attest
    }

    public func crawl(_ url: URL) -> AsyncThrowingStream<CrawlEvent, Error> {
        var req = URLRequest(url: base.appending(path: "api/crawl"), timeoutInterval: 70)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        req.setValue(ContentType.header, forHTTPHeaderField: "X-AnyLink-Types")
        req.httpBody = try? JSONEncoder().encode(["url": url.absoluteString])
        let session = session
        let request = req
        let attest = token == nil ? attest : nil

        let (stream, cont) = AsyncThrowingStream.makeStream(of: CrawlEvent.self)
        let task = Task {
            do {
                let (bytes, response) = if let attest {
                    try await attest.bytes(for: request, session: session)
                } else {
                    try await session.bytes(for: request)
                }
                // Not a stream: a bad URL, or a guest past their preview budget.
                let refused = switch (response as? HTTPURLResponse)?.statusCode {
                case 400: "invalid-url"
                case 429: "rate-limited"
                default: String?.none
                }
                if let refused {
                    cont.yield(.failed(.init(reason: refused)))
                    cont.finish()
                    return
                }
                var terminal = false
                for try await line in bytes.lines where !line.isEmpty {
                    let event = try NDJSONDecoder.decodeLine(line, as: CrawlEvent.self)
                    if case .step = event {} else if case .preview = event {} else { terminal = true }
                    cont.yield(event)
                }
                if !terminal { cont.yield(.failed(.init(reason: "network"))) }
                cont.finish()
            } catch is CancellationError {
                cont.finish()
            } catch let e as URLError where e.code == .cancelled {
                cont.finish()
            } catch let e as URLError where e.code == .notConnectedToInternet {
                cont.finish(throwing: AppError.offline)
            } catch {
                cont.yield(.failed(.init(reason: "network")))
                cont.finish()
            }
        }
        cont.onTermination = { _ in task.cancel() }
        return stream
    }
}
