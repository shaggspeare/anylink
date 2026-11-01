import Foundation

enum FeatureFlags {
    static var useLiveAPI: Bool {
        AppConfig.apiBase != nil && AuthService.client != nil && !AppConfig.isUITesting
    }
}
