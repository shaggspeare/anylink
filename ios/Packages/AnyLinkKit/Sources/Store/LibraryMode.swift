/// Which library the app shows (ADR 0002). Pro phase 5 adds the upgrade and lapse moves between the two.
public enum LibraryMode: Equatable, Sendable {
    /// The account's server library: the API, plus the offline cache.
    case server
    /// A library on this device, synced through the user's iCloud (`LocalAPI`).
    case local

    /// Signed in with Pro: the server library. Anything else, a free account that signed in too, keeps a local one.
    /// `plan` is the server's last answer for the signed-in account; nil until it has given one.
    public init(signedIn: Bool, plan: String?) {
        self = signedIn && plan == "pro" ? .server : .local
    }
}
