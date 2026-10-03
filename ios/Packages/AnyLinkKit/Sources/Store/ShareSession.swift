import Foundation
import Observation
import Models
import Networking
import Persistence

/// S9: the share extension. Saves at once (principle 1); edits afterwards are optional. No LibraryStore here.
@MainActor @Observable
public final class ShareSession {
    public enum Mode: Equatable, Sendable {
        case saving
        case saved            // on the server
        case pending          // waiting in the App Group for the app or the network
        case signedOut
        case noLink
    }

    public private(set) var mode: Mode = .saving
    public private(set) var url: URL?
    public private(set) var title: String?
    public private(set) var saved: LinkItem?
    public private(set) var collection: LinkCollection?
    public private(set) var crawlDone = false
    public let recent: [LinkCollection]

    @ObservationIgnored let api: (any AnyLinkAPI)?
    @ObservationIgnored let cache: LocalCache?
    @ObservationIgnored let signedIn: Bool
    @ObservationIgnored private var pending: PendingSave?
    @ObservationIgnored private var crawlTask: Task<Void, Never>?

    /// `api` is nil when no backend is configured (Mock builds): everything goes through a PendingSave.
    public init(api: (any AnyLinkAPI)?, cache: LocalCache?, signedIn: Bool) {
        self.api = api
        self.cache = cache
        self.signedIn = signedIn
        recent = Array((cache?.recentCollections() ?? []).prefix(4))
    }

    public var domain: String? {
        saved?.domain ?? url?.host().map { $0.hasPrefix("www.") ? String($0.dropFirst(4)) : $0 }
    }

    public var headline: String { "Saved to \(collection?.name ?? "Unsorted")" }

    public func start(url: URL?, title: String?) async {
        guard signedIn else { mode = .signedOut; return }
        guard let url else { mode = .noLink; return }
        self.url = url
        self.title = title?.isEmpty == false ? title : nil
        guard let api else { savePending(); return }
        do {
            saved = try await api.createLink(LinkDraft(url: url.absoluteString, title: self.title))
            mode = .saved
            crawlTask = Task { [weak self] in
                // Drives the status line only; the server or the app finishes enrichment (`05` § Gaps).
                do {
                    for try await e in await api.crawl(url) {
                        if case .done = e { self?.crawlDone = true }
                        if case .failed = e { self?.crawlDone = true }
                    }
                } catch {}
            }
        } catch {
            savePending()
        }
    }

    private func savePending() {
        guard let url else { return }
        let p = PendingSave(url: url.absoluteString, title: title, collectionId: collection?.id)
        pending = p
        cache?.upsertPendingSave(p)
        mode = .pending
    }

    public func move(to c: LinkCollection) async {
        collection = c
        if let saved, let api {
            try? await api.bulk(.move(to: c.id), ids: [saved.id])
        } else if var p = pending {
            p.collectionId = c.id
            pending = p
            cache?.upsertPendingSave(p)
        }
    }

    /// Done: stop listening, keep the note.
    public func finish(note: String) async {
        crawlTask?.cancel()
        let note = note.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !note.isEmpty else { return }
        if let saved, let api {
            try? await api.updateLink(saved.id, LinkPatch(note: note))
        } else if var p = pending {
            p.note = note
            cache?.upsertPendingSave(p)
        }
    }
}

extension LibraryStore {
    /// Saves what the share extension left in the App Group, oldest first, then clears them.
    public func drainPendingSaves(from cache: LocalCache) async {
        for p in cache.pendingSaves().sorted(by: { $0.createdAt < $1.createdAt }) {
            let draft = LinkDraft(url: p.url, title: p.title, collectionId: p.collectionId, note: p.note)
            if await save(draft) != nil { cache.removePendingSaves([p.id]) } else { break }
        }
    }

    /// The four collections used most recently, for the extension's "Move to" chips.
    public var recentCollections: [LinkCollection] {
        let latest = Dictionary(grouping: live, by: \.collectionId).mapValues { $0.map(\.createdAt).max() ?? "" }
        return userCollections.sorted { (latest[$0.id] ?? "") > (latest[$1.id] ?? "") }.prefix(4).map { $0 }
    }
}
