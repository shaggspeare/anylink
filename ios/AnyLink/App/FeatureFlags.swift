import Foundation

enum FeatureFlags {
    static var useLiveAPI: Bool {
        AppConfig.apiBase != nil && AppConfig.apiToken != nil && !AppConfig.isUITesting
    }
}
