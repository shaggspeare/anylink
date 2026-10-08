import Foundation
import Auth

/// Supabase sign-in (Apple, Google, emailed code). The session sits in the shared keychain, so the share
/// extension saves as the same user. Compiled into both targets.
enum AuthService {
    /// Google's browser sheet and the email's magic link come back here.
    static let redirect = URL(string: "anylink://auth-callback")!

    /// nil without `SUPABASE_URL` / `SUPABASE_ANON_KEY`: the app then runs on mock data with mock sign-in.
    static let client: AuthClient? = {
        // xcconfig treats `//` as a comment, so an unescaped value arrives as "https:" — reject anything without a host.
        guard let base = (Bundle.main.object(forInfoDictionaryKey: "SupabaseURL") as? String).flatMap(URL.init(string:)),
              base.host() != nil,
              let key = Bundle.main.object(forInfoDictionaryKey: "SupabaseAnonKey") as? String, !key.isEmpty
        else { return nil }
        let prefix = Bundle.main.object(forInfoDictionaryKey: "AppIdentifierPrefix") as? String
        return AuthClient(
            url: base.appending(path: "auth/v1"),
            headers: ["apikey": key],
            flowType: .pkce,
            redirectToURL: redirect,
            localStorage: KeychainLocalStorage(service: "app.anylink.auth", accessGroup: prefix.map { "\($0)app.anylink.ios.shared" }),
            emitLocalSessionAsInitialSession: true
        )
    }()

    /// A valid access token, refreshed if it expired; nil when signed out.
    static func accessToken() async -> String? {
        try? await client?.session.accessToken
    }

    static func isCallback(_ url: URL) -> Bool { url.scheme == redirect.scheme && url.host() == redirect.host() }
}
