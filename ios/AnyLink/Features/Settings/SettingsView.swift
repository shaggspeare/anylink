import SwiftUI
import DesignSystem
import Models
import Networking
import Fixtures
import Store

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

    var body: some View {
        List {
            Section { account }
            Section("Capture") {
                Button {
                    store.toasts.show("In Safari, tap Share, scroll the app row, tap More and pin AnyLink.")
                } label: {
                    row("Share sheet", systemImage: "square.and.arrow.up")
                }
                Button {
                    if let url = URL(string: "shortcuts://") { openURL(url) }
                } label: {
                    row("Siri & Shortcuts", detail: "“Save to AnyLink”", systemImage: "waveform")
                }
                Toggle(isOn: $clipboardSuggestions) {
                    Label("Clipboard suggestions", systemImage: "doc.on.clipboard")
                }
                .tint(AL.inStock)
                .onChange(of: clipboardSuggestions) { _, on in if !on { store.clipboardHasURL = false } }
                Picker(selection: $defaultCollection) {
                    ForEach(store.collections.filter { $0.isSmart != true }) { Text($0.name).tag($0.id) }
                } label: {
                    Label("New links go to", systemImage: "tray")
                }
            }
            Section("Appearance") {
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
            }
            Section("Reading") {
                Picker(selection: $openIn) {
                    Text("AnyLink").tag(OpenIn.app)
                    Text("Safari").tag(OpenIn.safari)
                } label: {
                    Label("Open links in", systemImage: "safari")
                }
                Button {
                    resetTips = true   // TipKit (phase 13) resets its datastore on next launch.
                    store.toasts.show("Tips will show again.")
                } label: {
                    row("Show tips again", systemImage: "lightbulb")
                }
            }
            Section {
                Button("Sign out") { signedIn = false }
                Button("Delete account…", role: .destructive) { router.confirm = .deleteAccount }
            }
            Section {
                EmptyView()
            } footer: {
                Text(version).frame(maxWidth: .infinity).padding(.top, 8)
            }
        }
        .tint(AL.ink)
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var account: some View {
        HStack(spacing: 14) {
            Image(systemName: "person.fill")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 52, height: 52)
                .background(AL.periwinkle, in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text("Your account").font(.headline)
                Text("Apple ID · \(store.live.count) links · \(synced)")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }

    private var synced: String {
        store.lastSynced.map { "synced \($0.formatted(.relative(presentation: .named)))" } ?? "not synced yet"
    }

    private func row(_ title: String, detail: String? = nil, systemImage: String) -> some View {
        HStack {
            Label(title, systemImage: systemImage).foregroundStyle(.primary)
            Spacer()
            if let detail { Text(detail).foregroundStyle(.secondary) }
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

#Preview("Settings") {
    let env = AppEnvironment.mock(latency: false)
    NavigationStack { SettingsView() }.environment(env.store).environment(env.router)
}

#Preview("Settings — Dark") {
    let env = AppEnvironment.mock(latency: false)
    NavigationStack { SettingsView() }.environment(env.store).environment(env.router).preferredColorScheme(.dark)
}
