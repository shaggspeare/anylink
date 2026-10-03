import SwiftUI
import DesignSystem
import Store

extension View {
    /// Shows `ToastCenter.current` above the tab bar. 158 pt clears tab bar + accessory; 100 otherwise.
    func toastOverlay(_ center: ToastCenter, bottomOffset: CGFloat = 158) -> some View {
        overlay(alignment: .bottom) {
            ZStack {
                if let item = center.current {
                    ToastView(item.message, onUndo: item.undo.map { _ in { center.performUndo() } })
                        .padding(.horizontal, 16)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                        .id(item.id)
                }
            }
            .padding(.bottom, bottomOffset)
            .animation(AL.Motion.sheet, value: center.current?.id)
        }
    }
}
