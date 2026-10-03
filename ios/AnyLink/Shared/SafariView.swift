import SwiftUI
import SafariServices
import DesignSystem
import Store

enum OpenIn: String, CaseIterable { case app, safari }

struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        let config = SFSafariViewController.Configuration()
        config.entersReaderIfAvailable = false
        let vc = SFSafariViewController(url: url, configuration: config)
        return vc
    }

    func updateUIViewController(_ vc: SFSafariViewController, context: Context) {}
}

private struct PresentedURL: Identifiable { let url: URL; var id: String { url.absoluteString } }

/// Presents `router.openOriginal` in-app (SFSafariViewController) or in Safari, per Settings.
struct OpenOriginalHost: ViewModifier {
    @Environment(Router.self) private var router
    @Environment(\.openURL) private var openURL
    @AppStorage("openIn") private var openIn: OpenIn = .app
    @State private var presented: PresentedURL?

    func body(content: Content) -> some View {
        content
            .onChange(of: router.openOriginal) { _, url in
                guard let url else { return }
                router.openOriginal = nil
                if openIn == .safari || !(url.scheme == "http" || url.scheme == "https") { openURL(url) } else { presented = PresentedURL(url: url) }
            }
            .fullScreenCover(item: $presented) { SafariView(url: $0.url).ignoresSafeArea() }
    }
}
