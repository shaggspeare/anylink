import Foundation

enum AppConfig {
    static var apiBase: URL? {
        (Bundle.main.object(forInfoDictionaryKey: "AnyLinkAPIBase") as? String).flatMap(URL.init(string:))
    }
    static var apiToken: String? {
        Bundle.main.object(forInfoDictionaryKey: "AnyLinkAPIToken") as? String
    }
    static var supabaseURL: String? {
        Bundle.main.object(forInfoDictionaryKey: "SupabaseURL") as? String
    }
    static var supabaseAnonKey: String? {
        Bundle.main.object(forInfoDictionaryKey: "SupabaseAnonKey") as? String
    }
    static var isUITesting: Bool {
        CommandLine.arguments.contains("-ui-testing")
    }
    static var showGallery: Bool {
        CommandLine.arguments.contains("-gallery")
    }
}
