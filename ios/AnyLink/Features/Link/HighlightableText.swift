import SwiftUI
import UIKit
import DesignSystem

/// Article text in a selectable UITextView, so the edit menu can offer **Highlight**. 17 pt Instrument Sans,
/// line height 1.65, paragraph spacing 22, ink .85; saved highlights get a lime .60 background.
struct HighlightableText: UIViewRepresentable {
    let blocks: [String]
    let highlights: [String]
    @Binding var selection: String
    let onHighlight: (String) -> Void

    func makeUIView(context: Context) -> UITextView {
        let v = UITextView(usingTextLayoutManager: true)
        v.isEditable = false
        v.isSelectable = true
        v.isScrollEnabled = false
        v.backgroundColor = .clear
        v.textContainerInset = .zero
        v.textContainer.lineFragmentPadding = 0
        v.adjustsFontForContentSizeCategory = true
        v.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        v.delegate = context.coordinator
        v.attributedText = attributed()
        return v
    }

    func updateUIView(_ v: UITextView, context: Context) {
        context.coordinator.parent = self
        let key = blocks.joined() + "\u{1}" + highlights.joined(separator: "\u{2}")
        if context.coordinator.renderedKey != key {
            context.coordinator.renderedKey = key
            v.attributedText = attributed()
        }
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UITextView, context: Context) -> CGSize? {
        guard let w = proposal.width, w.isFinite, w > 0 else { return nil }
        return CGSize(width: w, height: ceil(uiView.sizeThatFits(CGSize(width: w, height: .greatestFiniteMagnitude)).height))
    }

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    private func attributed() -> NSAttributedString {
        let base = UIFont(name: "InstrumentSans-Regular", size: 17) ?? .systemFont(ofSize: 17)
        let font = UIFontMetrics(forTextStyle: .body).scaledFont(for: base)
        let para = NSMutableParagraphStyle()
        para.lineSpacing = 17 * 0.65
        para.paragraphSpacing = 22
        let ink = UIColor { UIColor(AL.ink).resolvedColor(with: $0).withAlphaComponent(0.85) }
        let text = NSMutableAttributedString(
            string: blocks.joined(separator: "\n"),
            attributes: [.font: font, .paragraphStyle: para, .foregroundColor: ink]
        )
        let ns = text.string as NSString
        let lime = UIColor(AL.lime).withAlphaComponent(0.6)
        for quote in highlights where !quote.isEmpty {
            let r = ns.range(of: quote)
            if r.location != NSNotFound { text.addAttribute(.backgroundColor, value: lime, range: r) }
        }
        return text
    }

    @MainActor
    final class Coordinator: NSObject, UITextViewDelegate {
        var parent: HighlightableText
        var renderedKey = ""

        init(parent: HighlightableText) { self.parent = parent }

        private func selected(in tv: UITextView) -> String {
            guard tv.selectedRange.length > 0 else { return "" }
            return (tv.text as NSString).substring(with: tv.selectedRange).trimmingCharacters(in: .whitespacesAndNewlines)
        }

        func textViewDidChangeSelection(_ tv: UITextView) {
            let text = selected(in: tv)
            Task { @MainActor in self.parent.selection = text }
        }

        func textView(_ tv: UITextView, editMenuForTextIn range: NSRange, suggestedActions: [UIMenuElement]) -> UIMenu? {
            let quote = selected(in: tv)
            guard !quote.isEmpty else { return UIMenu(children: suggestedActions) }
            let highlight = UIAction(title: "Highlight", image: UIImage(systemName: "highlighter")) { [weak self, weak tv] _ in
                self?.parent.onHighlight(quote)
                tv?.selectedRange = NSRange(location: 0, length: 0)
            }
            return UIMenu(children: [highlight] + suggestedActions)
        }
    }
}
