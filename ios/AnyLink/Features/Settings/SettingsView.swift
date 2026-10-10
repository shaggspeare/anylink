import SwiftUI
import DesignSystem
import Models
import Networking
import Fixtures
import Store
import Auth
import TipKit
import AppIntents

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

/// S18. System chrome (SF, inset-grouped list) per D4.
/// Ends the Supabase session and clears this account's library and outbox from the device; RootView
/// sees the flag and shows Welcome. Settings and the Collections avatar menu both call it.
@MainActor
func signOut(_ store: LibraryStore) async {
    try? await AuthService.client?.signOut()
    store.reset()
    UserDefaults.standard.set(false, forKey: "signedIn")
}

struct SettingsView: View {
    @Environment(LibraryStore.self) private var store
    @Environment(Router.self) private var router
    @Environment(\.openURL) private var openURL
    @AppStorage("appearance") private var appearance: Appearance = .system
    @AppStorage("openIn") private var openIn: OpenIn = .app
    @AppStorage(ClipboardWatcher.settingKey) private var clipboardSuggestions = true
    @AppStorage("defaultCollection") private var defaultCollection = "unsorted"
    @AppStorage("resetTipsOnLaunch") private var resetTips = false
    @AppStorage("signedIn") private var signedIn = true
    @AppStorage("guest") private var guest = false

    var body: some View {
        List {
            Section { account }
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
            if !guest {
                Section {
                    Button("Sign out") { Task { await signOut(store) } }
                    Button("Delete account…", role: .destructive) { router.confirm = .deleteAccount }
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
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var account: some View {
        HStack(spacing: 14) {
            Image(systemName: "person.fill")
                .font(.title2.weight(.semibold))
                .foregroundStyle(.white)
                .frame(width: 52, height: 52)
                .background(AL.periwinkle, in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                if guest {
                    Text("Trying AnyLink").font(.headline)
                    Button("Sign in or create an account") { router.sheet = .signUp }
                        .font(.footnote.weight(.semibold))
                } else {
                    Text(AuthService.client?.currentSession?.user.email ?? "Your account").font(.headline)
                    Text("\(store.live.count.linkCount) · \(synced)")
                        .font(.footnote).foregroundStyle(AL.ink.opacity(AL.Ink.a60))
                }
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: guest ? .contain : .combine)
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

#Preview("Settings") {
    let env = AppEnvironment.mock(latency: false)
    NavigationStack { SettingsView() }.environment(env.store).environment(env.router)
}

#Preview("Settings — Dark") {
    let env = AppEnvironment.mock(latency: false)
    NavigationStack { SettingsView() }.environment(env.store).environment(env.router).preferredColorScheme(.dark)
}
