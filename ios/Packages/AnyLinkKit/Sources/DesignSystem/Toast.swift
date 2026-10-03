import SwiftUI

/// Ink capsule toast. State lives in `Store.ToastCenter`; the app overlays this view.
public struct ToastView: View {
    public let message: String
    public var onUndo: (() -> Void)?

    public init(_ message: String, onUndo: (() -> Void)? = nil) {
        self.message = message; self.onUndo = onUndo
    }

    public var body: some View {
        HStack(spacing: 8) {
            Text(message)
                .font(.subheadline)
                .foregroundStyle(AL.onInk)
                .lineLimit(2)
            Spacer(minLength: 0)
            if let onUndo {
                Button("Undo", action: onUndo)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(AL.toastAction)
                    .padding(.horizontal, 12)
                    .frame(minHeight: 36)
            }
        }
        .padding(.init(top: 8, leading: 20, bottom: 8, trailing: onUndo != nil ? 8 : 20))
        .frame(minHeight: 52)
        .background(AL.ink, in: Capsule())
        .alShadow(AL.Shadow.popover)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isStaticText)
    }
}

#Preview("Toast") {
    VStack(spacing: 12) {
        Spacer()
        ToastView("Moved to Reading")
        ToastView("Moved to Trash") {}
    }
    .padding(20)
    .background(AL.canvas)
}

#Preview("Toast — Dark") {
    VStack {
        Spacer()
        ToastView("3 links moved to Trash") {}
    }
    .padding(20)
    .background(AL.canvas)
    .preferredColorScheme(.dark)
}
