import Foundation
import Models

/// The saved images, read from the App Group by processes that aren't the app: the Memes widget's intent, the
/// keyboard, Siri. Whichever library the app last showed — the server one from its cache, or the local one.
@MainActor
public enum ImageLibrary {
    /// Set by the app: true while it shows an account's server library (RootView).
    public static var showsServerLibrary: Bool {
        UserDefaults(suiteName: LocalImages.group)?.bool(forKey: "serverLibrary") ?? false
    }

    /// Live (not trashed or archived) images, newest first.
    public static func links() -> [LinkItem] {
        let all: [LinkItem] = showsServerLibrary
            ? LocalCache.appGroup()?.loadSnapshot()?.links ?? []
            : LocalStore.appGroupReader()?.links() ?? []
        return newestFirst(all)
    }

    nonisolated public static func newestFirst(_ links: [LinkItem]) -> [LinkItem] {
        links.filter { $0.isImage && $0.deleted != true && $0.archived != true }
            .sorted { $0.createdAt > $1.createdAt }
    }

    /// Images whose title, words, tags or note contain every word of `query`. An empty query is every image.
    nonisolated public static func matching(_ query: String, in links: [LinkItem]) -> [LinkItem] {
        let words = query.lowercased().split(whereSeparator: \.isWhitespace).map(String.init)
        guard !words.isEmpty else { return links }
        return links.filter { l in
            let hay = [l.title, l.excerpt, l.note ?? "", l.tags.joined(separator: " ")].joined(separator: "\n").lowercased()
            return words.allSatisfy { hay.contains($0) }
        }
    }

    /// The image's bytes: this device's file, the local library's copy, or the uploaded original (a GIF stays a GIF).
    public static func data(for link: LinkItem) async -> Data? {
        if let file = LocalImages.existing(for: link.id), let data = try? Data(contentsOf: file) { return data }
        if !showsServerLibrary, let data = LocalStore.appGroupReader()?.image(for: link.id) { return data }
        guard let url = URL(string: link.url.isEmpty ? link.heroImage ?? "" : link.url), url.scheme?.hasPrefix("http") == true else { return nil }
        return try? await URLSession.shared.data(from: url).0
    }
}
