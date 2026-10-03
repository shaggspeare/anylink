import Foundation

enum FeatureFlags {
    static var useLiveAPI: Bool {
        AppConfig.apiBase != nil && AppConfig.apiToken != nil && !AppConfig.isUITesting
    }

    /// Price-drop push notifications. BACKEND: off until APNs for price alerts ships.
    static let pricePush = false
}
