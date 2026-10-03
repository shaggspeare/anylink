import SwiftUI

// MARK: - ToastItem

public struct ToastItem: Identifiable, Sendable {
    public let id = UUID()
    public let message: String
    public let undoAction: (@Sendable () -> Void)?

    public init(_ message: String, undo: (@Sendable () -> Void)? = nil) {
        self.message = message; self.undoAction = undo
    }
}

// MARK: - ToastCenter

@MainActor
@Observable
public final class ToastCenter {
    public var current: ToastItem?
    private var dismissTask: Task<Void, Never>?

    public init() {}

    public func show(_ message: String, undo: (@Sendable () -> Void)? = nil) {
        dismissTask?.cancel()
        current = ToastItem(message, undo: undo)
        dismissTask = Task {
            try? await Task.sleep(for: .seconds(5))
            guard !Task.isCancelled else { return }
            current = nil
        }
    }

    public func dismiss() {
        dismissTask?.cancel()
        current = nil
    }
}

// MARK: - ToastView

public struct ToastView: View {
    public let item: ToastItem
    public var onUndo: (() -> Void)?

    public init(item: ToastItem, onUndo: (() -> Void)? = nil) {
        self.item = item; self.onUndo = onUndo
    }

    public var body: some View {
        HStack(spacing: 8) {
            Text(item.message)
                .font(.system(size: 14))
                .foregroundStyle(AL.onInk)
                .lineLimit(2)
            Spacer(minLength: 0)
            if item.undoAction != nil {
                Button("Undo") {
                    onUndo?()
                    item.undoAction?()
                }
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(AL.signal)
                .frame(height: 36)
            }
        }
        .padding(.init(top: 8, leading: 20, bottom: 8, trailing: item.undoAction != nil ? 8 : 20))
        .frame(minHeight: 52)
        .background(AL.ink, in: Capsule())
        .alShadow(AL.Shadow.popover)
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }
}

// MARK: - ToastOverlay (convenience modifier)

public struct ToastOverlay: ViewModifier {
    @Bindable var center: ToastCenter
    var bottomOffset: CGFloat = 158

    public func body(content: Content) -> some View {
        content.overlay(alignment: .bottom) {
            if let item = center.current {
                ToastView(item: item) { center.dismiss() }
                    .padding(.horizontal, 20)
                    .offset(y: -bottomOffset)
                    .animation(AL.Motion.settle, value: center.current?.id)
            }
        }
    }
}

extension View {
    public func toastOverlay(_ center: ToastCenter, bottomOffset: CGFloat = 158) -> some View {
        modifier(ToastOverlay(center: center, bottomOffset: bottomOffset))
    }
}

// MARK: - Previews

#Preview("Toast") {
    VStack {
        Spacer()
        ToastView(item: ToastItem("Moved to Reading"))
            .padding(.horizontal, 20)
        ToastView(item: ToastItem("Moved to Trash", undo: {}))
            .padding(.horizontal, 20)
    }
    .padding(.bottom, 40)
    .background(AL.canvas)
}

#Preview("Toast — Dark") {
    VStack {
        Spacer()
        ToastView(item: ToastItem("3 links trashed", undo: {}))
            .padding(.horizontal, 20)
    }
    .padding(.bottom, 40)
    .background(AL.canvas)
    .preferredColorScheme(.dark)
}
