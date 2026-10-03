import SwiftUI
import DesignSystem
import Models
import Store

/// S9.
struct ShareView: View {
    @State var session: ShareSession
    let close: () -> Void
    @State private var note = ""
    @State private var pulse = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            switch session.mode {
            case .signedOut:
                message("Open AnyLink once to sign in, then share again.", system: "person.crop.circle.badge.exclamationmark")
            case .noLink:
                message("There's no link in what you shared.", system: "link.badge.plus")
            default:
                saved
            }
            Spacer(minLength: 0)
            Button("Done") {
                Task {
                    await session.finish(note: note)
                    close()
                }
            }
            .buttonStyle(.alPrimary)
        }
        .padding(20)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background { ZStack { AL.canvas; Orbs(.sheet) }.ignoresSafeArea() }
        .sensoryFeedback(.success, trigger: session.mode == .saved || session.mode == .pending)
    }

    @ViewBuilder
    private var saved: some View {
        HStack(spacing: 14) {
            Image(systemName: "checkmark")
                .font(.system(size: 20, weight: .bold)).foregroundStyle(AL.onAccent)
                .frame(width: 48, height: 48).background(AL.lime, in: Circle())
                .opacity(session.mode == .saving ? 0.4 : 1)
            VStack(alignment: .leading, spacing: 2) {
                Text(session.mode == .saving ? "Saving…" : session.headline)
                    .font(AL.Font.title).tracking(-0.66).foregroundStyle(AL.ink)
                Text("You can close this — it's already in your library.")
                    .font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a55))
            }
        }
        .accessibilityElement(children: .combine)

        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                let id = AL.identity(for: session.domain ?? "?")
                HeroFallback(tint: Color(hex: id.tint), stripe: Color(hex: id.stripe), band: 4, gap: 8)
                    .frame(width: 52, height: 52)
                    .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text(session.domain ?? "").font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                    Text(session.saved?.title ?? session.title ?? session.url?.absoluteString ?? "")
                        .font(AL.Font.rowTitle).foregroundStyle(AL.ink).lineLimit(2)
                }
            }
            HStack(spacing: 6) {
                switch session.mode {
                case .pending:
                    Image(systemName: "icloud.and.arrow.up").foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                    Text("Saved — it will sync when you're online.")
                case .saved where session.crawlDone:
                    Image(systemName: "checkmark").foregroundStyle(AL.inStock)
                    Text("Summary and tags added")
                default:
                    Circle().fill(AL.signal).frame(width: 7, height: 7).opacity(pulse ? 0.3 : 1)
                        .onAppear { if !reduceMotion { withAnimation(.easeInOut(duration: 0.7).repeatForever()) { pulse = true } } }
                    Text("Summary and tags are on the way")
                }
            }
            .font(.footnote).foregroundStyle(AL.ink.opacity(AL.Ink.a65))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .frosted(0.62, radius: 18)

        if !session.recent.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("Move to").font(.footnote).foregroundStyle(AL.ink.opacity(AL.Ink.a55))
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(session.recent) { c in
                            Button { Task { await session.move(to: c) } } label: {
                                ScopeChip(c.name, isSelected: session.collection?.id == c.id)
                            }
                            .buttonStyle(.plain)
                            .disabled(session.mode == .saving)
                        }
                    }
                }
            }
        }

        ALField("Add a note (optional)", text: $note)
    }

    private func message(_ text: String, system: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: system).font(.system(size: 30)).foregroundStyle(AL.ink.opacity(AL.Ink.a50))
            Text(text).font(AL.Font.lead).foregroundStyle(AL.ink).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
    }
}
