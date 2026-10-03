import Foundation

enum AppConfig {
    private static let info = Bundle.main.infoDictionary ?? [:]

    static var apiBase: URL? {
        (info["AnyLinkAPIBase"] as? String).flatMap(URL.init(string:))
    }
    static var apiToken: String? {
        info["AnyLinkAPIToken"] as? String
    }
    static var supabaseURL: String? {
        info["SupabaseURL"] as? String
    }
    static var supabaseAnonKey: String? {
        info["SupabaseAnonKey"] as? String
    }
    static var isUITesting: Bool {
        CommandLine.arguments.contains("-ui-testing")
    }
    static var showGallery: Bool {
        CommandLine.arguments.contains("-gallery")
    }
}
