import SwiftUI
import Charts
import DesignSystem
import Models
import Networking
import Fixtures
import Store

struct LinkDetailView: View {
    let id: LinkItem.ID
    @Environment(LibraryStore.self) private var store

    var body: some View {
        if let link = store.link(id) {
            if link.isNote {
                NoteView(link: link)
            } else if link.isImage {
                ImageDetailView(link: link)
            } else if link.contentType == .product, link.product != nil {
                ProductView(link: link)
            } else {
                ReaderView(link: link)
            }
        } else {
            ContentUnavailableView("This link is gone", systemImage: "link")
        }
    }
}

/// S16.
struct ProductView: View {
    let link: LinkItem
    @Environment(LibraryStore.self) private var store
    @Environment(Router.self) private var router
    @State private var range: PriceRange = .all
    @State private var alertText = ""
    @State private var showAllSpecs = false
    @FocusState private var alertFocused: Bool

    private var product: ProductDetails { link.product! }
    private var summary: PriceSummary { PriceSummary(product) }
    private var url: URL? { URL(string: link.url) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                imageCard
                retailerRow
                Text(link.title)
                    .font(AL.Font.productTitle).tracking(-0.9)
                    .foregroundStyle(AL.ink)
                    .accessibilityAddTraits(.isHeader)
                priceRow
                if let meta { Text(meta).font(.footnote).foregroundStyle(AL.ink.opacity(AL.Ink.a55)) }
                priceCard
                if !product.specs.isEmpty { specsCard }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 40)
        }
        .background { ZStack { AL.canvas; Orbs(.product) }.ignoresSafeArea() }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { toolbar }
        .onAppear { alertText = product.alertThreshold.map { String(Int($0)) } ?? "" }
        .onChange(of: alertFocused) { _, focused in if !focused { commitAlert() } }
    }

    // MARK: Header

    private var imageCard: some View {
        HeroImage(link: link)
            .frame(height: 260)
            .frame(maxWidth: .infinity)
            .background(.white)
            .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
            .alShadow(AL.Shadow.popover)
            .accessibilityHidden(true)
    }

    private var retailerRow: some View {
        HStack(spacing: 8) {
            InitialBadge(initial: product.retailerInitial, tint: .fromHex(product.retailerColor), stripe: .white, size: 20)
            Text(link.domain).font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a60))
            Spacer()
            if product.inStock == true {
                HStack(spacing: 5) {
                    Circle().fill(AL.inStock).frame(width: 6, height: 6)
                    Text("In stock")
                }
                .font(AL.Font.chip).foregroundStyle(AL.inStock)
                .padding(.horizontal, 10).frame(height: 26)
                .background(AL.inStockFill, in: Capsule())
            } else if product.inStock == false {
                Text("Out of stock")
                    .font(AL.Font.chip).foregroundStyle(AL.ink.opacity(AL.Ink.a60))
                    .padding(.horizontal, 10).frame(height: 26)
                    .background(AL.ink.opacity(AL.Ink.a06), in: Capsule())
            }
        }
    }

    private var priceRow: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            if let current = summary.current {
                Text(PriceSummary.format(current, product.currency))
                    .font(AL.Font.price).tracking(-1.4).monospacedDigit()
                    .foregroundStyle(AL.ink)
            }
            if let pct = summary.percentSinceSaved {
                Text("−\(pct)% since saved")
                    .font(AL.Font.chip).foregroundStyle(AL.onAccent)
                    .padding(.horizontal, 10).frame(height: 26)
                    .background(AL.lime, in: Capsule())
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var meta: String? {
        var parts: [String] = []
        if let f = summary.first {
            let when = f.day.map { " on \($0.formatted(date: .abbreviated, time: .omitted))" } ?? ""
            parts.append("Was \(PriceSummary.format(f.price, product.currency)) when you saved it\(when)")
        }
        if let r = product.rating {
            parts.append("\(r.formatted(.number.precision(.fractionLength(1)))) ★" + (product.reviewCount.map { " (\($0))" } ?? ""))
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    // MARK: Price card

    private var priceCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Price").font(AL.Font.rowTitle).foregroundStyle(AL.ink)
                Spacer()
                if summary.showsChart {
                    Picker("Range", selection: $range) {
                        ForEach(PriceRange.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 150)
                }
            }
            if summary.showsChart {
                chart.frame(height: 170)
            } else {
                Text("Checked twice daily — history will show up after the next check.")
                    .font(.footnote).foregroundStyle(AL.ink.opacity(AL.Ink.a55))
            }
            HStack(spacing: 8) {
                Text("Tell me under").font(.subheadline).foregroundStyle(AL.ink.opacity(AL.Ink.a75))
                Spacer()
                Text(product.currency).foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                TextField("Price", text: $alertText)
                    .keyboardType(.decimalPad)
                    .focused($alertFocused)
                    .multilineTextAlignment(.trailing)
                    .monospacedDigit()
                    .frame(width: 110)
                    .padding(.horizontal, 12).frame(height: 40)
                    .background(AL.ink.opacity(AL.Ink.a06), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .accessibilityLabel("Alert price in \(product.currency)")
            }
            if FeatureFlags.pricePush {
                // BACKEND: price push notifications (APNs) aren't built yet; flag stays off until they ship.
                Toggle("Push notification", isOn: .constant(false)).tint(AL.inStock)
            }
            if let last = summary.latest?.day {
                Text("Checked twice a day · last check \(last.formatted(.relative(presentation: .named)))")
                    .font(.caption).foregroundStyle(AL.ink.opacity(AL.Ink.a50))
            }
        }
        .padding(16)
        .frosted(0.62, radius: 22)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { alertFocused = false }
            }
        }
    }

    private var chart: some View {
        let points = summary.points(in: range)
        let last = points.last?.date
        return Chart {
            ForEach(points, id: \.date) { p in
                if let day = p.day {
                    LineMark(x: .value("Day", day), y: .value("Price", p.price))
                        .foregroundStyle(AL.periwinkle)
                        .lineStyle(.init(lineWidth: 3))
                        .interpolationMethod(.monotone)
                    PointMark(x: .value("Day", day), y: .value("Price", p.price))
                        .foregroundStyle(AL.periwinkle)
                        .symbolSize(p.date == last ? 80 : 20)
                }
            }
            if let t = product.alertThreshold {
                RuleMark(y: .value("Alert", t))
                    .foregroundStyle(AL.signal)
                    .lineStyle(.init(lineWidth: 1.5, dash: [5, 5]))
                    .annotation(position: .top, alignment: .trailing) {
                        Text("Alert \(PriceSummary.format(t, product.currency))")
                            .font(.caption2.weight(.semibold)).foregroundStyle(AL.signal)
                    }
            }
        }
        .chartYScale(domain: summary.yDomain(for: points))
        .chartXAxis {
            AxisMarks(values: [points.first?.day, points.last?.day].compactMap { $0 }) {
                AxisValueLabel(format: .dateTime.month(.abbreviated).day())
            }
        }
        .chartYAxis { AxisMarks(position: .leading, values: .automatic(desiredCount: 3)) }
        .accessibilityLabel("Price history")
    }

    private func commitAlert() {
        let cleaned = alertText.replacingOccurrences(of: ",", with: ".").filter { $0.isNumber || $0 == "." }
        guard let value = Double(cleaned), value > 0, value != product.alertThreshold else { return }
        store.setPriceAlert(link.id, threshold: value)
    }

    // MARK: Specs

    private var specsCard: some View {
        let shown = showAllSpecs ? product.specs : Array(product.specs.prefix(3))
        return VStack(alignment: .leading, spacing: 0) {
            Text("Specs AnyLink pulled · \(product.totalSpecCount)")
                .font(AL.Font.rowTitle).foregroundStyle(AL.ink)
                .padding(.bottom, 8)
            ForEach(shown, id: \.label) { spec in
                HStack(alignment: .firstTextBaseline) {
                    Text(spec.label).foregroundStyle(AL.ink.opacity(AL.Ink.a55))
                    Spacer()
                    Text(spec.value).foregroundStyle(AL.ink).multilineTextAlignment(.trailing)
                }
                .font(.subheadline)
                .padding(.vertical, 10)
                .accessibilityElement(children: .combine)
                Divider()
            }
            if !showAllSpecs && max(product.totalSpecCount, product.specs.count) > 3 {
                Button("Show all \(product.totalSpecCount)") { showAllSpecs = true }
                    .font(.subheadline.weight(.semibold)).foregroundStyle(AL.signal)
                    .padding(.top, 10)
            }
        }
        .padding(16)
        .frosted(0.62, radius: 22)
    }

    // MARK: Toolbar

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Menu { LinkMenuItems(link: link, inDetail: true) } label: { Image(systemName: "ellipsis") }
                .accessibilityLabel("More")
        }
        ToolbarItemGroup(placement: .bottomBar) {
            Button { store.setFavorite(link.id, link.favorite != true) } label: {
                Image(systemName: link.favorite == true ? "star.fill" : "star")
                    .foregroundStyle(link.favorite == true ? AL.signal : AL.ink)
            }
            .accessibilityLabel(link.favorite == true ? "Unfavorite" : "Favorite")
            if let url { ShareLink(item: url) { Label("Share", systemImage: "square.and.arrow.up") } }
            Spacer()
            Button { router.openOriginal = url } label: {
                Text("Open on \((link.retailerShortName ?? link.domain).capitalized)").fontWeight(.semibold).foregroundStyle(AL.onAccent)
            }
            .buttonStyle(.glassProminent)
                .foregroundStyle(AL.onAccent)
            .tint(AL.signal)
        }
    }
}

#Preview("Product") {
    let env = AppEnvironment.mock(latency: false)
    NavigationStack { LinkDetailView(id: "iph") }.environment(env.store).environment(env.router)
}

#Preview("Product — Dark") {
    let env = AppEnvironment.mock(latency: false)
    NavigationStack { LinkDetailView(id: "iph") }.environment(env.store).environment(env.router).preferredColorScheme(.dark)
}
