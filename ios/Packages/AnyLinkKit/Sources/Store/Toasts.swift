import Foundation
import Observation

public struct ToastItem: Identifiable {
    public let id = UUID()
    public let message: String
    public let undo: (@MainActor () -> Void)?

    public init(_ message: String, undo: (@MainActor () -> Void)? = nil) {
        self.message = message; self.undo = undo
    }
}

/// One toast at a time; a new one replaces the old. Auto-hides after 5 s.
@MainActor @Observable
public final class ToastCenter {
    public private(set) var current: ToastItem?
    @ObservationIgnored private var hideTask: Task<Void, Never>?

    public init() {}

    public func show(_ message: String, undo: (@MainActor () -> Void)? = nil) {
        hideTask?.cancel()
        let item = ToastItem(message, undo: undo)
        current = item
        hideTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(5))
            guard !Task.isCancelled, self?.current?.id == item.id else { return }
            self?.current = nil
        }
    }

    public func dismiss() {
        hideTask?.cancel()
        current = nil
    }

    /// Runs the current toast's Undo once and hides it.
    public func performUndo() {
        let undo = current?.undo
        dismiss()
        undo?()
    }
}

/// Holds the last undoable action: drives the toast's Undo button and the window's UndoManager (shake to undo).
@MainActor
public final class UndoCenter {
    let toasts: ToastCenter
    public weak var undoManager: UndoManager?

    public init(toasts: ToastCenter) { self.toasts = toasts }

    public func register(_ label: String, undo: @escaping @MainActor () -> Void) {
        var done = false
        let once: @MainActor () -> Void = { [weak self] in
            guard !done else { return }
            done = true
            if let self { self.undoManager?.removeAllActions(withTarget: self) }
            undo()
        }
        toasts.show(label, undo: once)
        undoManager?.removeAllActions(withTarget: self)
        undoManager?.registerUndo(withTarget: self) { _ in MainActor.assumeIsolated { once() } }
        undoManager?.setActionName(label)
    }
}
