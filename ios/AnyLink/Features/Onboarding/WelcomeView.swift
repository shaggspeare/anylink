import SwiftUI
import DesignSystem
import Store

/// S1. Mock auth until phase 11 wires Supabase + Sign in with Apple.
struct WelcomeView: View {
    let onSignedIn: () -> Void
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var signingIn = false
    @State private var floating = false
    @State private var emailSheet = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack(spacing: 8) {
                    Image(systemName: "link").font(.system(size: 22, weight: .bold)).foregroundStyle(AL.signal)
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
                    Button(action: signIn) {
                        HStack(spacing: 6) {
                            if signingIn { ProgressView().tint(scheme == .dark ? .black : .white) }
                            else { Image(systemName: "apple.logo") }
                            Text("Sign in with Apple")
                        }
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(scheme == .dark ? .black : .white)
                        .frame(maxWidth: .infinity)
                        .frame(height: AL.Control.lg)
                        .background(scheme == .dark ? Color.white : Color.black, in: Capsule())
                    }
                    .disabled(signingIn)
                    Button { emailSheet = true } label: {
                        Text("Continue with email")
                            .font(.system(size: 17, weight: .semibold))
                            .frame(maxWidth: .infinity)
                            .frame(height: AL.Control.lg - 14)
                    }
                    .buttonStyle(.glass)
                }
                .padding(.top, 6)
            }
            .padding(24)
        }
        .scrollBounceBehavior(.basedOnSize)
        .background { ZStack { AL.canvas; Orbs(.addLink) }.ignoresSafeArea() }
        .sheet(isPresented: $emailSheet) { EmailSignIn() }
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 2.4).repeatForever()) { floating = true }
        }
    }

    private func signIn() {
        signingIn = true
        // BACKEND: Supabase Apple provider (phase 11). Mock auth succeeds at once.
        Task {
            try? await Task.sleep(for: .milliseconds(AppConfig.isUITesting ? 0 : 500))
            signingIn = false
            onSignedIn()
        }
    }

    private var demo: some View {
        VStack(spacing: 10) {
            Text("nasa.gov/missions/artemis/suit-cost")
                .font(.system(size: 12, design: .monospaced))
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

private struct EmailSignIn: View {
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var sent = false

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 14) {
                if sent {
                    Text("Check your inbox — the link signs you in on this iPhone.")
                        .font(AL.Font.lead).foregroundStyle(AL.ink)
                } else {
                    ALField("you@example.com", text: $email)
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    // BACKEND: Supabase magic link (phase 11).
                    Button("Send link") { sent = true }
                        .buttonStyle(.alPrimary)
                        .disabled(!email.contains("@") || !email.contains("."))
                }
                Spacer()
            }
            .padding(20)
            .navigationTitle("Continue with email")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button(sent ? "Done" : "Cancel") { dismiss() } } }
        }
        .presentationDetents([.medium])
    }
}

#Preview("Welcome") { WelcomeView {} }
#Preview("Welcome — Dark") { WelcomeView {}.preferredColorScheme(.dark) }
