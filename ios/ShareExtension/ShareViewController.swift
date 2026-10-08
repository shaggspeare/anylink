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
        // The app's Supabase session, from the shared keychain. A guest (or a mock build) reads as signed out.
        let api: (any AnyLinkAPI)? = AuthService.client == nil ? nil : base.map { b in LiveAPI(base: b) { await AuthService.accessToken() } }
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
            await session.start(await self.sharedPayload())
        }
    }

    /// A URL item, or the first http(s) link in shared text; otherwise an image, otherwise the text as a note.
    /// Title from the item's attributed text. Links win: Safari shares a page as URL + text + preview image.
    private func sharedPayload() async -> ShareSession.Payload? {
        let items = extensionContext?.inputItems.compactMap { $0 as? NSExtensionItem } ?? []
        let title = items.first?.attributedContentText?.string
        let providers = items.flatMap { $0.attachments ?? [] }
        var note: String?
        for provider in providers {
            if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier),
               let url = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL,
               url.scheme?.hasPrefix("http") == true {
                return .url(url, title: title)
            }
            if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
               let text = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String {
                if let url = PasteAccessory.firstWebURL(in: text) { return .url(url, title: title) }
                if !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { note = text }
            }
        }
        if let provider = providers.first(where: { $0.hasItemConformingToTypeIdentifier(UTType.image.identifier) }),
           let data = await imageData(provider) {
            return .image(data)
        }
        return note.map { .note($0) }
    }

    /// Raw bytes, not a UIImage: the session hands them to ImageIO's thumbnailer, so the extension
    /// never decodes a full-size bitmap (it has ~120 MB to work with).
    private func imageData(_ provider: NSItemProvider) async -> Data? {
        await withCheckedContinuation { cont in
            _ = provider.loadDataRepresentation(for: .image) { data, _ in cont.resume(returning: data) }
        }
    }
}
