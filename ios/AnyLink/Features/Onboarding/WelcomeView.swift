import SwiftUI
import AuthenticationServices
import CryptoKit
import Auth
import DesignSystem
import Store

/// S1. Sign in, or skip and try the sample library first (a guest gets GUEST_LIMIT saves of their own).
struct WelcomeView: View {
    let onSignedIn: () -> Void
    var onSkip: (() -> Void)?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var floating = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack(spacing: 8) {
                    Image(systemName: "link").font(.title2.weight(.bold)).foregroundStyle(AL.signal)
                    Text("AnyLink").font(AL.Font.brand(17, .semibold, relativeTo: .headline)).tracking(-0.6)
                }
                .accessibilityElement(children: .combine)
                demo
                Text("Paste anything.\nWe read the rest.")
                    .font(AL.Font.hero).tracking(-1.6)
                    .foregroundStyle(AL.ink)
                    .accessibilityAddTraits(.isHeader)
                HStack(alignment: .top, spacing: 12) {
                    pillar("Save", "from any app's share sheet")
                    pillar("Organise", "collections build themselves")
                    pillar("Find", "even inside the article text")
                }
                VStack(spacing: 12) {
                    SignInButtons(onSignedIn: onSignedIn)
                    if let onSkip {
                        Button(action: onSkip) {
                            Text("Skip for now")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(AL.ink.opacity(AL.Ink.a60))
                                .frame(maxWidth: .infinity, minHeight: 44)
                                .contentShape(Rectangle())
                        }
                    }
                }
                .padding(.top, 6)
            }
            .padding(24)
        }
        .scrollBounceBehavior(.basedOnSize)
        .background { ZStack { AL.canvas; Orbs(.addLink) }.ignoresSafeArea() }
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 2.4).repeatForever()) { floating = true }
        }
    }

    private var demo: some View {
        VStack(spacing: 10) {
            Text("nasa.gov/missions/artemis/suit-cost")
                .font(.caption.monospaced())
                .fixedSize(horizontal: false, vertical: true)
                .foregroundStyle(AL.ink.opacity(AL.Ink.a75))
                .padding(.horizontal, 12).frame(height: 30)
                .background(AL.ink.opacity(AL.Ink.a06), in: Capsule())
            Text("↓ AnyLink reads it").font(AL.Font.eyebrow).tracking(1.47).textCase(.uppercase)
                .foregroundStyle(AL.ink.opacity(AL.Ink.a50))
            VStack(alignment: .leading, spacing: 8) {
                HeroFallback(tint: Color(hex: 0x17181B), stripe: AL.lime)
                    .frame(height: 120)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                HStack(spacing: 6) {
                    InitialBadge(initial: "N", tint: Color(hex: 0x17181B), stripe: AL.lime, size: 14)
                    Text("nasa.gov · 6 min read").font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                }
                Text("A full NASA space suit costs $12 million")
                    .font(AL.Font.cardTitleL).foregroundStyle(AL.ink)
            }
            .padding(8).padding(.bottom, 6)
            .frame(width: 290)
            .frosted(0.86, radius: 22)
            .alShadow(AL.Shadow.popover)
            .offset(y: floating ? -6 : 4)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Example: a pasted NASA link becomes a card titled A full NASA space suit costs $12 million")
        .accessibilityIdentifier("tile-welcome-demo")
    }

    private func pillar(_ title: String, _ detail: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(AL.Font.rowTitle).foregroundStyle(AL.ink)
            Text(detail).font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a55))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

/// Apple, Google and email — on Welcome and in the guest's sign-up sheet. Without a Supabase config (previews,
/// UI tests, mock builds) every button signs in at once.
struct SignInButtons: View {
    let onSignedIn: () -> Void
    @ScaledMetric(relativeTo: .body) private var iconSize: CGFloat = 18
    @Environment(\.colorScheme) private var scheme
    @State private var busy = false
    @State private var emailSheet = false
    @State private var nonce = ""
    @AppStorage(AuthService.linkErrorKey) private var linkError = ""
    @State private var error: String?

    private var mock: Bool { AuthService.client == nil || AppConfig.isUITesting }

    var body: some View {
        VStack(spacing: 12) {
            if mock {
                Button(action: onSignedIn) {
                    Label("Continue with Apple", systemImage: "apple.logo")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(scheme == .dark ? .black : .white)
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: AL.Control.lg)
                        .background(scheme == .dark ? Color.white : Color.black, in: Capsule())
                }
            } else {
                SignInWithAppleButton(.continue) { request in
                    nonce = UUID().uuidString
                    request.requestedScopes = [.email]
                    request.nonce = SHA256.hash(data: Data(nonce.utf8)).map { String(format: "%02x", $0) }.joined()
                } onCompletion: { result in
                    Task { await apple(result) }
                }
                .signInWithAppleButtonStyle(scheme == .dark ? .white : .black)
                .frame(height: AL.Control.lg)
                .clipShape(Capsule())
            }
            wide("Continue with Google", icon: Image("GoogleLogo")) { Task { await google() } }
            wide("Continue with email", icon: Image(systemName: "envelope")) { emailSheet = true }
            if let error = error ?? (linkError.isEmpty ? nil : linkError) {
                Text(error).font(.footnote).foregroundStyle(AL.signal).accessibilityAddTraits(.updatesFrequently)
            }
        }
        .disabled(busy)
        .sheet(isPresented: $emailSheet) { EmailSignIn(onSignedIn: onSignedIn) }
    }

    private func wide(_ title: LocalizedStringKey, icon: Image, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label { Text(title) } icon: { icon.resizable().scaledToFit().frame(width: iconSize, height: iconSize) }
                .font(.body.weight(.semibold))
                .frame(maxWidth: .infinity)
                .frame(height: AL.Control.lg - 14)
        }
        .buttonStyle(.glass)
    }

    private func apple(_ result: Result<ASAuthorization, Error>) async {
        switch result {
        case .failure(let e):
            if (e as? ASAuthorizationError)?.code != .canceled { error = "Sign in with Apple didn't work. Try again." }
        case .success(let auth):
            guard let token = (auth.credential as? ASAuthorizationAppleIDCredential)?.identityToken.flatMap({ String(data: $0, encoding: .utf8) })
            else { error = "Sign in with Apple didn't work. Try again."; return }
            await run { try await AuthService.client?.signInWithIdToken(credentials: .init(provider: .apple, idToken: token, nonce: nonce)) }
        }
    }

    private func google() async {
        guard !mock else { return onSignedIn() }
        await run { try await AuthService.client?.signInWithOAuth(provider: .google) }
    }

    private func run(_ signIn: () async throws -> Session?) async {
        busy = true
        error = nil
        defer { busy = false }
        do {
            _ = try await signIn()
            onSignedIn()
        } catch let e as ASWebAuthenticationSessionError where e.code == .canceledLogin {
            // Closed the browser sheet: nothing to say.
        } catch {
            self.error = "Couldn't sign in. Check your connection and try again."
        }
    }
}

/// Email and password. Mail only goes out to confirm a new account or reset a forgotten password; the reset
/// link comes back to `anylink://auth-callback/recovery`, and RootView then asks for the new password.
private struct EmailSignIn: View {
    enum Mode { case signIn, signUp, forgot }

    let onSignedIn: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var mode = Mode.signIn
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var notice: String?
    @AppStorage(AuthService.linkErrorKey) private var linkError = ""
    @State private var error: String?

    private var address: String { email.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var canSubmit: Bool {
        guard !busy, address.contains("@"), address.contains(".") else { return false }
        switch mode {
        case .signIn: return !password.isEmpty
        case .signUp: return password.count >= 8
        case .forgot: return true
        }
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 14) {
                ALField("you@example.com", text: $email)
                    .keyboardType(.emailAddress)
                    .textContentType(.username)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                if mode != .forgot {
                    ALField(mode == .signUp ? "Password (8+ characters)" : "Password", text: $password, isSecure: true)
                        .textContentType(mode == .signUp ? .newPassword : .password)
                }
                Button(mode == .signIn ? "Sign in" : mode == .signUp ? "Create account" : "Send reset link") {
                    Task { await submit() }
                }
                .buttonStyle(.alPrimary)
                .disabled(!canSubmit)
                HStack {
                    if mode == .signIn {
                        Button("New here? Create an account") { switchTo(.signUp) }
                        Spacer()
                        Button("Forgot password?") { switchTo(.forgot) }
                    } else {
                        Button(mode == .signUp ? "Have an account? Sign in" : "Back to sign in") { switchTo(.signIn) }
                    }
                }
                .font(.footnote.weight(.semibold))
                .foregroundStyle(AL.ink.opacity(AL.Ink.a60))
                if let notice { Text(notice).font(.footnote).foregroundStyle(AL.ink) }
                if let error = error ?? (linkError.isEmpty ? nil : linkError) { Text(error).font(.footnote).foregroundStyle(AL.signal) }
                Spacer()
            }
            .padding(20)
            .navigationTitle(mode == .signUp ? "Create account" : mode == .forgot ? "Reset password" : "Sign in with email")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
        .presentationDetents([.medium, .large])
    }

    private func switchTo(_ next: Mode) {
        mode = next
        error = nil
        notice = nil
    }

    private func submit() async {
        guard let client = AuthService.client else { dismiss(); return onSignedIn() }
        busy = true
        error = nil
        notice = nil
        linkError = ""
        defer { busy = false }
        do {
            switch mode {
            case .signIn:
                _ = try await client.signIn(email: address, password: password)
                dismiss()
                onSignedIn()
            case .signUp:
                if case .session = try await client.signUp(email: address, password: password, redirectTo: AuthService.redirect) {
                    dismiss()
                    onSignedIn()
                } else {
                    // Confirm email is on: the account waits for the link.
                    mode = .signIn
                    notice = "Check \(address) for a link to confirm your account, then sign in."
                }
            case .forgot:
                try await client.resetPasswordForEmail(address, redirectTo: AuthService.recoveryRedirect)
                // Same answer whether or not the address has an account.
                notice = "If \(address) has an account, a link to reset the password is on its way. Open it on this iPhone."
            }
        } catch {
            self.error = Self.message(for: error)
        }
    }

    static func message(for error: Error) -> String {
        guard let e = error as? AuthError else { return "Couldn't reach AnyLink. Check your connection and try again." }
        switch e.errorCode {
        case .invalidCredentials: return "That email and password don't match."
        case .emailNotConfirmed: return "Confirm your email first — the link is in your inbox."
        case .userAlreadyExists, .emailExists: return "There's already an account with this email. Sign in instead."
        case .weakPassword: return "Choose a longer password (8+ characters)."
        case .overEmailSendRateLimit: return "Too many emails right now. Wait a few minutes, then try again."
        default: return e.message
        }
    }
}

/// After a reset link: they're signed in, and only the new password is left.
struct NewPasswordSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 14) {
                ALField("New password (8+ characters)", text: $password, isSecure: true)
                    .textContentType(.newPassword)
                Button("Save") { Task { await save() } }
                    .buttonStyle(.alPrimary)
                    .disabled(busy || password.count < 8)
                if let error { Text(error).font(.footnote).foregroundStyle(AL.signal) }
                Spacer()
            }
            .padding(20)
            .navigationTitle("Choose a new password")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Later") { dismiss() } } }
        }
        .presentationDetents([.medium])
    }

    private func save() async {
        busy = true
        defer { busy = false }
        do {
            _ = try await AuthService.client?.update(user: UserAttributes(password: password))
            dismiss()
        } catch {
            self.error = EmailSignIn.message(for: error)
        }
    }
}

/// A guest who has used their free saves (SheetRoute.signUp).
struct SignUpSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("Keep everything you save").font(AL.Font.cardTitleL).foregroundStyle(AL.ink)
                Text("Create a free account to save more. What you've added so far comes with you.")
                    .font(AL.Font.lead).foregroundStyle(AL.ink.opacity(AL.Ink.a75))
                SignInButtons {
                    // RootView sees the flag, moves the guest's saves over and swaps to the signed-in library.
                    UserDefaults.standard.set(true, forKey: "signedIn")
                }
                Spacer()
            }
            .padding(20)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Not now") { dismiss() } } }
        }
        .presentationDetents([.large])
    }
}

#Preview("Welcome") { WelcomeView(onSignedIn: {}, onSkip: {}) }
#Preview("Welcome — Dark") { WelcomeView {}.preferredColorScheme(.dark) }
