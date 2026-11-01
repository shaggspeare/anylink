import Foundation

enum AppConfig {
    static var apiBase: URL? {
        // xcconfig treats `//` as a comment, so an unescaped value arrives as "https:" — reject anything without a host.
        (Bundle.main.object(forInfoDictionaryKey: "AnyLinkAPIBase") as? String)
            .flatMap(URL.init(string:))
            .flatMap { $0.host() == nil ? nil : $0 }
    }
    static var isUITesting: Bool {
        CommandLine.arguments.contains("-ui-testing")
    }
    /// UI tests and screenshots: the sample library as a free account.
    static var isFree: Bool {
        CommandLine.arguments.contains("-free")
    }
    static var showGallery: Bool {
        CommandLine.arguments.contains("-gallery")
    }
}
