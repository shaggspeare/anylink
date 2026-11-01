import SwiftUI
import DesignSystem

/// S20. The upgrade: the local library moving into the server library, over everything until it's done. Not a sheet,
/// so it can show while the paywall closes.
struct UpgradeView: View {
    enum Phase: Equatable {
        /// `total` 0: not counted yet.
        case moving(done: Int, total: Int)
        case failed
    }

    let phase: Phase
    let retry: () -> Void
    let later: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Spacer()
            Text("AnyLink Pro").font(AL.Font.eyebrow).tracking(1.47).textCase(.uppercase)
                .foregroundStyle(AL.ink.opacity(AL.Ink.a50))
            Group {
                if phase == .failed { Text("Your library didn't finish moving") } else { Text("Moving your library to AnyLink Pro…") }
            }
            .font(AL.Font.sheetHero).tracking(-1.2)
            .foregroundStyle(AL.ink)
            .accessibilityAddTraits(.isHeader)
            if case .moving(let done, let total) = phase {
                if total > 0 {
                    VStack(alignment: .leading, spacing: 6) {
                        ProgressView(value: Double(done), total: Double(total)).tint(AL.signal)
                        Text("\(done) of \(total)").font(.footnote).foregroundStyle(AL.ink.opacity(AL.Ink.a60))
                    }
                    .accessibilityElement(children: .combine)
                } else {
                    ProgressView()
                }
            }
            Group {
                if phase == .failed {
                    Text("Check your connection and try again. It carries on where it stopped.")
                } else {
                    Text("Your links, collections, notes and highlights are joining your library on the web. This iPhone keeps its own copy too.")
                }
            }
            .font(AL.Font.lead)
            .foregroundStyle(AL.ink.opacity(AL.Ink.a75))
            .fixedSize(horizontal: false, vertical: true)
            if phase == .failed {
                VStack(spacing: 8) {
                    Button("Try again", action: retry).buttonStyle(.alSignal)
                    Button("Later", action: later)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(AL.ink.opacity(AL.Ink.a60))
                        .frame(maxWidth: .infinity, minHeight: AL.Control.md)
                }
            }
            Spacer()
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .background { ZStack { AL.canvas; Orbs(.sheet) }.ignoresSafeArea() }
        // The library underneath can't be touched meanwhile, so VoiceOver stays here too.
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.isModal)
    }
}

#Preview("Moving") { UpgradeView(phase: .moving(done: 120, total: 340), retry: {}, later: {}) }
#Preview("Moving — Dark") { UpgradeView(phase: .moving(done: 120, total: 340), retry: {}, later: {}).preferredColorScheme(.dark) }
#Preview("Counting") { UpgradeView(phase: .moving(done: 0, total: 0), retry: {}, later: {}) }
#Preview("Failed") { UpgradeView(phase: .failed, retry: {}, later: {}) }
#Preview("Failed — Dark") { UpgradeView(phase: .failed, retry: {}, later: {}).preferredColorScheme(.dark) }
