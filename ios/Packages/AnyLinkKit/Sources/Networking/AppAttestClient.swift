import Foundation
import CryptoKit
import DeviceCheck
import Security

/// Signs calls from an iOS install without an account (docs/adr/0002). `AppAttestClient` in the app; a fake in tests.
public protocol AppAttesting: Sendable {
    /// Headers proving this install sent `body`. Empty when it can't attest right now (the simulator without the dev
    /// secret, no network, Apple unavailable): the call then goes out signed out.
    func headers(for body: Data) async -> [String: String]
    /// The server didn't know the key: the next call registers a new one.
    func forgetKey() async
}

extension AppAttesting {
    /// Sends `request` signed. A 403 gets one more try with a fresh assertion: calls can arrive out of order
    /// (`replay`), and a server that lost the key (`unknown-key`) gets a new one first.
    func bytes(for request: URLRequest, session: URLSession) async throws -> (URLSession.AsyncBytes, URLResponse) {
        let first = try await session.bytes(for: signed(request))
        guard (first.1 as? HTTPURLResponse)?.statusCode == 403 else { return first }
        var body = Data()
        for try await byte in first.0 { body.append(byte) }
        if (try? JSONDecoder().decode(Refusal.self, from: body))?.reason == "unknown-key" { await forgetKey() }
        return try await session.bytes(for: signed(request))
    }

    private func signed(_ request: URLRequest) async -> URLRequest {
        var signed = request
        for (name, value) in await headers(for: request.httpBody ?? Data()) { signed.setValue(value, forHTTPHeaderField: name) }
        return signed
    }
}

private struct Refusal: Decodable { let reason: String? }

/// Apple's App Attest. Registers one key per install (`GET /api/attest/challenge`, then `POST /api/attest/register`),
/// keeps its id in the shared keychain, and signs each call with an assertion over the SHA-256 of its body. If Apple
/// rejects the key, it registers a new one, once per call.
public actor AppAttestClient: AppAttesting {
    private let base: URL
    private let session: URLSession
    private let service: any AttestService
    private let keychain: KeychainString?
    private let devSecret: String?
    private var keyId: String?
    private var registering: Task<String, Error>?

    /// `keychainGroup` is the shared group Auth.swift keeps the session in. `devSecret` is for DEBUG builds only: it
    /// goes out instead of an assertion where App Attest isn't supported, such as the simulator.
    public init(base: URL, keychainGroup: String?, devSecret: String?, session: URLSession = .shared) {
        self.init(base: base, session: session, service: DeviceCheckService(), keychain: KeychainString(group: keychainGroup), devSecret: devSecret)
    }

    /// A nil `keychain` keeps the key id in memory only.
    init(base: URL, session: URLSession, service: any AttestService, keychain: KeychainString?, devSecret: String?) {
        self.base = base; self.session = session; self.service = service; self.keychain = keychain; self.devSecret = devSecret
    }

    public func headers(for body: Data) async -> [String: String] {
        guard service.isSupported else { return devSecret.map { ["X-AnyLink-Dev": $0] } ?? [:] }
        do {
            return try await sign(body)
        } catch let error as DCError where error.code == .invalidKey {
            // Apple doesn't know the key any more (a reinstall, a restored backup): register a new one, once.
            forgetKey()
            return (try? await sign(body)) ?? [:]
        } catch {
            return [:]
        }
    }

    public func forgetKey() {
        keyId = nil
        keychain?.save(nil)
    }

    private func sign(_ body: Data) async throws -> [String: String] {
        let id = try await key()
        let assertion = try await service.generateAssertion(id, clientDataHash: Data(SHA256.hash(data: body)))
        return ["X-AnyLink-Key": id, "X-AnyLink-Assertion": assertion.base64EncodedString()]
    }

    /// The registered key id, registering a key first if there's none. Calls meanwhile share that registration.
    private func key() async throws -> String {
        if let keyId { return keyId }
        if let stored = keychain?.load() {
            keyId = stored
            return stored
        }
        let registration = registering ?? Task { try await register() }
        registering = registration
        defer { registering = nil }
        let id = try await registration.value
        keyId = id
        return id
    }

    private func register() async throws -> String {
        let id = try await service.generateKey()
        let challenge = try await challenge()
        let attestation = try await service.attestKey(id, clientDataHash: Data(SHA256.hash(data: Data(challenge.utf8))))
        var request = URLRequest(url: base.appending(path: "api/attest/register"), timeoutInterval: 30)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["keyId": id, "attestation": attestation.base64EncodedString(), "challenge": challenge])
        try LiveAPI.check(try await session.data(for: request).1)
        keychain?.save(id)
        return id
    }

    private func challenge() async throws -> String {
        struct Challenge: Decodable { let challenge: String }
        let (data, response) = try await session.data(from: base.appending(path: "api/attest/challenge"))
        try LiveAPI.check(response)
        return try JSONDecoder().decode(Challenge.self, from: data).challenge
    }
}

/// DeviceCheck's App Attest calls, behind a protocol so tests can stand in for the Secure Enclave.
protocol AttestService: Sendable {
    var isSupported: Bool { get }
    func generateKey() async throws -> String
    func attestKey(_ keyId: String, clientDataHash: Data) async throws -> Data
    func generateAssertion(_ keyId: String, clientDataHash: Data) async throws -> Data
}

struct DeviceCheckService: AttestService {
    var isSupported: Bool { DCAppAttestService.shared.isSupported }
    func generateKey() async throws -> String { try await DCAppAttestService.shared.generateKey() }
    func attestKey(_ keyId: String, clientDataHash: Data) async throws -> Data {
        try await DCAppAttestService.shared.attestKey(keyId, clientDataHash: clientDataHash)
    }
    func generateAssertion(_ keyId: String, clientDataHash: Data) async throws -> Data {
        try await DCAppAttestService.shared.generateAssertion(keyId, clientDataHash: clientDataHash)
    }
}

/// The key id, in the shared keychain group and on this device only: an App Attest key never leaves the Secure Enclave
/// it was made in.
struct KeychainString: Sendable {
    let group: String?

    func load() -> String? {
        var query = self.query
        query[kSecReturnData as String] = true
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess, let data = item as? Data else { return nil }
        return String(decoding: data, as: UTF8.self)
    }

    func save(_ value: String?) {
        SecItemDelete(query as CFDictionary)
        guard let value else { return }
        var query = self.query
        query[kSecValueData as String] = Data(value.utf8)
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(query as CFDictionary, nil)
    }

    private var query: [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.shaggspeare.anylink.appattest",
            kSecAttrAccount as String: "keyId",
        ]
        if let group { query[kSecAttrAccessGroup as String] = group }
        return query
    }
}
