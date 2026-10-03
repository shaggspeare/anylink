import Foundation
import Models

/// Export-file readers, ported from the web app's `src/lib/import/parse.ts` so both clients agree.
public enum ImportParsers {
    /// One import can't run the device out of memory on a pathological file.
    public static let maxLinks = 5000

    public enum Failure: Error, Equatable { case unreadable, empty }

    /// Same shape as JavaScript's `toISOString()`: 2023-11-14T22:13:20.000Z.
    static let isoMillis = Date.ISO8601FormatStyle(includingFractionalSeconds: true)

    static func isHTTP(_ s: String) -> Bool {
        guard let u = URL(string: s), let scheme = u.scheme?.lowercased(), u.host() != nil else { return false }
        return scheme == "http" || scheme == "https"
    }

    // MARK: - Bookmarks (Netscape HTML: Chrome, Safari, Firefox, Arc)

    private static let token = try! NSRegularExpression(
        pattern: #"<h3[^>]*>([\s\S]*?)</h3>|<a\s([^>]*)>([\s\S]*?)</a>|</dl>"#, options: [.caseInsensitive])
    private static let href = try! NSRegularExpression(pattern: #"\bhref\s*=\s*["']([^"']*)["']"#, options: [.caseInsensitive])
    private static let addDate = try! NSRegularExpression(pattern: #"\badd_date\s*=\s*["'](\d+)["']"#, options: [.caseInsensitive])
    private static let tags = try! NSRegularExpression(pattern: "<[^>]*>")
    private static let entity = try! NSRegularExpression(pattern: "&(#x?[0-9a-f]+|[a-z]+);", options: [.caseInsensitive])

    /// `<H3>` opens a folder, `</DL>` closes one, so a stack over those gives each link its folder trail.
    public static func bookmarks(_ html: String, source: String = "chrome") -> [ImportItem] {
        let ns = html as NSString
        var folders: [String] = []
        var seen = Set<String>()
        var out: [ImportItem] = []

        for m in token.matches(in: html, range: NSRange(location: 0, length: ns.length)) {
            if m.range(at: 1).location != NSNotFound {
                folders.append(text(ns.substring(with: m.range(at: 1))))
                continue
            }
            if m.range(at: 2).location == NSNotFound {      // </dl>
                _ = folders.popLast()
                continue
            }
            let attrs = ns.substring(with: m.range(at: 2))
            let url = decode(first(href, in: attrs) ?? "").trimmingCharacters(in: .whitespaces)
            guard isHTTP(url), !seen.contains(url) else { continue }
            seen.insert(url)
            let label = text(ns.substring(with: m.range(at: 3)))
            let saved = first(addDate, in: attrs).flatMap(Double.init).map {
                Date(timeIntervalSince1970: $0).formatted(isoMillis)
            }
            let trail = folders.filter { !$0.isEmpty }.joined(separator: " / ")
            out.append(ImportItem(
                url: url,
                title: label.isEmpty ? titleFromURL(url) : label,
                source: source,
                meta: ImportMeta(folder: trail.isEmpty ? nil : trail, savedAt: saved)
            ))
            if out.count >= maxLinks { break }
        }
        return out
    }

    // MARK: - Telegram (result.json)

    private struct Entity: Decodable { let type: String?; let text: String?; let href: String? }
    private struct Message: Decodable { let date: String?; let text_entities: [Entity]? }
    private struct Chat: Decodable { let type: String?; let messages: [Message]? }
    private struct Chats: Decodable { let list: [Chat]? }
    private struct Root: Decodable { let messages: [Message]?; let chats: Chats? }

    private static let linkEntities: Set<String> = ["link", "url", "text_link"]
    private static let urlAsText: Set<String> = ["link", "url"]

    /// Accepts a Saved Messages export, or a full export (only Saved Messages is read).
    public static func telegram(_ data: Data) throws -> [ImportItem] {
        guard let root = try? JSONDecoder().decode(Root.self, from: data) else { throw Failure.unreadable }
        let messages = root.messages
            ?? root.chats?.list?.filter { $0.type == "saved_messages" }.flatMap { $0.messages ?? [] }
            ?? []
        let dateIn = DateFormatter()
        dateIn.locale = Locale(identifier: "en_US_POSIX")
        dateIn.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"

        var seen = Set<String>()
        var out: [ImportItem] = []
        for message in messages {
            let entities = message.text_entities ?? []
            let urls = entities.filter { linkEntities.contains($0.type ?? "") }
                .map { (($0.href?.isEmpty == false ? $0.href : $0.text) ?? "").trimmingCharacters(in: .whitespaces) }
                .filter(isHTTP)
            guard !urls.isEmpty else { continue }
            // What the user typed around the link — the closest thing Telegram has to a folder. Capped.
            let context = String(entities.filter { !urlAsText.contains($0.type ?? "") }
                .map { $0.text ?? "" }.joined()
                .split(whereSeparator: \.isWhitespace).joined(separator: " ")
                .prefix(500))
            let firstSentence = context.split(whereSeparator: { ".!?\n".contains($0) }).first
                .map { String($0.trimmingCharacters(in: .whitespaces).prefix(120)) } ?? ""
            let saved = message.date.flatMap(dateIn.date(from:))?.formatted(isoMillis)
            for url in urls where !seen.contains(url) {
                seen.insert(url)
                out.append(ImportItem(
                    url: url,
                    title: firstSentence.isEmpty ? titleFromURL(url) : firstSentence,
                    source: "telegram",
                    meta: ImportMeta(savedAt: saved, context: context.isEmpty ? nil : context)
                ))
                if out.count >= maxLinks { return out }
            }
        }
        return out
    }

    // MARK: - Dispatch and merge

    /// `.json` reads as Telegram; anything else as bookmark HTML. Throws `.unreadable` or `.empty`.
    public static func parse(fileName: String, data: Data) throws -> [ImportItem] {
        let items: [ImportItem]
        if fileName.lowercased().hasSuffix(".json") {
            items = try telegram(data)
        } else {
            guard let html = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .isoLatin1),
                  html.range(of: "<a", options: .caseInsensitive) != nil || html.range(of: "<dl", options: .caseInsensitive) != nil
            else { throw Failure.unreadable }
            let telegramHTML = fileName.range(of: "telegram|messages", options: [.regularExpression, .caseInsensitive]) != nil
            items = bookmarks(html, source: telegramHTML ? "telegram" : "chrome")
        }
        if items.isEmpty { throw Failure.empty }
        return items
    }

    /// First occurrence of a URL wins across files. Capped at `maxLinks`.
    public static func merge(_ batches: [[ImportItem]]) -> [ImportItem] {
        var seen = Set<String>()
        return Array(batches.joined().filter { seen.insert($0.url).inserted }.prefix(maxLinks))
    }

    // MARK: - Helpers

    /// Port of the web `titleFromUrl`: the last slug-like path segment, else the domain.
    public static func titleFromURL(_ raw: String) -> String {
        guard let u = URL(string: raw) else { return raw }
        let host = u.host() ?? raw
        let domain = host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
        let segments = u.pathComponents.filter { $0 != "/" }
            .map { ($0.removingPercentEncoding ?? $0).replacingOccurrences(of: #"\.(html?|php|aspx?)$"#, with: "", options: [.regularExpression, .caseInsensitive]) }
            .filter { $0.range(of: "[a-z]{3}", options: [.regularExpression, .caseInsensitive]) != nil
                && $0.range(of: #"^[a-z]\d+$"#, options: [.regularExpression, .caseInsensitive]) == nil }
        guard let slug = segments.last else { return domain }
        let words = slug.replacingOccurrences(of: "[-_+]+", with: " ", options: .regularExpression)
            .split(separator: " ").joined(separator: " ")
        guard words.count >= 3 else { return domain }
        return words.prefix(1).uppercased() + words.dropFirst()
    }

    private static func first(_ re: NSRegularExpression, in s: String) -> String? {
        guard let m = re.firstMatch(in: s, range: NSRange(location: 0, length: (s as NSString).length)),
              m.range(at: 1).location != NSNotFound else { return nil }
        return (s as NSString).substring(with: m.range(at: 1))
    }

    private static func text(_ html: String) -> String {
        let stripped = tags.stringByReplacingMatches(in: html, range: NSRange(location: 0, length: (html as NSString).length), withTemplate: "")
        return decode(stripped).split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }

    private static let named = ["amp": "&", "lt": "<", "gt": ">", "quot": "\"", "apos": "'", "nbsp": " "]

    private static func decode(_ s: String) -> String {
        let ns = s as NSString
        var out = ""
        var last = 0
        for m in entity.matches(in: s, range: NSRange(location: 0, length: ns.length)) {
            out += ns.substring(with: NSRange(location: last, length: m.range.location - last))
            let body = ns.substring(with: m.range(at: 1))
            var rep = ns.substring(with: m.range)
            if body.hasPrefix("#") {
                let hex = body.dropFirst().lowercased().hasPrefix("x")
                let digits = hex ? String(body.dropFirst(2)) : String(body.dropFirst())
                if let code = UInt32(digits, radix: hex ? 16 : 10), let scalar = Unicode.Scalar(code) { rep = String(Character(scalar)) }
            } else if let n = named[body.lowercased()] {
                rep = n
            }
            out += rep
            last = m.range.location + m.range.length
        }
        out += ns.substring(from: last)
        return out
    }
}
