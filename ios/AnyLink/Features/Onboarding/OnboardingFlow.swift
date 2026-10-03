import SwiftUI
import UniformTypeIdentifiers
import DesignSystem
import Models
import Networking
import Fixtures
import Store

/// S2–S5.
struct OnboardingFlow: View {
    let onFinish: () -> Void
    @Environment(LibraryStore.self) private var store
    @State private var model: OnboardingModel
    @State private var picking: OnboardingModel.Source?

    init(store: LibraryStore, onFinish: @escaping () -> Void) {
        _model = State(initialValue: OnboardingModel(store: store))
        self.onFinish = onFinish
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            Group {
                switch model.step {
                case .importFiles: importStep
                case .clean: cleanStep
                case .keepOrBin: keepOrBinStep
                case .focus: question(
                    "What are you working on right now?",
                    text: $model.focus, avoid: false, button: "Next") { model.step = .avoid }
                case .avoid: question(
                    "Anything you'd rather never see again?",
                    text: $model.avoid, avoid: true, button: "Build my collections") { Task { await model.buildCollections() } }
                case .grouping: grouping
                case .result: resultStep
                }
            }
            .transition(.opacity)
            .animation(AL.Motion.sheet, value: model.step)
        }
        .background { ZStack { AL.canvas; Orbs(.addLink) }.ignoresSafeArea() }
        .fileImporter(
            isPresented: Binding(get: { picking != nil }, set: { if !$0 { picking = nil } }),
            allowedContentTypes: [.html, .json],
            allowsMultipleSelection: true
        ) { result in
            guard let source = picking, case .success(let urls) = result else { return }
            for url in urls {
                let scoped = url.startAccessingSecurityScopedResource()
                defer { if scoped { url.stopAccessingSecurityScopedResource() } }
                if let data = try? Data(contentsOf: url) { model.load(data, named: url.lastPathComponent, as: source) }
            }
        }
    }

    // MARK: Header

    private var header: some View {
        HStack(spacing: 6) {
            ForEach(0..<4, id: \.self) { i in
                Capsule()
                    .fill(i == model.step.indicator ? AL.signal : AL.ink.opacity(i < model.step.indicator ? AL.Ink.a40 : 0.15))
                    .frame(width: i == model.step.indicator ? 22 : 8, height: 4)
            }
            Text("\(model.step.indicator + 1) of 4")
                .font(.footnote).foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                .padding(.leading, 6)
            Spacer()
            if model.step == .importFiles {
                Button("Skip", action: onFinish).font(.subheadline).foregroundStyle(AL.ink.opacity(AL.Ink.a60))
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Step \(model.step.indicator + 1) of 4")
        .padding(.horizontal, 20)
        .frame(height: 44)
    }

    private func title(_ t: String, lead: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(t).font(AL.Font.largeTitle).tracking(-1.65).foregroundStyle(AL.ink).accessibilityAddTraits(.isHeader)
            if let lead { Text(lead).font(AL.Font.lead).foregroundStyle(AL.ink.opacity(AL.Ink.a60)) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: S2 Import

    private var importStep: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                title("Bring your links", lead: "Your exports go only into your own library. Dead links get stripped out next.")
                sourceCard(.bookmarks, icon: "book", name: "Browser bookmarks", subtitle: "Chrome, Safari, Firefox, Arc — any HTML export",
                           steps: ["Open the bookmark manager", "Export bookmarks → HTML file", "AirDrop it to this iPhone"])
                sourceCard(.telegram, icon: "paperplane", name: "Telegram Saved Messages", subtitle: "Message text is kept as context",
                           steps: ["Telegram Desktop → Saved Messages", "⋮ → Export chat history → format JSON", "AirDrop result.json to this iPhone"])
                Label("Exports usually live on your computer. AirDrop them here, or save them to iCloud Drive — they show up in Files.", systemImage: "info.circle")
                    .font(.footnote).foregroundStyle(AL.ink.opacity(AL.Ink.a55))
                #if DEBUG
                if AppConfig.isUITesting || model.files.isEmpty {
                    Button("Load sample exports") {
                        model.load(Fixtures.sample("sample-bookmarks.html"), named: "bookmarks_10_3_26.html", as: .bookmarks)
                        model.load(Fixtures.sample("sample-telegram.json"), named: "result.json", as: .telegram)
                    }
                    .font(.footnote).foregroundStyle(AL.periwinkle)
                }
                #endif
            }
            .padding(20)
        }
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 4) {
                if let e = model.importError { Notice(e) }
                let n = model.merged.count
                Button(n == 0 ? "Choose a file to import" : "Import \(n.formatted()) links") { Task { await model.runImport() } }
                    .buttonStyle(.alPrimary)
                    .disabled(n == 0 || model.isImporting)
                Button("Start with an empty library", action: onFinish)
                    .font(.subheadline).foregroundStyle(AL.ink.opacity(AL.Ink.a60))
                    .frame(minHeight: 44)
            }
            .padding(.horizontal, 20)
            .background(.bar.opacity(0))
        }
    }

    private func sourceCard(_ source: OnboardingModel.Source, icon: String, name: String, subtitle: String, steps: [String]) -> some View {
        let chosen = model.files[source]
        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .semibold)).foregroundStyle(AL.ink)
                    .frame(width: 40, height: 40)
                    .background(AL.ink.opacity(AL.Ink.a06), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text(name).font(AL.Font.brand(15, .semibold, relativeTo: .subheadline)).foregroundStyle(AL.ink)
                    Text(subtitle).font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a55))
                }
            }
            if let chosen {
                HStack {
                    Text("✓ \(chosen.name) · \(chosen.items.count.formatted()) links")
                        .font(AL.Font.chip).foregroundStyle(AL.onAccent).lineLimit(1)
                    Spacer()
                    Button { model.remove(source) } label: { Image(systemName: "xmark").font(.caption.weight(.bold)) }
                        .foregroundStyle(AL.onAccent)
                        .frame(width: AL.Control.md, height: 32)
                        .accessibilityLabel("Remove \(chosen.name)")
                }
                .padding(.leading, 12)
                .background(AL.lime.opacity(0.38), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(Array(steps.enumerated()), id: \.offset) { i, s in
                        Text("\(i + 1). \(s)").font(.footnote).foregroundStyle(AL.ink.opacity(AL.Ink.a65))
                    }
                }
                Button("Choose file") { picking = source }
                    .buttonStyle(ALSmallButtonStyle(.ink))
            }
            if let e = model.fileErrors[source] { Notice(e) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .frosted(0.62, radius: 22)
        .overlay {
            if chosen != nil { RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(AL.ink, lineWidth: 2) }
        }
    }

    // MARK: S3 Clean

    private var cleanStep: some View {
        ScrollView {
            VStack(spacing: 20) {
                title("Checking what still exists")
                ZStack {
                    Circle().stroke(AL.ink.opacity(0.07), lineWidth: 12)
                    Circle()
                        .trim(from: 0, to: model.total == 0 ? 0 : CGFloat(model.checked) / CGFloat(model.total))
                        .stroke(AL.lime, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .animation(AL.Motion.progress, value: model.checked)
                    VStack(spacing: 2) {
                        Text(model.checked.formatted()).font(AL.Font.brand(40, .semibold, relativeTo: .largeTitle)).monospacedDigit()
                        Text("of \(model.total.formatted()) checked").font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a55))
                    }
                }
                .frame(width: 176, height: 176)
                .accessibilityElement(children: .combine)
                HStack(spacing: 8) {
                    if model.checkDone {
                        Image(systemName: "checkmark.circle.fill").foregroundStyle(AL.inStock)
                        Text("Every link answered or was flagged")
                    } else {
                        Circle().fill(AL.signal).frame(width: 8, height: 8)
                        Text("You can leave — we'll keep checking")
                    }
                }
                .font(.footnote)
                .padding(.horizontal, 14).frame(height: 36)
                .glassEffect(.regular, in: .capsule)
                VStack(alignment: .leading, spacing: 8) {
                    Text("Found so far").font(AL.Font.rowTitle).foregroundStyle(AL.ink)
                    VStack(spacing: 0) {
                        deadRow(.gone, "Gone", "404 or 410 — the page no longer exists")
                        Divider().padding(.leading, 48)
                        deadRow(.parked, "Parked domains", "The domain is for sale now")
                        Divider().padding(.leading, 48)
                        deadRow(.noAnswer, "No answer", "Often a temporary outage — kept by default")
                    }
                    .frosted(0.62, radius: 18)
                }
            }
            .padding(20)
        }
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 4) {
                Button(model.trashCount == 0 ? "Continue" : "Move \(model.trashCount) to Trash") { model.trashSelectedAndContinue() }
                    .buttonStyle(.alPrimary)
                Button("Keep them all for now") { model.keepAllAndContinue() }
                    .font(.subheadline).foregroundStyle(AL.ink.opacity(AL.Ink.a60))
                    .frame(minHeight: 44)
            }
            .padding(.horizontal, 20)
        }
        .task { if !model.checkDone { await model.runCheck() } }
    }

    private func deadRow(_ g: OnboardingModel.DeadGroup, _ name: String, _ detail: String) -> some View {
        let on = model.selectedGroups.contains(g)
        return Button {
            if on { model.selectedGroups.remove(g) } else { model.selectedGroups.insert(g) }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: on ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22)).foregroundStyle(on ? AL.ink : AL.ink.opacity(AL.Ink.a30))
                VStack(alignment: .leading, spacing: 2) {
                    Text(name).font(AL.Font.rowTitle).foregroundStyle(AL.ink)
                    Text(detail).font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a55))
                }
                Spacer()
                Text("\(model.links(in: g).count)").font(.subheadline.monospacedDigit()).foregroundStyle(AL.ink.opacity(AL.Ink.a60))
            }
            .padding(.horizontal, 14).frame(minHeight: 60)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
        .sensoryFeedback(.selection, trigger: on)
    }

    // MARK: S4 Keep or bin

    private var keepOrBinStep: some View {
        VStack(spacing: 16) {
            title("Keep or bin?", lead: "\(min(model.sampleIndex + 1, OnboardingModel.sampleSize)) of \(model.sample.count) · sampled across your sites")
                .padding(.horizontal, 20)
            SwipeCardStack(
                items: Array(model.remainingSample.prefix(2)),
                rightStamp: { _ in "Keep" }, leftStamp: "Bin", showsButtons: false,
                onCommit: { link, dir in dir == .right ? model.keep(link) : model.bin(link) },
                card: { SampleCard(link: $0) }
            )
            .padding(.horizontal, 30)
            Spacer(minLength: 0)
            if let link = model.remainingSample.first {
                HStack(spacing: 48) {
                    bigButton("Bin", system: "xmark", fill: AL.ink, fg: AL.onInk) { model.bin(link) }
                    bigButton("Keep", system: "checkmark", fill: AL.lime, fg: AL.onAccent) { model.keep(link) }
                }
            }
            Text("Swipe right to keep, left to bin.\nBinned links go to Trash, not away forever.")
                .font(.footnote).multilineTextAlignment(.center).foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                .padding(.bottom, 8)
        }
        .onAppear { if model.sample.isEmpty { model.prepareSample(); if model.sample.isEmpty { model.step = .focus } } }
    }

    private func bigButton(_ label: String, system: String, fill: Color, fg: Color, action: @escaping () -> Void) -> some View {
        VStack(spacing: 6) {
            Button(action: action) {
                Image(systemName: system).font(.system(size: 24, weight: .bold)).foregroundStyle(fg)
                    .frame(width: 64, height: 64).background(fill, in: Circle())
            }
            .accessibilityLabel(label)
            Text(label).font(.footnote).foregroundStyle(AL.ink.opacity(AL.Ink.a60)).accessibilityHidden(true)
        }
    }

    // MARK: Questions

    private func question(_ q: String, text: Binding<String>, avoid: Bool, button: String, next: @escaping () -> Void) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                title(q)
                FlowLayout(spacing: 8) {
                    ForEach(model.suggestionChips, id: \.self) { chip in
                        Button { model.pick(chip, forAvoid: avoid) } label: { ScopeChip(chip) }
                            .buttonStyle(.plain)
                    }
                }
                TextField(avoid ? "e.g. crypto, celebrity news" : "e.g. a talk on Rust async", text: text, axis: .vertical)
                    .font(.system(size: 16))
                    .lineLimit(2...4)
                    .padding(14)
                    .background(AL.ink.opacity(AL.Ink.a06), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                if avoid, let e = model.groupError { Notice(e) }
            }
            .padding(20)
        }
        .safeAreaInset(edge: .bottom) {
            Button(button, action: next).buttonStyle(.alPrimary).padding(.horizontal, 20).padding(.bottom, 8)
        }
    }

    // MARK: S5 Grouping + result

    private var grouping: some View {
        VStack(spacing: 18) {
            Spacer()
            ProgressView().controlSize(.large).tint(AL.signal)
            Text("Building your collections").font(AL.Font.title).foregroundStyle(AL.ink)
            Text("Reading every title against what you just told us. About twenty seconds.")
                .font(AL.Font.lead).foregroundStyle(AL.ink.opacity(AL.Ink.a60)).multilineTextAlignment(.center)
            Spacer()
        }
        .padding(30)
    }

    private var resultStep: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                title("We made \(model.results.count) collections", lead: "Based on what you told us. Bin any that miss.")
                ForEach(model.results, id: \.collection.id) { r in resultCard(r) }
            }
            .padding(20)
            .padding(.bottom, 120)
        }
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 10) {
                Text("\(model.keptCount) kept · \(model.binnedCollections.count) binned — \(model.linksBackToUnsorted) links go back to Unsorted")
                    .font(.footnote).foregroundStyle(AL.ink.opacity(AL.Ink.a60))
                Button("Open my library") { model.finish(); onFinish() }
                    .buttonStyle(.alPrimary)
            }
            .padding(16)
            .glassEffect(.regular, in: .rect(cornerRadius: 26))
            .padding(.horizontal, 12)
        }
    }

    private func resultCard(_ r: GroupedResult) -> some View {
        let binned = model.binnedCollections.contains(r.collection.id)
        let samples = r.linkIds.prefix(3).compactMap { store.link($0) }
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Circle().fill(Color.fromHex(r.collection.color)).frame(width: 10, height: 10)
                Text(r.collection.name).font(AL.Font.brand(16, .semibold, relativeTo: .headline)).foregroundStyle(AL.ink)
                Spacer()
                Text("\(r.linkIds.count)").font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a50))
            }
            Text(binned ? "Binned — its \(r.linkIds.count) links go back to Unsorted." : r.reasoning)
                .font(AL.Font.chip).foregroundStyle(AL.ink.opacity(AL.Ink.a55))
            ForEach(samples) { l in
                HStack(spacing: 8) {
                    InitialBadge(link: l, size: 18)
                    Text(l.title).font(AL.Font.body).foregroundStyle(AL.ink).lineLimit(1)
                }
            }
            KeepBinSegment(isKeep: Binding(get: { !binned }, set: { keep in if keep == binned { model.toggleBin(r.collection.id) } }))
        }
        .padding(16)
        .frosted(0.62, radius: 22)
        .opacity(binned ? 0.6 : 1)
        .animation(AL.Motion.settle, value: binned)
    }
}

private struct SampleCard: View {
    let link: LinkItem
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HeroImage(link: link).frame(height: 170).clipShape(RoundedRectangle(cornerRadius: 19, style: .continuous))
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    InitialBadge(link: link, size: 18)
                    Text(link.domain).font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                }
                Text(link.title).font(AL.Font.cardTitleL).tracking(-0.72).foregroundStyle(AL.ink).lineLimit(3)
                if let c = context { Text(c).font(AL.Font.body).foregroundStyle(AL.ink.opacity(AL.Ink.a60)).lineLimit(2) }
                if let d = link.importMeta?.savedAt.flatMap(DateSections.date) {
                    Text("Saved \(d.formatted(date: .abbreviated, time: .omitted))").font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                }
            }
            .padding(.horizontal, 8).padding(.bottom, 12)
        }
        .padding(8)
        .accessibilityElement(children: .combine)
    }

    private var context: String? {
        if let f = link.importMeta?.folder { return f }
        if let c = link.importMeta?.context { return "Telegram · “\(c)”" }
        return nil
    }
}

#Preview("Onboarding") {
    let env = AppEnvironment.mock(latency: false)
    OnboardingFlow(store: env.store) {}.environment(env.store).environment(env.router)
}

#Preview("Onboarding — Dark") {
    let env = AppEnvironment.mock(latency: false)
    OnboardingFlow(store: env.store) {}.environment(env.store).environment(env.router).preferredColorScheme(.dark)
}
