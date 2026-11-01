import Testing
import Foundation
import StoreKit
import StoreKitTest
@testable import AnyLink

/// Stands in for the server: records each transaction ProStore posts, or refuses them.
@MainActor final class Spy {
    var posted: [String] = []
    var refusing = false
    var confirmations = 0

    func post(_ jws: String) throws {
        if refusing { throw URLError(.badServerResponse) }
        posted.append(jws)
    }
}

/// Whether StoreKitTest works here. On the iOS 26.3–26.5 simulators, outside an Xcode debug session (`xcodebuild test`),
/// SKTestSession can't save its configuration (FB22237318: SKInternalErrorDomain 3), and StoreKit then falls through to
/// the real App Store. These tests must never talk to Apple, so they're skipped there; run them from Xcode instead.
/// The probe is a purchase made in the test environment itself (`.notEntitled` when it's broken), then cleared.
@MainActor
func storeKitTestWorks() async -> Bool {
    guard let url = Bundle(for: Spy.self).url(forResource: "AnyLink", withExtension: "storekit"),
          let session = try? SKTestSession(contentsOf: url) else { return false }
    session.disableDialogs = true
    defer { session.clearTransactions() }
    return (try? await session.buyProduct(identifier: ProStore.lifetime)) != nil
}

/// ProStore against Xcode's local App Store with AnyLink.storekit's three products. Runs in the app on the simulator,
/// which the scheme starts with `-ui-testing`, so nothing reaches a server.
@MainActor
@Suite(.serialized, .timeLimit(.minutes(1)),
       .enabled("StoreKitTest is broken on this simulator (FB22237318); run from Xcode") { await storeKitTestWorks() })
struct ProStoreTests {
    let session: SKTestSession
    let account = UUID()

    init() throws {
        let url = try #require(Bundle(for: Spy.self).url(forResource: "AnyLink", withExtension: "storekit"))
        session = try SKTestSession(contentsOf: url)
        session.disableDialogs = true
        session.clearTransactions()
    }

    /// `sync` is skipped: the real `AppStore.sync()` asks for an Apple Account, which a test session can't answer.
    func store(_ spy: Spy, signedIn: Bool = true) -> ProStore {
        let account = signedIn ? account : nil
        return ProStore(account: { account }, post: { try await spy.post($0) }, confirmed: { spy.confirmations += 1 }, sync: {})
    }

    /// The claims in a transaction's JWS.
    func claims(_ jws: String) throws -> [String: Any] {
        var part = String(jws.split(separator: ".")[1]).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while part.count % 4 != 0 { part += "=" }
        let data = try #require(Data(base64Encoded: part))
        return try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    func waitUntil(_ condition: () -> Bool) async throws {
        for _ in 0..<100 where !condition() { try await Task.sleep(for: .milliseconds(100)) }
        #expect(condition())
    }

    @Test func loadsTheThreeProductsYearlyFirst() async {
        let pro = store(Spy())
        await pro.load()
        #expect(pro.options.map(\.id) == ProStore.productIDs)
        #expect(pro.options.map(\.price) == ["$19.99", "$2.99", "$49.99"])
        #expect(!pro.loadFailed)
    }

    @Test(arguments: ProStore.productIDs)
    func eachPurchaseCarriesTheAccountReachesTheServerAndFinishes(_ id: String) async throws {
        let spy = Spy()
        let pro = store(spy)
        await pro.load()
        await pro.buy(id)
        #expect(pro.phase == .done)
        let sent = try claims(try #require(spy.posted.first))
        #expect(sent["productId"] as? String == id)
        #expect((sent["appAccountToken"] as? String)?.lowercased() == account.uuidString.lowercased())
        #expect(spy.confirmations == 1)
        for await _ in Transaction.unfinished { Issue.record("a purchase the server has was left unfinished") }
    }

    @Test func signedOutCantBuy() async {
        let spy = Spy()
        let pro = store(spy, signedIn: false)
        await pro.load()
        #expect(!pro.isSignedIn)
        await pro.buy(ProStore.monthly)
        #expect(pro.phase == .failed)
        #expect(spy.posted.isEmpty)
    }

    @Test func aRefusedPostStaysUnfinishedUntilRestoreDeliversIt() async throws {
        let spy = Spy()
        spy.refusing = true
        let pro = store(spy)
        await pro.load()
        await pro.buy(ProStore.lifetime)
        #expect(pro.phase == .unconfirmed)
        var unfinished = 0
        for await _ in Transaction.unfinished { unfinished += 1 }
        #expect(unfinished == 1)

        spy.refusing = false
        await pro.restore()
        #expect(pro.phase == .done)
        #expect(spy.posted.count == 1)
    }

    @Test func restoreOnAFreshInstallPostsWhatWasBought() async throws {
        let first = store(Spy())
        await first.load()
        await first.buy(ProStore.yearly)
        #expect(first.phase == .done)

        // A fresh install: a ProStore that has posted nothing.
        let spy = Spy()
        let fresh = store(spy)
        await fresh.restore()
        #expect(fresh.phase == .done)
        #expect(try claims(try #require(spy.posted.first))["productId"] as? String == ProStore.yearly)
    }

    @Test func restoreWithNothingBoughtSaysSo() async {
        let spy = Spy()
        let pro = store(spy)
        await pro.restore()
        #expect(pro.phase == .nothingToRestore)
        #expect(spy.posted.isEmpty)
    }

    @Test func theLaunchListenerHandsOutsidePurchasesRenewalsAndRefundsToTheServer() async throws {
        let spy = Spy()
        let pro = store(spy)
        // Bought outside the app: another device, or an approved Ask to Buy.
        let bought = try await session.buyProduct(identifier: ProStore.monthly, options: [.appAccountToken(account)])
        try await waitUntil { spy.posted.count == 1 }
        try session.forceRenewalOfSubscription(productIdentifier: ProStore.monthly)
        try await waitUntil { spy.posted.count == 2 }
        try session.refundTransaction(identifier: UInt(bought.id))
        try await waitUntil { spy.posted.count == 3 }
        #expect(try claims(spy.posted[2])["revocationDate"] != nil)
        withExtendedLifetime(pro) {}
    }
}
