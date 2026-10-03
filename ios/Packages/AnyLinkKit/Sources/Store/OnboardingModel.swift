import Foundation
import Observation
import Models

/// S2–S5: import → clean → keep or bin → two questions → grouping → result.
@MainActor @Observable
public final class OnboardingModel {
    public enum Step: Int, Comparable, Sendable {
        case importFiles, clean, keepOrBin, focus, avoid, grouping, result
        public static func < (a: Step, b: Step) -> Bool { a.rawValue < b.rawValue }
        /// The 4-step indicator: import · clean · keep-or-bin (+ questions) · collections.
        public var indicator: Int {
            switch self {
            case .importFiles: 0
            case .clean: 1
            case .keepOrBin, .focus, .avoid: 2
            case .grouping, .result: 3
            }
        }
    }

    public enum Source: Sendable { case bookmarks, telegram }
    public struct ChosenFile: Equatable, Sendable { public let name: String; public let items: [ImportItem] }
    public enum DeadGroup: CaseIterable, Sendable { case gone, parked, noAnswer }

    public var step: Step = .importFiles
    @ObservationIgnored let store: LibraryStore

    public init(store: LibraryStore, step: Step = .importFiles) {
        self.store = store
        self.step = step
    }

    // MARK: - Import (S2)

    public private(set) var files: [Source: ChosenFile] = [:]
    public private(set) var fileErrors: [Source: String] = [:]
    public private(set) var importError: String?
    public private(set) var isImporting = false

    public func load(_ data: Data, named name: String, as source: Source) {
        do {
            files[source] = ChosenFile(name: name, items: try ImportParsers.parse(fileName: name, data: data))
            fileErrors[source] = nil
        } catch ImportParsers.Failure.empty {
            fileErrors[source] = "No links in that file. A Chrome bookmarks export or a Telegram result.json both work."
        } catch {
            fileErrors[source] = "Couldn't read that file — is it the export itself, rather than a zip of it?"
        }
    }

    public func remove(_ source: Source) { files[source] = nil }

    /// Bookmarks first, so a URL in both keeps its folder.
    public var merged: [ImportItem] {
        ImportParsers.merge([files[.bookmarks]?.items ?? [], files[.telegram]?.items ?? []])
    }

    public func runImport() async {
        guard !merged.isEmpty, !isImporting else { return }
        isImporting = true
        defer { isImporting = false }
        do {
            _ = try await store.api.importLinks(merged)
            importError = nil
            await store.refresh()
            step = .clean
        } catch {
            importError = "The import didn't go through. Nothing was saved — try again."
        }
    }

    // MARK: - Clean (S3)

    public private(set) var checked = 0
    public private(set) var total = 0
    public private(set) var isChecking = false
    public private(set) var checkDone = false
    public private(set) var dead: [LinkCheckEvent.DeadLink] = []
    public var selectedGroups: Set<DeadGroup> = [.gone, .parked]

    public static func group(for status: Int) -> DeadGroup {
        switch status {
        case 1: .parked
        case 0: .noAnswer
        default: .gone
        }
    }

    public func links(in group: DeadGroup) -> [LinkCheckEvent.DeadLink] { dead.filter { Self.group(for: $0.status) == group } }
    public var trashCount: Int { selectedGroups.reduce(0) { $0 + links(in: $1).count } }

    /// Repeats `checkImportedLinks` while the server reports `remaining > 0`. Resumable: call again after a relaunch.
    public func runCheck() async {
        guard !isChecking else { return }
        isChecking = true
        defer { isChecking = false }
        var base = 0
        var remaining = 1
        while remaining > 0, !Task.isCancelled {
            remaining = 0
            var sawDone = false
            do {
                for try await e in await store.api.checkImportedLinks() {
                    switch e.type {
                    case "start": total = base + (e.total ?? 0)
                    case "progress": checked = base + (e.checked ?? checked - base)
                    case "done":
                        sawDone = true
                        checked = base + (e.checked ?? 0)
                        dead += e.dead ?? []
                        remaining = e.remaining ?? 0
                        base = checked
                        total = max(total, checked + remaining)
                    default: break
                    }
                }
            } catch {}
            if !sawDone { break }
        }
        checkDone = true
        await store.refresh()
    }

    /// "Move {n} to Trash" (or Continue when 0).
    public func trashSelectedAndContinue() {
        let ids = selectedGroups.flatMap { links(in: $0).map(\.id) }
        if !ids.isEmpty { store.trash(Set(ids)) }
        prepareSample()
        step = .keepOrBin
    }

    public func keepAllAndContinue() {
        prepareSample()
        step = .keepOrBin
    }

    // MARK: - Keep or bin (S4)

    public private(set) var sample: [LinkItem] = []
    public private(set) var kept: [LinkItem] = []
    public private(set) var binned: [LinkItem] = []
    public static let sampleSize = 8

    /// Imported, alive inbox links, round-robin across domains.
    public func prepareSample() {
        let inbox = store.inboxID
        let pool = store.live.filter { $0.collectionId == inbox && $0.importMeta != nil && !$0.isBroken }
        var byDomain: [(String, [LinkItem])] = []
        for l in pool {
            if let i = byDomain.firstIndex(where: { $0.0 == l.domain }) { byDomain[i].1.append(l) } else { byDomain.append((l.domain, [l])) }
        }
        var out: [LinkItem] = []
        var round = 0
        while out.count < Self.sampleSize, byDomain.contains(where: { $0.1.count > round }) {
            for (_, links) in byDomain where links.count > round && out.count < Self.sampleSize { out.append(links[round]) }
            round += 1
        }
        sample = out
        kept = []; binned = []
    }

    public var sampleIndex: Int { kept.count + binned.count }
    public var remainingSample: [LinkItem] { Array(sample.dropFirst(sampleIndex)) }

    public func keep(_ link: LinkItem) {
        kept.append(link)
        store.signals.log("keep", linkIds: [link.id])
        if remainingSample.isEmpty { step = .focus }
    }

    public func bin(_ link: LinkItem) {
        binned.append(link)
        store.signals.log("kill", linkIds: [link.id])
        store.trash([link.id], announce: false)
        if remainingSample.isEmpty { step = .focus }
    }

    // MARK: - Questions

    public var focus = ""
    public var avoid = ""
    public private(set) var topics: [String] = []

    /// Folder names and top domains from what was imported. Max 8.
    public var suggestionChips: [String] {
        let imported = store.live.filter { $0.importMeta != nil }
        var counts: [String: Int] = [:]
        for l in imported {
            if let f = l.importMeta?.folder?.split(separator: "/").last?.trimmingCharacters(in: .whitespaces), !f.isEmpty { counts[f, default: 0] += 3 }
            counts[l.domain, default: 0] += 1
        }
        return counts.sorted { ($0.value, $1.key) > ($1.value, $0.key) }.prefix(8).map(\.key)
    }

    public func pick(_ chip: String, forAvoid: Bool = false) {
        if forAvoid {
            avoid = avoid.isEmpty ? chip : avoid + ", " + chip
        } else {
            if !topics.contains(chip) { topics.append(chip) }
            focus = focus.isEmpty ? chip : focus + ", " + chip
        }
    }

    // MARK: - Grouping and result (S5)

    public private(set) var results: [GroupedResult] = []
    public private(set) var groupError: String?
    public var binnedCollections: Set<LinkCollection.ID> = []

    public func buildCollections() async {
        step = .grouping
        do {
            let priorities = GroupingPriorities(focus: focus, topics: topics, kept: kept.map(\.title), killed: binned.map(\.title), avoid: avoid)
            results = try await store.api.groupInbox(priorities)
            groupError = nil
            await store.refresh()
            step = .result
        } catch {
            groupError = "That didn't go through. Try again."
            step = .avoid
        }
    }

    public var keptCount: Int { results.count - binnedCollections.count }
    public var linksBackToUnsorted: Int { results.filter { binnedCollections.contains($0.collection.id) }.reduce(0) { $0 + $1.linkIds.count } }

    public func toggleBin(_ id: LinkCollection.ID) {
        if binnedCollections.contains(id) { binnedCollections.remove(id) } else { binnedCollections.insert(id) }
    }

    /// "Open my library": binned collections send their links back to Unsorted and are deleted; each choice logs a signal.
    public func finish() {
        for r in results {
            let binned = binnedCollections.contains(r.collection.id)
            store.signals.log(binned ? "kill" : "keep", collectionId: r.collection.id)
            if binned { store.dissolve(r.collection.id) }
        }
    }
}
