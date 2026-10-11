import Foundation
import Compression
import Models

/// Export-file and pasted-text readers, ported from the web app's `src/lib/import/parse.ts` so both clients agree.
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

    // MARK: - Plain text and WhatsApp (links pulled out of prose)

    private static let detector = try! NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)

    /// Every http(s) or www. link in one message or line, with the words around it as context. Bare `example.com`
    /// stays prose: in a chat export that's mostly file names like IMG-0001.jpg.
    private static func links(in chunk: String, source: String, savedAt: String?, seen: inout Set<String>, into out: inout [ImportItem]) {
        let ns = chunk as NSString
        var urls: [String] = []
        var context = ""
        var last = 0
        for m in detector.matches(in: chunk, range: NSRange(location: 0, length: ns.length)) {
            let raw = ns.substring(with: m.range)
            let lower = raw.lowercased()
            let url = lower.hasPrefix("www.") ? "https://" + raw : raw
            guard lower.hasPrefix("http://") || lower.hasPrefix("https://") || lower.hasPrefix("www."), isHTTP(url) else { continue }
            context += ns.substring(with: NSRange(location: last, length: m.range.location - last))
            last = m.range.location + m.range.length
            urls.append(url)
        }
        guard !urls.isEmpty else { return }
        context = String((context + ns.substring(from: last)).split(whereSeparator: \.isWhitespace).joined(separator: " ").prefix(500))
        let firstSentence = context.split(whereSeparator: { ".!?\n".contains($0) }).first
            .map { String($0.trimmingCharacters(in: .whitespaces).prefix(120)) } ?? ""
        for url in urls where out.count < maxLinks && seen.insert(url).inserted {
            out.append(ImportItem(
                url: url,
                title: firstSentence.isEmpty ? titleFromURL(url) : firstSentence,
                source: source,
                meta: ImportMeta(savedAt: savedAt, context: context.isEmpty ? nil : context)
            ))
        }
    }

    /// Any text with links in it — a note, an email, a list. Each line is its own context.
    public static func plainText(_ text: String) -> [ImportItem] {
        var seen = Set<String>()
        var out: [ImportItem] = []
        for line in text.split(omittingEmptySubsequences: true, whereSeparator: \.isNewline) {
            links(in: String(line), source: "text", savedAt: nil, seen: &seen, into: &out)
        }
        return out
    }

    /// "[15/03/2024, 14:23:05] Ann: hi" (iPhone) or "15/03/2024, 14:23 - Ann: hi" (Android). Day/month order,
    /// separators, 12/24-hour and seconds all follow the phone's region.
    private static let whatsAppLine = try! NSRegularExpression(
        pattern: #"^\[?(\d{1,4})[./-](\d{1,2})[./-](\d{1,4}),?\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*([ap])?\.?\s?(?:m\.?)?\]?\s*(?:-\s)?\s*(.*)$"#,
        options: [.caseInsensitive])

    /// Strips the invisible marks iOS sprinkles through the export, and the narrow no-break space before AM/PM.
    private static func cleanWhatsApp(_ line: Substring) -> String {
        String(line.unicodeScalars.filter { !["\u{200E}", "\u{200F}", "\u{FEFF}"].contains($0) }
            .map { $0 == "\u{202F}" || $0 == "\u{00A0}" ? " " : Character($0) })
    }

    private static func whatsAppHeader(_ line: String) -> [String?]? {
        let ns = line as NSString
        guard let m = whatsAppLine.firstMatch(in: line, range: NSRange(location: 0, length: ns.length)) else { return nil }
        return (1...8).map { m.range(at: $0).location == NSNotFound ? nil : ns.substring(with: m.range(at: $0)) }
    }

    public static func looksLikeWhatsApp(_ text: String) -> Bool {
        guard let first = text.split(whereSeparator: \.isNewline).map(cleanWhatsApp)
            .first(where: { !$0.trimmingCharacters(in: .whitespaces).isEmpty }) else { return false }
        return whatsAppHeader(first) != nil
    }

    /// A WhatsApp "Export Chat" transcript (_chat.txt). A message runs from its timestamp line to the next one;
    /// the sender's name is dropped, the rest is context.
    public static func whatsApp(_ text: String) -> [ImportItem] {
        var messages: [(parts: [String?], lines: [String])] = []
        for raw in text.split(omittingEmptySubsequences: false, whereSeparator: \.isNewline) {
            let line = cleanWhatsApp(raw)
            if let h = whatsAppHeader(line) {
                let body = h[7] ?? ""
                let message = body.range(of: ": ").map { String(body[$0.upperBound...]) } ?? body
                messages.append((Array(h[0..<7]), [message]))
            } else if !messages.isEmpty {
                messages[messages.count - 1].lines.append(line)
            }
        }

        // The file never says which number is the day, so ask the whole file: a first number over 12 means
        // day-first, a second one means month-first. Day-first otherwise.
        let num = { (s: String?) in Int(s ?? "") ?? 0 }
        let yearFirst = messages.contains { ($0.parts[0] ?? "").count == 4 }
        let monthFirst = !yearFirst && !messages.contains { num($0.parts[0]) > 12 } && messages.contains { num($0.parts[1]) > 12 }

        var seen = Set<String>()
        var out: [ImportItem] = []
        for (p, lines) in messages {
            let (y, mo, d) = yearFirst ? (p[0], p[1], p[2]) : monthFirst ? (p[2], p[0], p[1]) : (p[2], p[1], p[0])
            let ampm = p[6]?.lowercased()
            var hour = num(p[3]) % (ampm == nil ? 24 : 12)
            if ampm == "p" { hour += 12 }
            let year = num(y) < 100 ? 2000 + num(y) : num(y)
            let date = Calendar(identifier: .gregorian).date(from: DateComponents(
                year: year, month: num(mo), day: num(d), hour: hour, minute: num(p[4]), second: num(p[5])))
            links(in: lines.joined(separator: "\n"), source: "whatsapp", savedAt: date?.formatted(isoMillis), seen: &seen, into: &out)
            if out.count >= maxLinks { break }
        }
        return out
    }

    // MARK: - Zip (Safari and WhatsApp exports on iPhone)

    static func isZip(_ data: Data) -> Bool { data.starts(with: [0x50, 0x4B, 3, 4]) }

    /// Just enough zip for Safari's "Safari Export <date>.zip" and WhatsApp's "WhatsApp Chat - <name>.zip": stored and
    /// deflated entries, read through the central directory. ponytail: no zip64 or encryption — neither export uses them.
    static func unzip(_ data: Data, wanted: (String) -> Bool) throws -> [(name: String, data: Data)] {
        let b = [UInt8](data)
        func u16(_ i: Int) -> Int { i >= 0 && i + 2 <= b.count ? Int(b[i]) | Int(b[i + 1]) << 8 : 0 }
        func u32(_ i: Int) -> Int { u16(i) | u16(i + 2) << 16 }
        guard b.count >= 22, let eocd = stride(from: b.count - 22, through: max(0, b.count - 22 - 65535), by: -1)
            .first(where: { u32($0) == 0x06054b50 }) else { throw Failure.unreadable }

        var p = u32(eocd + 16)
        var out: [(name: String, data: Data)] = []
        for _ in 0..<u16(eocd + 10) {
            guard u32(p) == 0x02014b50 else { break }
            let flags = u16(p + 8), method = u16(p + 10), size = u32(p + 20), full = u32(p + 24), n = u16(p + 28), local = u32(p + 42)
            guard p + 46 + n <= b.count else { break }
            let name = String(decoding: b[(p + 46)..<(p + 46 + n)], as: UTF8.self)
            p += 46 + n + u16(p + 30) + u16(p + 32)
            // A size over 256 MB isn't a chat or a bookmarks file.
            guard flags & 1 == 0, method == 0 || method == 8, full <= 256 << 20, wanted(name) else { continue }
            let start = local + 30 + u16(local + 26) + u16(local + 28)
            guard start + size <= b.count else { throw Failure.unreadable }
            let raw = Array(b[start..<(start + size)])
            if method == 0 { out.append((name, Data(raw))); continue }
            var dst = [UInt8](repeating: 0, count: full)
            guard full == 0 || compression_decode_buffer(&dst, full, raw, size, nil, COMPRESSION_ZLIB) == full else { throw Failure.unreadable }
            out.append((name, Data(dst)))
        }
        return out
    }

    // MARK: - Dispatch and merge

    /// By what the file is: a zip is opened and every export-shaped file inside read, named "<zip>/<entry>" so
    /// "Safari Export 2026-01-13.zip/Bookmarks.html" reads as Safari. `.json` is Telegram, `.txt` WhatsApp when it looks
    /// like a chat and plain text otherwise, anything else bookmark HTML. Throws `.unreadable` or `.empty`.
    public static func parse(fileName: String, data: Data) throws -> [ImportItem] {
        if isZip(data) {
            // Safari's zip also holds History.json, passwords and cards — only bookmarks are read.
            let entries = try unzip(data) {
                $0.range(of: #"(^|/)(__MACOSX/|\._)"#, options: .regularExpression) == nil
                    && $0.range(of: #"\.(html?|txt)$|result\.json$"#, options: [.regularExpression, .caseInsensitive]) != nil
            }
            guard !entries.isEmpty else { throw Failure.unreadable }
            let items = merge(entries.map { (try? parse(fileName: fileName + "/" + $0.name, data: $0.data)) ?? [] })
            if items.isEmpty { throw Failure.empty }
            return items
        }
        let lower = fileName.lowercased()
        let items: [ImportItem]
        if lower.hasSuffix(".json") {
            items = try telegram(data)
        } else if lower.hasSuffix(".txt") {
            guard let text = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .isoLatin1) else { throw Failure.unreadable }
            items = lower.contains("whatsapp") || lower.hasSuffix("_chat.txt") || looksLikeWhatsApp(text) ? whatsApp(text) : plainText(text)
        } else {
            guard let html = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .isoLatin1),
                  html.range(of: "<a", options: .caseInsensitive) != nil || html.range(of: "<dl", options: .caseInsensitive) != nil
            else { throw Failure.unreadable }
            let source = lower.contains("safari") ? "safari"
                : lower.range(of: "telegram|messages", options: .regularExpression) != nil ? "telegram" : "chrome"
            items = bookmarks(html, source: source)
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
