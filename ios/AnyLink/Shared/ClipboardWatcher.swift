import UIKit
import Store

/// Detects (never reads) a web URL on the clipboard so the accessory can offer Paste without the paste alert.
@MainActor
final class ClipboardWatcher {
    static let settingKey = "clipboardSuggestions"
    private let store: LibraryStore
    private var lastChangeCount = -1

    init(store: LibraryStore) { self.store = store }

    /// Off under UI tests so the accessory is deterministic whatever the simulator clipboard holds.
    private var enabled: Bool {
        !AppConfig.isUITesting && (UserDefaults.standard.object(forKey: Self.settingKey) as? Bool ?? true)
    }

    func check() async {
        guard enabled else { store.clipboardHasURL = false; return }
        let pb = UIPasteboard.general
        guard pb.changeCount != lastChangeCount else { return }
        lastChangeCount = pb.changeCount
        let found = try? await pb.detectedPatterns(for: [\.probableWebURL])
        store.clipboardHasURL = found?.contains(\.probableWebURL) ?? false
    }

    /// Runs for the app's lifetime; the system only posts this while we're foreground.
    func observe() async {
        for await _ in NotificationCenter.default.notifications(named: UIPasteboard.changedNotification).map({ _ in () }) {
            await check()
        }
    }
}
