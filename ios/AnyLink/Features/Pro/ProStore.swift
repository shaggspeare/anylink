import Foundation
import Observation
import StoreKit
import Networking
import Store

/// Buys Pro in the App Store and hands each purchase to the server, which owns the plan (docs/adr/0002). One for the
/// app, made at launch: it listens to `Transaction.updates` from the start, so renewals, Ask to Buy approvals, refunds
/// and purchases made on another device reach the server with no paywall open.
@MainActor @Observable
final class ProStore {
    nonisolated static let yearly = "com.shaggspeare.anylink.pro.yearly"
    nonisolated static let monthly = "com.shaggspeare.anylink.pro.monthly"
    nonisolated static let lifetime = "com.shaggspeare.anylink.pro.lifetime"
    /// The paywall's order. Same ids as `PRODUCTS` in src/lib/billing/apple.ts and AnyLink.storekit.
    nonisolated static let productIDs = [yearly, monthly, lifetime]

    /// What the paywall shows for one product.
    struct Option: Identifiable, Hashable {
        let id: String
        let price: String
    }

    enum Phase: Equatable { case idle, buying, confirming, pending, failed, unconfirmed, restoring, nothingToRestore, done }

    private(set) var options: [Option] = []
    private(set) var loading = false
    private(set) var loadFailed = false
    /// Where the last purchase or restore got to; the paywall shows it and resets it.
    var phase = Phase.idle

    @ObservationIgnored private var products: [String: Product] = [:]
    @ObservationIgnored private let account: @MainActor () -> UUID?
    @ObservationIgnored private let post: @Sendable (String) async throws -> Void
    @ObservationIgnored private let confirmed: @MainActor () async -> Void
    @ObservationIgnored private let sync: @MainActor () async throws -> Void

    /// - Parameters:
    ///   - account: the signed-in account's id, which every purchase carries as its `appAccountToken`; nil signed out.
    ///   - post: sends a transaction's JWS to the server (`LiveAPI.verifyPurchase`).
    ///   - confirmed: runs once the server has a transaction: refresh the library, so `plan` follows.
    ///   - sync: Restore's `AppStore.sync()`. Tests skip it: it asks for a real Apple Account.
    init(account: @escaping @MainActor () -> UUID?, post: @escaping @Sendable (String) async throws -> Void,
         confirmed: @escaping @MainActor () async -> Void,
         sync: @escaping @MainActor () async throws -> Void = { try await AppStore.sync() }) {
        self.account = account
        self.post = post
        self.confirmed = confirmed
        self.sync = sync
        Task { [weak self] in
            for await update in Transaction.updates {
                guard let self else { return }
                await deliver(update)
            }
        }
    }

    /// Pro belongs to an account, so the paywall signs people in before buying or restoring.
    var isSignedIn: Bool { account() != nil }

    func load() async {
        guard !loading else { return }
        loading = true
        loadFailed = false
        if let found = try? await Product.products(for: Self.productIDs) {
            products = Dictionary(found.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
            options = Self.productIDs.compactMap { id in products[id].map { Option(id: id, price: $0.displayPrice) } }
        }
        loadFailed = options.isEmpty
        loading = false
    }

    /// Buys with the account's id as `appAccountToken`: the server puts Pro on that account and no other.
    func buy(_ id: String) async {
        guard let product = products[id], let account = account() else { phase = .failed; return }
        phase = .buying
        do {
            switch try await product.purchase(options: [.appAccountToken(account)]) {
            case .success(let result):
                phase = .confirming
                phase = await deliver(result) ? .done : .unconfirmed
            case .pending:
                phase = .pending
            case .userCancelled:
                phase = .idle
            @unknown default:
                phase = .idle
            }
        } catch {
            phase = .failed
        }
    }

    /// Restore purchases: sync with the App Store (it may ask for the Apple Account password), then hand every current
    /// entitlement to the server again.
    func restore() async {
        phase = .restoring
        try? await sync()
        var found = false, delivered = false
        for await result in Transaction.currentEntitlements {
            found = true
            if await deliver(result) { delivered = true }
        }
        phase = delivered ? .done : found ? .unconfirmed : .nothingToRestore
    }

    /// Posts a verified transaction, then finishes it. A failed post leaves it unfinished, and StoreKit hands it over
    /// again at the next launch. True once the server has it.
    @discardableResult
    private func deliver(_ result: VerificationResult<Transaction>) async -> Bool {
        guard case .verified(let transaction) = result else { return false }
        do {
            try await post(result.jwsRepresentation)
        } catch {
            return false
        }
        await transaction.finish()
        await confirmed()
        return true
    }
}

extension ProStore {
    /// The app's: purchases carry the Supabase user's id, go to `POST /api/v1/billing/apple`, and refresh the library
    /// on screen once the server has them (RootView swaps it when the library mode changes; Pro phase 5 moves a local
    /// library into the server one here). Without a backend (UI tests, mock builds) nothing is posted, and a fixed id
    /// stands in for the mock sign-in.
    static func app() -> ProStore {
        let refresh: @MainActor () async -> Void = { await IntentBridge.store?.refresh() }
        guard FeatureFlags.useLiveAPI, let base = AppConfig.apiBase else {
            let mockAccount = UUID(uuid: (0, 0, 0, 0, 0, 0, 0x40, 0, 0x80, 0, 0, 0, 0, 0, 0, 1))
            let pro = ProStore(account: { UserDefaults.standard.bool(forKey: "signedIn") ? mockAccount : nil },
                               post: { _ in }, confirmed: refresh)
            #if DEBUG
            // UI tests never reach the App Store: the paywall shows fixed prices and doesn't load products.
            if AppConfig.isUITesting { pro.options = previewOptions }
            #endif
            return pro
        }
        let api = LiveAPI(base: base) { await AuthService.accessToken() }
        return ProStore(account: { AuthService.client?.currentUser?.id },
                        post: { try await api.verifyPurchase($0) }, confirmed: refresh)
    }

    #if DEBUG
    static let previewOptions = [Option(id: yearly, price: "$19.99"), Option(id: monthly, price: "$2.99"), Option(id: lifetime, price: "$49.99")]

    /// Previews: a paywall in any state, with no App Store behind it.
    static func preview(options: [Option] = previewOptions, phase: Phase = .idle, loading: Bool = false,
                        loadFailed: Bool = false) -> ProStore {
        let pro = ProStore(account: { nil }, post: { _ in }, confirmed: {}, sync: {})
        pro.options = options
        pro.phase = phase
        pro.loading = loading
        pro.loadFailed = loadFailed
        return pro
    }
    #endif
}
