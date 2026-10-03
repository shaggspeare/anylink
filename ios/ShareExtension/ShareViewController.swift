import UIKit
import SwiftUI
import UniformTypeIdentifiers
import DesignSystem
import Models
import Networking
import Persistence
import Store

/// Hosts `ShareView`. Saves on appear; Done closes. Memory: no image decoding (identity fallback thumb only).
final class ShareViewController: UIViewController {
    private static let group = "group.app.anylink.ios"

    override func viewDidLoad() {
        super.viewDidLoad()
        AL.registerFonts()
        let base = (Bundle.main.object(forInfoDictionaryKey: "AnyLinkAPIBase") as? String)
            .flatMap(URL.init(string:)).flatMap { $0.host() == nil ? nil : $0 }
        let token = Bundle.main.object(forInfoDictionaryKey: "AnyLinkAPIToken") as? String
        // BACKEND: a per-user token in the shared keychain replaces the build-time shared token.
        let api: (any AnyLinkAPI)? = base.flatMap { b in token.flatMap { $0.isEmpty ? nil : $0 }.map { t in LiveAPI(base: b) { t } } }
        let signedIn = UserDefaults(suiteName: Self.group)?.bool(forKey: "signedIn") ?? false
        let session = ShareSession(api: api, cache: LocalCache.appGroup(Self.group), signedIn: signedIn)

        let host = UIHostingController(rootView: ShareView(session: session) { [weak self] in
            self?.extensionContext?.completeRequest(returningItems: nil)
        })
        addChild(host)
        host.view.frame = view.bounds
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        host.view.backgroundColor = .clear
        view.addSubview(host.view)
        host.didMove(toParent: self)

        Task { @MainActor in
            let (url, title) = await self.sharedLink()
            await session.start(url: url, title: title)
        }
    }

    /// A URL item, or the first http(s) link in shared text. Title from the item's attributed text.
    private func sharedLink() async -> (URL?, String?) {
        let items = extensionContext?.inputItems.compactMap { $0 as? NSExtensionItem } ?? []
        let title = items.first?.attributedContentText?.string
        for provider in items.flatMap({ $0.attachments ?? [] }) {
            if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier),
               let url = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL,
               url.scheme?.hasPrefix("http") == true {
                return (url, title)
            }
            if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
               let text = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String,
               let url = PasteAccessory.firstWebURL(in: text) {
                return (url, title)
            }
        }
        return (nil, title)
    }
}
