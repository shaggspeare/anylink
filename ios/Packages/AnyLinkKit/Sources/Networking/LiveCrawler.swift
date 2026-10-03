import Foundation
import Models

/// `POST /api/crawl` → NDJSON `CrawlEvent`s. The route can take 60 s; the request times out at 70.
public struct LiveCrawler: Sendable {
    let base: URL
    let token: String?
    let session: URLSession

    public init(base: URL, token: String?, session: URLSession = .shared) {
        self.base = base; self.token = token; self.session = session
    }

    public func crawl(_ url: URL) -> AsyncThrowingStream<CrawlEvent, Error> {
        var req = URLRequest(url: base.appending(path: "api/crawl"), timeoutInterval: 70)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        req.httpBody = try? JSONEncoder().encode(["url": url.absoluteString])
        let session = session
        let request = req

        let (stream, cont) = AsyncThrowingStream.makeStream(of: CrawlEvent.self)
        let task = Task {
            do {
                let (bytes, response) = try await session.bytes(for: request)
                if (response as? HTTPURLResponse)?.statusCode == 400 {
                    cont.yield(.failed(.init(reason: "invalid-url")))
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
