import SwiftUI
import UIKit
import DesignSystem

/// Hosts `MemeKeyboardView`. The keyboard is a grid of saved images; a tap copies one for the reply box above.
/// Needs Full Access: without it a keyboard can't reach the App Group or the clipboard.
final class KeyboardViewController: UIInputViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        AL.registerFonts()
        let host = UIHostingController(rootView: MemeKeyboardView(
            hasFullAccess: hasFullAccess,
            nextKeyboard: { [weak self] in self?.advanceToNextInputMode() },
            deleteBackward: { [weak self] in self?.textDocumentProxy.deleteBackward() }
        ))
        addChild(host)
        host.view.translatesAutoresizingMaskIntoConstraints = false
        host.view.backgroundColor = .clear
        view.addSubview(host.view)
        host.didMove(toParent: self)
        NSLayoutConstraint.activate([
            host.view.topAnchor.constraint(equalTo: view.topAnchor),
            host.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            // ponytail: one height for every phone; a system keyboard's is a shade shorter on small ones.
            view.heightAnchor.constraint(equalToConstant: 272).withPriority(.defaultHigh),
        ])
    }
}

private extension NSLayoutConstraint {
    func withPriority(_ p: UILayoutPriority) -> NSLayoutConstraint { priority = p; return self }
}
