import Foundation
import Models
import Networking
import Persistence

/// The upgrade and the lapse (CONTEXT.md, ADR 0002): a library moving between this device and the server when the plan
/// changes. Neither deletes anything. The app switches library once a move finishes (`RootView`).
@MainActor
public enum LibraryMove {
    /// Links per `uploadLibrary` call: the server takes 200.
    static let batchSize = 200
    /// Request bodies stay well under the host's 4.5 MB.
    static let batchBytes = 3_000_000

    /// The upgrade: uploads the local library into the account's server library, every collection with each batch. An
    /// image goes on its own, with its JPEG. What reached the server is kept per account in `defaults`, so a run that's
    /// killed or fails carries on where it stopped, and the server merges what it has already, so nothing doubles either
    /// way. The local store is only read: it stays as a backup.
    public static func upgrade(_ local: LocalStore, account: String, defaults: UserDefaults = .standard,
                               send: (LibraryUpload) async throws -> Void,
                               progress: (_ done: Int, _ total: Int) -> Void = { _, _ in }) async throws {
        let key = progressKey(account)
        var uploaded = Set(defaults.stringArray(forKey: key) ?? [])
        let collections = local.collections()
        let all = local.links().sorted { ($0.createdAt, $0.id) < ($1.createdAt, $1.id) }
        let todo = all.filter { !uploaded.contains($0.id) }
        progress(all.count - todo.count, all.count)
        // Collections with nothing in them come along too.
        if all.isEmpty, !collections.isEmpty { try await send(LibraryUpload(collections: collections, links: [])) }
        var next = 0
        while next < todo.count {
            var batch: [LibraryUpload.Link] = []
            var bytes = 0
            while next < todo.count, batch.count < batchSize {
                let (link, size) = payload(todo[next], local)
                if !batch.isEmpty, link.image != nil || batch[0].image != nil || bytes + size > batchBytes { break }
                batch.append(link)
                bytes += size
                next += 1
            }
            try await send(LibraryUpload(collections: [LocalAPI.inbox] + collections, links: batch))
            uploaded.formUnion(batch.map(\.item.id))
            defaults.set(Array(uploaded), forKey: key)
            progress(all.count - todo.count + next, all.count)
        }
    }

    /// The lapse: copies the server library into the local one (`LibraryRules.union`, the server's copy winning a
    /// match), deleting nothing, so this device keeps everything when the app falls back to a local library. Forgets
    /// which records the last upgrade sent, so going Pro again sends everything and the server merges it.
    // ponytail: an image saved on the web comes down as its stored URL, not its bytes; download them into the local store
    // if they need to open offline or outlive the web copy.
    public static func lapse(_ server: LibrarySnapshot, into local: LocalStore, account: String, defaults: UserDefaults = .standard) {
        let theirs = server.links + server.trashed.map { var l = $0; l.deleted = true; return l }
        let (links, collections) = LibraryRules.union(theirs, collections: server.collections, into: local.links(),
                                                      collections: local.collections(), inbox: LocalAPI.inbox.id, theirsWin: true)
        local.save(collections)
        local.save(links)
        forget(account, defaults: defaults)
    }

    /// Drops the record of what `account`'s last upgrade sent: the next one sends everything.
    public static func forget(_ account: String, defaults: UserDefaults = .standard) {
        defaults.removeObject(forKey: progressKey(account))
    }

    static func progressKey(_ account: String) -> String { "upgrade.\(account)" }

    /// A link as it goes up, and about how many bytes it adds to the request. A picture too big for one request is sent
    /// smaller, and an article too long for one goes without its text, which the server can read again.
    static func payload(_ link: LinkItem, _ local: LocalStore) -> (LibraryUpload.Link, Int) {
        var image = link.isImage ? local.image(for: link.id) : nil
        if let data = image, data.count > batchBytes * 3 / 4 { image = LocalImages.prepare(data, maxPixels: 1600) ?? data }
        var item = link
        var size = (try? JSONEncoder().encode(item).count) ?? 0
        if size > batchBytes {
            item.articleText = nil
            size = (try? JSONEncoder().encode(item).count) ?? 0
        }
        return (LibraryUpload.Link(item: item, image: image), size + (image?.count ?? 0) * 4 / 3)
    }
}
