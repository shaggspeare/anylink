import SwiftUI
import DesignSystem
import Models
import Networking
import Fixtures
import Persistence
import Store
import Auth
import TipKit
import AppIntents
import StoreKit

enum Appearance: String, CaseIterable, Identifiable {
    case system, light, dark
    var id: Self { self }
    var title: String { rawValue.capitalized }
    var scheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }
}

/// Ends the Supabase session. A server library's copy leaves the device with it, queued calls included; a local
/// library belongs to the device, not the account, and stays. RootView sees the flag and switches library.
@MainActor
func signOut(_ store: LibraryStore, mode: LibraryMode) async {
    try? await AuthService.client?.signOut()
    if mode == .server { store.reset() }
    UserDefaults.standard.set(false, forKey: "signedIn")
}

/// S18. System chrome (SF, inset-grouped list) per D4.
struct SettingsView: View {
    @Environment(LibraryStore.self) private var store
    @Environment(Router.self) private var router
    @Environment(\.openURL) private var openURL
    @AppStorage("appearance") private var appearance: Appearance = .system
    @AppStorage("openIn") private var openIn: OpenIn = .app
    @AppStorage(ClipboardWatcher.settingKey) private var clipboardSuggestions = true
    @AppStorage("defaultCollection") private var defaultCollection = "unsorted"
    @AppStorage("resetTipsOnLaunch") private var resetTips = false
    @AppStorage("signedIn") private var signedIn = false
    @AppStorage("plan") private var plan = ""
    @State private var displayName = ""
    @State private var managingSubscription = false
    /// Whether iCloud can sync a local library; nil while it checks.
    @State private var iCloud: Bool?
    private let asksICloud: Bool

    /// Previews set `iCloud` themselves and don't ask: they can't reach CloudKit. Neither can UI tests, whose library
    /// is in memory, so they show sync off.
    init(iCloud: Bool? = AppConfig.isUITesting ? false : nil, asksICloud: Bool = !AppConfig.isUITesting) {
        _iCloud = State(initialValue: iCloud)
        self.asksICloud = asksICloud
    }

    private var mode: LibraryMode { LibraryMode(signedIn: signedIn, plan: plan) }
    /// The plan of the library on screen. A local library has none, so it reads as Free.
    private var pro: Bool { store.isPro }

    var body: some View {
        List {
            Section { account }
            if mode == .local { iCloudSync }
            Section {
                proRow("AnyLink Pro", value: pro ? "Pro" : "Free", systemImage: "sparkles")
                proRow("Sync with web", value: pro ? "On" : "Pro", systemImage: "arrow.triangle.2.circlepath")
                if pro {
                    Button { managingSubscription = true } label: { row("Manage Subscription", systemImage: "creditcard") }
                }
            } header: {
                header("AnyLink Pro")
            }
            Section {
                TipView(ShareSheetTip())
                ShortcutsLink()
                    .shortcutsLinkStyle(.automaticOutline)
                    .frame(maxWidth: .infinity)
                Toggle(isOn: $clipboardSuggestions) { Text("Clipboard suggestions").fixedSize(horizontal: false, vertical: true) }
                .tint(AL.inStock)
                .onChange(of: clipboardSuggestions) { _, on in if !on { store.clipboardHasURL = false } }
                Picker(selection: $defaultCollection) {
                    ForEach(store.collections.filter { $0.isSmart != true }) { Text($0.name).tag($0.id) }
                } label: {
                    Text("New links go to").fixedSize(horizontal: false, vertical: true)
                }
            } header: {
                header("Capture")
            } footer: {
                // Was a row that only popped a toast; the how-to reads better as plain text.
                Text("To save from Safari, tap Share, scroll the app row, tap More and pin AnyLink.")
                    .foregroundStyle(AL.ink.opacity(AL.Ink.a60))
            }
            Section {
                HStack(spacing: 12) {
                    ForEach(Appearance.allCases) { a in
                        Button { appearance = a } label: { AppearanceThumb(appearance: a, selected: appearance == a) }
                            .buttonStyle(.plain)
                            .accessibilityLabel(a.title)
                            .accessibilityAddTraits(appearance == a ? .isSelected : [])
                    }
                }
                .padding(.vertical, 6)
                .sensoryFeedback(.selection, trigger: appearance)
            } header: { header("Appearance") }
            Section {
                Picker("Open links in", selection: $openIn) {
                    Text("AnyLink").tag(OpenIn.app)
                    Text("Safari").tag(OpenIn.safari)
                }
                Button {
                    resetTips = true   // TipKit resets its datastore on next launch (Tips.resetDatastore must run before configure).
                    store.toasts.show("Tips will show again.")
                } label: {
                    row("Show tips again", systemImage: "lightbulb")
                }
            } header: { header("Reading") }
            if signedIn { ExportSection() }
            if mode == .server {
                Section {
                    TextField("Not shown", text: $displayName)
                        .textContentType(.name)
                        .onSubmit(saveDisplayName)
                } header: {
                    header("Name on shared collections")
                }
            }
            if signedIn {
                Section {
                    Button("Sign out") { Task { await signOut(store, mode: mode) } }
                    // App Store 5.1.1(v): whoever is signed in can delete the account, on a local library too (S18).
                    Button("Delete account…", role: .destructive) { router.confirm = .deleteAccount(localLibrary: mode == .local) }
                }
            }
            Section {
                Link(destination: URL(string: "https://www.anylink.space/privacy-policy")!) {
                    row("Privacy Policy", systemImage: "hand.raised")
                }
            } footer: {
                Text(version).foregroundStyle(AL.ink.opacity(AL.Ink.a60)).frame(maxWidth: .infinity).padding(.top, 8)
            }
        }
        .tint(AL.ink)
        .manageSubscriptionsSheet(isPresented: $managingSubscription)
        .onAppear { displayName = store.displayName ?? "" }
        .onDisappear(perform: saveDisplayName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            // Same bar title as the other tab roots.
            ToolbarItem(placement: .topBarLeading) {
                Text("Profile")
                    .font(AL.Font.largeTitle).tracking(-1.65)
                    .foregroundStyle(AL.ink)
                    .fixedSize()
                    .padding(.trailing, 4).drawingGroup()
                    .accessibilityAddTraits(.isHeader)
            }
            .sharedBackgroundVisibility(.hidden)
        }
    }

    @ViewBuilder
    private var account: some View {
        if signedIn {
            accountCard.accessibilityElement(children: .combine)
        } else {
            // Signed out, the whole card is the Sign in button: a target far past 44 pt.
            Button { router.sheet = .signIn } label: { accountCard.contentShape(Rectangle()) }
                .buttonStyle(.plain)
                .accessibilityElement(children: .combine)
        }
    }

    private var accountCard: some View {
        HStack(spacing: 14) {
            Image(systemName: "person.fill")
                .font(.title2.weight(.semibold))
                .foregroundStyle(.white)
                .frame(width: 52, height: 52)
                .background(AL.periwinkle, in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                if signedIn {
                    Text(AuthService.client?.currentSession?.user.email ?? "Your account").font(.headline)
                } else {
                    Text("Your library").font(.headline)
                }
                Group {
                    if mode == .server { Text("\(store.live.count.linkCount) · \(synced)") } else { Text(store.live.count.linkCount) }
                }
                .font(.footnote).foregroundStyle(AL.ink.opacity(AL.Ink.a60))
                if !signedIn {
                    Text("Sign in").font(.footnote.weight(.semibold)).foregroundStyle(AL.ink)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 4)
    }

    /// A local library syncs through the user's iCloud, when there is one (S18).
    private var iCloudSync: some View {
        Section {
            LabeledContent {
                Group {
                    switch iCloud {
                    case true?: Text("On")
                    case false?: Text("Off")
                    case nil: EmptyView()
                    }
                }
                .foregroundStyle(AL.ink.opacity(AL.Ink.a60))   // the system grey is under 4.5:1 on a light row
            } label: {
                Label("iCloud sync", systemImage: "icloud").foregroundStyle(.primary)
            }
        } footer: {
            Group {
                switch iCloud {
                case true?: Text("Your library syncs between your Apple devices through iCloud. AnyLink's server never stores it.")
                case false?: Text("iCloud isn't available, so saves stay on this iPhone. Sign in to iCloud in the Settings app to sync your other devices.")
                case nil: EmptyView()
                }
            }
            .foregroundStyle(AL.ink.opacity(AL.Ink.a60))
        }
        .task { if asksICloud { iCloud = await LocalStore.iCloudAvailable() } }
    }

    private func saveDisplayName() {
        guard mode == .server, displayName.trimmingCharacters(in: .whitespaces) != (store.displayName ?? "") else { return }
        Task { await store.setDisplayName(displayName) }
    }

    /// Section headers at the raised secondary alpha: the system grey sits just under 4.5:1 here.
    private func header(_ t: String) -> some View {
        Text(t).foregroundStyle(AL.ink.opacity(AL.Ink.a60))
    }

    private var synced: String {
        store.lastSynced.map { "synced \($0.formatted(.relative(presentation: .named)))" } ?? "not synced yet"
    }

    private func row(_ title: String, systemImage: String) -> some View {
        Label(title, systemImage: systemImage).foregroundStyle(.primary).frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Shows where Pro stands; on Free it opens the paywall (S19).
    @ViewBuilder
    private func proRow(_ title: LocalizedStringKey, value: LocalizedStringKey, systemImage: String) -> some View {
        let content = LabeledContent { Text(value) } label: { Label(title, systemImage: systemImage).foregroundStyle(.primary) }
        if pro {
            content
        } else {
            Button { router.sheet = .paywall } label: { content }
        }
    }

    private var version: String {
        let info = Bundle.main.infoDictionary
        let v = info?["CFBundleShortVersionString"] as? String ?? "–"
        let b = info?["CFBundleVersion"] as? String ?? "–"
        return "AnyLink \(v) (\(b))"
    }
}

private struct AppearanceThumb: View {
    let appearance: Appearance
    let selected: Bool

    var body: some View {
        VStack(spacing: 6) {
            ZStack {
                switch appearance {
                case .light: half(.light)
                case .dark: half(.dark)
                case .system:
                    HStack(spacing: 0) { half(.light); half(.dark) }
                }
            }
            .frame(height: 64)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(selected ? AL.signal : AL.ink.opacity(AL.Ink.a12), lineWidth: selected ? 2.5 : 1))
            Text(appearance.title).font(.footnote).foregroundStyle(selected ? .primary : .secondary)
        }
        .frame(maxWidth: .infinity)
    }

    private func half(_ scheme: ColorScheme) -> some View {
        ZStack(alignment: .topLeading) {
            AL.canvas
            VStack(alignment: .leading, spacing: 4) {
                RoundedRectangle(cornerRadius: 3).fill(AL.ink).frame(width: 26, height: 5)
                RoundedRectangle(cornerRadius: 5).fill(AL.paper).frame(height: 22)
            }
            .padding(8)
        }
        .environment(\.colorScheme, scheme)
    }
}

/// Settings as one library mode sees it, on defaults of its own so previews don't share sign-in state. A local
/// library has no plan, so it reads as Free.
@MainActor
private func settingsPreview(signedIn: Bool, plan: String, iCloud: Bool? = nil) -> some View {
    let server = LibraryMode(signedIn: signedIn, plan: plan) == .server
    let env = AppEnvironment.mock(latency: false, plan: server ? "pro" : "free")
    let defaults = UserDefaults(suiteName: "preview.settings.\(signedIn).\(plan)")!
    defaults.set(signedIn, forKey: "signedIn")
    defaults.set(plan, forKey: "plan")
    return NavigationStack { SettingsView(iCloud: iCloud, asksICloud: false) }
        .environment(env.store).environment(env.router)
        .defaultAppStorage(defaults)
}

#Preview("Settings") { settingsPreview(signedIn: true, plan: "pro") }
#Preview("Settings — Dark") { settingsPreview(signedIn: true, plan: "pro").preferredColorScheme(.dark) }
#Preview("Local, iCloud on") { settingsPreview(signedIn: false, plan: "", iCloud: true) }
#Preview("Local, no iCloud — Dark") { settingsPreview(signedIn: false, plan: "", iCloud: false).preferredColorScheme(.dark) }
#Preview("Local, checking iCloud") { settingsPreview(signedIn: false, plan: "") }
#Preview("Free account — Dark") { settingsPreview(signedIn: true, plan: "free", iCloud: true).preferredColorScheme(.dark) }
