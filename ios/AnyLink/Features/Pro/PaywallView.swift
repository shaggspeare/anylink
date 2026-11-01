import SwiftUI
import DesignSystem
import Store

/// S19. Buying Pro. Pro belongs to an AnyLink account, so Continue and Restore sign in first when needed.
struct PaywallView: View {
    @Environment(ProStore.self) private var pro
    @Environment(LibraryStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var selected = ProStore.yearly
    /// What to do once the sign-in sheet has signed them in.
    @State private var signingIn: Intent?
    /// One column for the benefit symbols, so their text lines up.
    @ScaledMetric(relativeTo: .callout) private var symbolWidth: CGFloat = 26

    enum Intent: Identifiable {
        case buy, restore
        var id: Self { self }
    }

    private static let benefits: [(symbol: String, text: LocalizedStringKey)] = [
        ("arrow.triangle.2.circlepath", "One library on your iPhone and the web"),
        ("sparkles", "AI summaries and tags on every save"),
        ("safari", "A second read in a full browser when a page won't load"),
        ("rectangle.on.rectangle", "Layouts for products, articles, videos and recipes"),
        ("chart.line.downtrend.xyaxis", "Price history and price alerts"),
        ("stethoscope", "Link health checks"),
        ("link", "Share links to your collections"),
        ("square.and.arrow.up", "Export as HTML, JSON or CSV"),
    ]
    private static let terms = URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!
    private static let privacy = URL(string: "https://www.anylink.space/privacy-policy")!

    private var busy: Bool { [.buying, .confirming, .restoring].contains(pro.phase) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("AnyLink Pro").font(AL.Font.eyebrow).tracking(1.47).textCase(.uppercase)
                            .foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                        Text("Your library on iPhone and the web")
                            .font(AL.Font.sheetHero).tracking(-1.2)
                            .foregroundStyle(AL.ink)
                            .accessibilityAddTraits(.isHeader)
                    }
                    VStack(alignment: .leading, spacing: 12) {
                        ForEach(Self.benefits, id: \.symbol) { benefit in
                            Label { Text(benefit.text).font(AL.Font.lead).foregroundStyle(AL.ink) } icon: {
                                Image(systemName: benefit.symbol).foregroundStyle(AL.periwinkle).frame(width: symbolWidth)
                            }
                        }
                    }
                    plans
                    VStack(spacing: 8) {
                        Button { go(.buy) } label: {
                            if pro.phase == .buying || pro.phase == .confirming { ProgressView().tint(AL.onAccent) } else { Text("Continue") }
                        }
                        .buttonStyle(.alSignal)
                        .disabled(pro.options.isEmpty || busy)
                        if let status { Text(status).font(.footnote).foregroundStyle(AL.ink.opacity(AL.Ink.a75)).frame(maxWidth: .infinity) }
                        Button { go(.restore) } label: {
                            if pro.phase == .restoring { ProgressView() } else { Text("Restore purchases") }
                        }
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(AL.ink.opacity(AL.Ink.a60))
                        .frame(minHeight: AL.Control.md)
                        .disabled(busy)
                    }
                    .multilineTextAlignment(.center)
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Subscriptions renew automatically until you cancel in Settings › Apple Account › Subscriptions. Lifetime is paid once and includes about 1,000 AI saves a month.")
                            .font(.footnote).foregroundStyle(AL.ink.opacity(AL.Ink.a55))
                        HStack(spacing: 18) {
                            Link("Terms of Use", destination: Self.terms)
                            Link("Privacy Policy", destination: Self.privacy)
                        }
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(AL.ink.opacity(AL.Ink.a75))
                    }
                }
                .padding(24)
            }
            .background { ZStack { AL.canvas; Orbs(.sheet) }.ignoresSafeArea() }
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
        }
        .interactiveDismissDisabled(busy)
        .task { if pro.options.isEmpty && !pro.loading { await pro.load() } }
        .onDisappear { if !busy { pro.phase = .idle } }
        .onChange(of: pro.phase) { _, phase in
            guard phase == .done else { return }
            pro.phase = .idle
            store.toasts.show("You're on Pro")
            dismiss()
        }
        .sheet(item: $signingIn) { intent in
            ProSignInSheet {
                signingIn = nil
                start(intent)
            }
        }
    }

    @ViewBuilder
    private var plans: some View {
        if !pro.options.isEmpty {
            VStack(spacing: 10) {
                ForEach(pro.options) { option in planRow(option) }
            }
        } else if pro.loadFailed && !pro.loading {
            VStack(alignment: .leading, spacing: 10) {
                Text("Couldn't load prices. Check your connection and try again.")
                    .font(.footnote).foregroundStyle(AL.ink.opacity(AL.Ink.a75))
                Button("Try again") { Task { await pro.load() } }
                    .buttonStyle(ALSmallButtonStyle(.soft))
            }
        } else {
            ProgressView().frame(maxWidth: .infinity, minHeight: AL.Control.xl)
        }
    }

    private func planRow(_ option: ProStore.Option) -> some View {
        let on = selected == option.id
        return Button { selected = option.id } label: {
            HStack(spacing: 12) {
                Image(systemName: on ? "largecircle.fill.circle" : "circle")
                    .foregroundStyle(on ? AL.signal : AL.ink.opacity(AL.Ink.a40))
                Text(title(option.id)).font(AL.Font.rowTitle).foregroundStyle(AL.ink)
                Spacer()
                Text(price(option)).font(AL.Font.lead).foregroundStyle(AL.ink.opacity(AL.Ink.a75))
            }
            .padding(.horizontal, 16)
            .frame(minHeight: AL.Control.xl)
            .frosted(on ? 0.9 : 0.62, radius: AL.Radius.card)
            .overlay {
                RoundedRectangle(cornerRadius: AL.Radius.card, style: .continuous)
                    .strokeBorder(on ? AL.signal : .clear, lineWidth: 2)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(busy)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(on ? [.isSelected] : [])
    }

    private func title(_ id: String) -> LocalizedStringKey {
        switch id {
        case ProStore.monthly: "Monthly"
        case ProStore.lifetime: "Lifetime"
        default: "Yearly"
        }
    }

    private func price(_ option: ProStore.Option) -> LocalizedStringKey {
        switch option.id {
        case ProStore.monthly: "\(option.price) a month"
        case ProStore.lifetime: "\(option.price) once"
        default: "\(option.price) a year"
        }
    }

    private var status: LocalizedStringKey? {
        switch pro.phase {
        case .confirming: "Confirming your purchase…"
        case .pending: "Waiting for approval. Pro turns on as soon as the purchase is approved."
        case .failed: "The purchase didn't go through. Try again."
        case .unconfirmed: "Your purchase went through, but AnyLink couldn't confirm it yet. It tries again each time you open the app, or tap Restore purchases."
        case .nothingToRestore: "No AnyLink Pro purchase on this Apple Account."
        case .idle, .buying, .restoring, .done: nil
        }
    }

    private func go(_ intent: Intent) {
        if pro.isSignedIn { start(intent) } else { signingIn = intent }
    }

    /// Not tied to this view: a guest who just signed in swaps to their account's library, which closes the paywall,
    /// and the purchase carries on behind it.
    private func start(_ intent: Intent) {
        let pro = pro, id = selected
        Task {
            switch intent {
            case .buy: await pro.buy(id)
            case .restore: await pro.restore()
            }
        }
    }
}

/// The paywall's "Signed out" state: the Welcome sign-in buttons, then the purchase goes on.
private struct ProSignInSheet: View {
    let onSignedIn: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("Sign in to buy Pro").font(AL.Font.cardTitleL).foregroundStyle(AL.ink)
                    .accessibilityAddTraits(.isHeader)
                Text("Pro belongs to your AnyLink account, so it works on the web too.")
                    .font(AL.Font.lead).foregroundStyle(AL.ink.opacity(AL.Ink.a75))
                SignInButtons {
                    // A guest's library moves into the account (RootView), as with any sign-in.
                    UserDefaults.standard.set(true, forKey: "signedIn")
                    onSignedIn()
                }
                Spacer()
            }
            .padding(20)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Not now") { dismiss() } } }
        }
        .presentationDetents([.medium, .large])
    }
}

#if DEBUG
@MainActor
private func paywall(_ pro: ProStore) -> some View {
    let env = AppEnvironment.mock(latency: false)
    return Color.clear.sheet(isPresented: .constant(true)) { PaywallView() }
        .environment(env.store).environment(env.router).environment(pro)
}

#Preview("Paywall") { paywall(.preview()) }
#Preview("Paywall — Dark") { paywall(.preview()).preferredColorScheme(.dark) }
#Preview("Paywall — Loading") { paywall(.preview(options: [], loading: true)) }
#Preview("Paywall — Prices unavailable") { paywall(.preview(options: [], loadFailed: true)) }
#Preview("Paywall — Buying") { paywall(.preview(phase: .buying)) }
#Preview("Paywall — Confirming") { paywall(.preview(phase: .confirming)) }
#Preview("Paywall — Pending") { paywall(.preview(phase: .pending)) }
#Preview("Paywall — Failed") { paywall(.preview(phase: .failed)) }
#Preview("Paywall — Not confirmed") { paywall(.preview(phase: .unconfirmed)).preferredColorScheme(.dark) }
#Preview("Paywall — Restoring") { paywall(.preview(phase: .restoring)) }
#Preview("Paywall — Nothing to restore") { paywall(.preview(phase: .nothingToRestore)) }
#Preview("Paywall — Sign in first") {
    Color.clear.sheet(isPresented: .constant(true)) { ProSignInSheet {} }
}
#endif
