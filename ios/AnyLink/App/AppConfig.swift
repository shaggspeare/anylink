import Foundation

enum AppConfig {
    static var apiBase: URL? {
        // xcconfig treats `//` as a comment, so an unescaped value arrives as "https:" — reject anything without a host.
        (Bundle.main.object(forInfoDictionaryKey: "AnyLinkAPIBase") as? String)
            .flatMap(URL.init(string:))
            .flatMap { $0.host() == nil ? nil : $0 }
    }
    /// The shared keychain group, the one Auth.swift keeps the session in.
    static var sharedKeychainGroup: String? {
        (Bundle.main.object(forInfoDictionaryKey: "AppIdentifierPrefix") as? String).map { "\($0)com.shaggspeare.anylink.shared" }
    }
    /// DEBUG builds only: `APP_ATTEST_DEV_SECRET` from Config.xcconfig, sent where App Attest isn't supported (the
    /// simulator). A server honours it only when its own APP_ATTEST_DEV_SECRET matches, which is never production.
    static var appAttestDevSecret: String? {
        #if DEBUG
        (Bundle.main.object(forInfoDictionaryKey: "AppAttestDevSecret") as? String).flatMap { $0.isEmpty ? nil : $0 }
        #else
        nil
        #endif
    }
    static var isUITesting: Bool {
        CommandLine.arguments.contains("-ui-testing")
    }
    /// Pro is parked for the first release: every account gets everything Pro has, and nothing is sold. The gating,
    /// the paywall and StoreKit stay wired up; make this `false` to bring Pro back. Web twin: `PRO_FOR_EVERYONE` in
    /// src/lib/plan.ts. Meanwhile UI tests pass `-pro-gating` to keep testing the gating.
    static var proForEveryone: Bool {
        !(isUITesting && CommandLine.arguments.contains("-pro-gating"))
    }
    /// UI tests and screenshots: the sample library as a free account, kept on this device.
    static var isFree: Bool {
        CommandLine.arguments.contains("-free")
    }
    /// UI tests: Pro has just ended on the server, so the next refresh of the Pro library is a lapse (S20).
    static var proEnds: Bool {
        CommandLine.arguments.contains("-pro-ends")
    }
    static var showGallery: Bool {
        CommandLine.arguments.contains("-gallery")
    }
}
