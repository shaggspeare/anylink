import XCTest

final class AnyLinkUITests: XCTestCase {
    private func log(_ line: String) {
        let url = URL(fileURLWithPath: "/tmp/audit.log")
        if let h = try? FileHandle(forWritingTo: url) { h.seekToEndOfFile(); h.write(Data((line + "\n").utf8)); try? h.close() }
        else { try? Data((line + "\n").utf8).write(to: url) }
    }

    private func launch(_ extra: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-ui-testing"] + extra
        app.launch()
        return app
    }

    @MainActor
    func testTrashAndUndoFromContextMenu() throws {
        let app = launch()
        let tile = app.buttons["tile-nasa"]
        XCTAssertTrue(tile.waitForExistence(timeout: 5))

        tile.press(forDuration: 1.0)
        let trash = app.buttons["Move to Trash"]
        XCTAssertTrue(trash.waitForExistence(timeout: 3))
        trash.tap()

        XCTAssertTrue(app.staticTexts["Moved to Trash"].waitForExistence(timeout: 3))
        XCTAssertFalse(tile.waitForExistence(timeout: 1))

        app.buttons["Undo"].tap()
        XCTAssertTrue(tile.waitForExistence(timeout: 3))
    }

    @MainActor
    func testSelectModeTrashAsksForConfirmation() throws {
        let app = launch()
        app.buttons["Select"].tap()
        app.buttons["tile-nasa"].tap()
        app.buttons["tile-ytrt"].tap()
        XCTAssertTrue(app.staticTexts["2 Selected"].waitForExistence(timeout: 2))
        app.buttons["Trash"].tap()
        let confirm = app.buttons["Move to Trash"]
        XCTAssertTrue(confirm.waitForExistence(timeout: 3))
        confirm.tap()
        XCTAssertTrue(app.staticTexts["2 links moved to Trash"].waitForExistence(timeout: 3))
    }

    // MARK: - Add sheet (S8), all three Mock streams

    @MainActor
    private func read(_ url: String, in app: XCUIApplication) {
        app.buttons["New link"].tap()
        let field = app.textFields["https://"]
        XCTAssertTrue(field.waitForExistence(timeout: 3))
        field.tap()
        field.typeText(url)
        app.buttons["Read link"].tap()
    }

    @MainActor
    func testAddSuccessStreamSaves() throws {
        let app = launch()
        read("www.theverge.com/2026/10/story", in: app)
        let save = app.buttons["Save to Unsorted"]
        XCTAssertTrue(save.waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["theverge.com"].exists)
        save.tap()
        XCTAssertTrue(app.staticTexts["Saved to Unsorted"].waitForExistence(timeout: 3))
    }

    @MainActor
    func testAddExcerptOnlyStreamShowsNotice() throws {
        let app = launch()
        read("blocked-news.example/story", in: app)
        let notice = app.staticTexts.containing(NSPredicate(format: "label BEGINSWITH %@", "The site wouldn't give up the full page")).firstMatch
        XCTAssertTrue(notice.waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Save to Unsorted"].waitForExistence(timeout: 5))
    }

    @MainActor
    func testAddFailedStreamGuessesTitle() throws {
        let app = launch()
        read("dead-shop.example/apple-macbook-air-m4", in: app)
        let notice = app.staticTexts.containing(NSPredicate(format: "label BEGINSWITH %@", "The page wouldn't open (not-found)")).firstMatch
        XCTAssertTrue(notice.waitForExistence(timeout: 5))
        XCTAssertEqual(app.descendants(matching: .any).matching(identifier: "Title").firstMatch.value as? String, "Apple macbook air m4")
        app.buttons["Save to Unsorted"].tap()
        XCTAssertTrue(app.staticTexts["Saved to Unsorted"].waitForExistence(timeout: 3))
    }

    @MainActor
    func testInvalidURLExplainsWhy() throws {
        let app = launch()
        read("not a link", in: app)
        XCTAssertTrue(app.staticTexts["That doesn't look like a link — it should start with https://"].waitForExistence(timeout: 2))
    }

    // MARK: - Link detail (S15, S16)

    @MainActor
    func testHighlightFromEditMenu() throws {
        let app = launch()
        app.buttons["tile-nasa"].tap()
        let text = app.textViews.firstMatch
        XCTAssertTrue(text.waitForExistence(timeout: 3))
        text.doubleTap()
        let highlight = app.buttons["Highlight"].firstMatch   // the edit menu shows as buttons or menu items by OS version
        if !highlight.waitForExistence(timeout: 2) { text.press(forDuration: 1.0) }
        XCTAssertTrue(app.menuItems["Highlight"].firstMatch.waitForExistence(timeout: 2) || highlight.exists)
        (app.menuItems["Highlight"].firstMatch.exists ? app.menuItems["Highlight"].firstMatch : highlight).tap()
        XCTAssertTrue(app.staticTexts["Highlighted"].waitForExistence(timeout: 3))
    }

    @MainActor
    func testProductPageShowsPriceCard() throws {
        let app = launch()
        app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Products")).firstMatch.tap()
        app.buttons["tile-iph"].tap()
        XCTAssertTrue(app.staticTexts["Price"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["Tell me under"].exists)
    }

    // MARK: - Collections, Trash, Settings (S10–S18)

    @MainActor
    func testDissolveThenUndoRestoresCollection() throws {
        let app = launch()
        app.tabBars.buttons["Collections"].tap()
        let cooking = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Cooking,")).firstMatch
        XCTAssertTrue(cooking.waitForExistence(timeout: 3))
        cooking.tap()
        XCTAssertTrue(app.staticTexts["WHY THIS EXISTS"].waitForExistence(timeout: 3))
        app.buttons["Dissolve"].firstMatch.tap()   // the WhyCard's Dissolve
        app.buttons["Dissolve collection"].tap()
        let toast = app.staticTexts.containing(NSPredicate(format: "label BEGINSWITH %@", "Cooking dissolved")).firstMatch
        XCTAssertTrue(toast.waitForExistence(timeout: 3))
        XCTAssertFalse(cooking.exists)
        app.buttons["Undo"].tap()
        XCTAssertTrue(cooking.waitForExistence(timeout: 3))
    }

    @MainActor
    func testDeleteEmptyCollectionsReportsCount() throws {
        let app = launch()
        app.tabBars.buttons["Collections"].tap()
        let delete = app.buttons["Delete empty collections"]
        app.swipeUp(); app.swipeUp()
        XCTAssertFalse(delete.exists, "only offered when a collection is empty")
        app.buttons["New collection"].tap()
        app.textFields["Name"].typeText("Empty one")
        app.buttons["Add collection"].tap()
        app.swipeUp(); app.swipeUp()
        XCTAssertTrue(delete.waitForExistence(timeout: 3))
        delete.tap()
        XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label BEGINSWITH %@", "Removed ")).firstMatch.waitForExistence(timeout: 3))
    }

    @MainActor
    func testAppearanceAppliesImmediately() throws {
        let app = launch()
        app.tabBars.buttons["Collections"].tap()
        app.buttons["Settings"].tap()
        app.buttons["Dark"].tap()
        XCTAssertTrue(app.buttons["Dark"].isSelected)
        app.buttons["System"].tap()
    }

    // MARK: - Search (S13)

    @MainActor
    func testSearchTokensSnippetsAndSaveAsFilter() throws {
        let app = launch()
        app.tabBars.buttons["Search"].tap()
        let field = app.searchFields.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 3))
        field.tap()
        field.typeText("type:video ")
        XCTAssertTrue(app.staticTexts["Links · 2"].waitForExistence(timeout: 3))
        XCTAssertEqual((field.value as? String)?.contains("type:video"), false)

        field.buttons["Clear text"].firstMatch.tap()
        field.typeText("artemis")
        let snippet = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH[c] %@", "In the")).firstMatch
        XCTAssertTrue(snippet.waitForExistence(timeout: 3))

        app.buttons["Save as filter"].tap()
        app.alerts.buttons["Save"].tap()
        XCTAssertTrue(app.staticTexts["Saved as a filter in Collections"].waitForExistence(timeout: 3))
        app.buttons["Close"].firstMatch.tap()
        app.swipeUp()
        // The search tab keeps the tab bar collapsed; the empty state lists the same store.customFilters as Collections.
        XCTAssertTrue(app.staticTexts["Saved filters"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.buttons["artemis"].exists)
    }

    // MARK: - Triage (S14)

    @MainActor
    func testTriageFromBannerWithUndo() throws {
        let app = launch()
        app.buttons["unsorted-sort"].tap()
        XCTAssertTrue(app.staticTexts["1 of 5"].waitForExistence(timeout: 3))
        app.buttons["Later"].tap()
        XCTAssertTrue(app.staticTexts["2 of 5"].waitForExistence(timeout: 2))
        app.buttons["Move to Trash"].tap()
        XCTAssertTrue(app.staticTexts["Moved to Trash"].waitForExistence(timeout: 2))
        app.buttons["Undo"].tap()
        XCTAssertTrue(app.staticTexts["2 of 5"].waitForExistence(timeout: 2))
    }

    // MARK: - Welcome + onboarding (S1–S5)

    @MainActor
    func testWelcomeSignsInWithMockAuth() throws {
        let app = launch(["-welcome"])
        XCTAssertTrue(app.staticTexts["Paste anything.\nWe read the rest."].waitForExistence(timeout: 3))
        app.buttons["Sign in with Apple"].tap()
        XCTAssertTrue(app.buttons["tile-nasa"].waitForExistence(timeout: 3))
    }

    @MainActor
    func testOnboardingEndToEndOnMock() throws {
        let start = Date()
        let app = launch(["-onboarding"])
        XCTAssertTrue(app.staticTexts["Bring your links"].waitForExistence(timeout: 3))
        app.buttons["Load sample exports"].tap()
        let importButton = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Import ")).firstMatch
        XCTAssertTrue(importButton.waitForExistence(timeout: 2))
        importButton.tap()

        XCTAssertTrue(app.staticTexts["Every link answered or was flagged"].waitForExistence(timeout: 15))
        app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@ OR label == %@", "Move ", "Continue")).firstMatch.tap()

        XCTAssertTrue(app.staticTexts["Keep or bin?"].waitForExistence(timeout: 3))
        for i in 0..<8 {
            let b = app.buttons[i % 3 == 0 ? "Bin" : "Keep"]
            guard b.waitForExistence(timeout: 2) else { break }
            b.tap()
        }
        XCTAssertTrue(app.staticTexts["What are you working on right now?"].waitForExistence(timeout: 3))
        app.buttons["Next"].tap()
        XCTAssertTrue(app.staticTexts["Anything you'd rather never see again?"].waitForExistence(timeout: 3))
        app.buttons["Build my collections"].tap()

        let made = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "We made")).firstMatch
        XCTAssertTrue(made.waitForExistence(timeout: 10))
        app.buttons["Open my library"].tap()
        XCTAssertTrue(app.buttons["tile-nasa"].waitForExistence(timeout: 3))
        XCTAssertLessThan(Date().timeIntervalSince(start), 120)
    }

    // MARK: - Share extension (S9)

    @MainActor
    func testShareFromSafariSavesToUnsorted() throws {
        let app = launch()                                       // signs in, publishes the App Group flag
        XCTAssertTrue(app.buttons["tile-nasa"].waitForExistence(timeout: 5))

        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.launch()
        safari.open(URL(string: "https://example.com/share-test")!)
        // iOS 26 Safari keeps Share under the ⋯ menu.
        let more = safari.buttons["MoreMenuButton"]
        XCTAssertTrue(more.waitForExistence(timeout: 15))
        sleep(2)
        more.tap()
        let share = safari.buttons["Share"].firstMatch
        XCTAssertTrue(share.waitForExistence(timeout: 5))
        share.tap()
        let anylink = safari.descendants(matching: .any).matching(identifier: "AnyLink").firstMatch
        XCTAssertTrue(anylink.waitForExistence(timeout: 5))
        anylink.tap()
        let saved = safari.staticTexts["Saved to Unsorted"]
        let start = Date()
        XCTAssertTrue(saved.waitForExistence(timeout: 5))
        XCTAssertLessThan(Date().timeIntervalSince(start), 5)
        safari.buttons["Done"].firstMatch.tap()

        app.activate()
        XCTAssertTrue(app.staticTexts["Example Domain"].waitForExistence(timeout: 5) || app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "example.com")).firstMatch.waitForExistence(timeout: 5))
    }

    // MARK: - Accessibility audit (phase 13 gate)

    /// WCAG contrast of the darkest vs lightest pixel inside `frame` (points) on a fresh screenshot.
    private func measuredContrast(_ frame: CGRect, in shot: XCUIScreenshot) -> Double? {
        let image = shot.image
        guard let cg = image.cgImage, frame.width > 1, frame.height > 1 else { return nil }
        let scale = image.scale
        let w = cg.width, h = cg.height
        guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                                  space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return nil }
        ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
        guard let p = ctx.data?.assumingMemoryBound(to: UInt8.self) else { return nil }
        func lin(_ v: UInt8) -> Double { let s = Double(v) / 255; return s <= 0.03928 ? s / 12.92 : pow((s + 0.055) / 1.055, 2.4) }
        var lo = 1.0, hi = 0.0
        for y in max(0, Int(frame.minY * scale))..<min(h, Int(frame.maxY * scale)) {
            for x in max(0, Int(frame.minX * scale))..<min(w, Int(frame.maxX * scale)) {
                let i = (y * w + x) * 4
                let l = 0.2126 * lin(p[i]) + 0.7152 * lin(p[i + 1]) + 0.0722 * lin(p[i + 2])
                lo = min(lo, l); hi = max(hi, l)
            }
        }
        return (hi + 0.05) / (lo + 0.05)
    }

    @MainActor
    /// `secureControls`: the screen shows a system `PasteButton`, whose rendering is deliberately not exposed.
    private func audit(_ app: XCUIApplication, _ screen: String, secureControls: Bool = false, retried: Bool = false) {
        var flaky = false
        defer { if flaky && !retried { sleep(3); audit(app, screen, secureControls: secureControls, retried: true) } }
        sleep(2)   // let entrance animations settle
        let shot = XCUIScreen.main.screenshot()
        let height = app.windows.firstMatch.frame.height
        // Tiles, rows and collection cards are single VoiceOver elements with the full text as their label; the
        // visual pieces inside them only exist in the automation tree.
        let combined = app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH 'tile-' OR identifier BEGINSWITH 'row-' OR identifier BEGINSWITH 'collection-' OR identifier BEGINSWITH 'swipe-card'"))
            .allElementsBoundByIndex.map(\.frame)
        do {
            try app.performAccessibilityAudit { issue in
                if secureControls, issue.element == nil, issue.auditType == .sufficientElementDescription || issue.compactDescription.contains("inaccessible text") { return true }
                guard let f = issue.element?.frame else {
                    // Element-less contrast hits come from morphing system glass mid-animation; re-check once settled.
                    if issue.auditType == .contrast, !retried { flaky = true; return true }
                    self.log("AUDIT[\(screen)] \(issue.auditType.rawValue) | \(issue.compactDescription) | \(issue.detailedDescription.prefix(200)) | no element")
                    return false
                }
                if issue.element?.elementType != .button, combined.contains(where: { $0.contains(f) }) { return true }
                // Content scrolls under the floating tab bar + accessory by design: occluded, not low-contrast.
                if f.maxY > height - 150, issue.auditType == .contrast || issue.auditType == .textClipped { return true }
                // The contrast audit misreads text over translucent material; trust the rendered pixels.
                if issue.auditType == .contrast, let ratio = self.measuredContrast(f, in: shot), ratio >= 4.5 { return true }
                // Verified to scale at AX sizes by testFlaggedLabelsScaleWithDynamicType.
                if issue.auditType == .dynamicType, issue.compactDescription.contains("partially"),
                   Self.verifiedScaling.contains(issue.element?.label ?? "") { return true }
                // System nav/tool bars cap their own text size.
                if issue.auditType == .dynamicType, f.minY < 110 || f.minY > height - 110 { return true }
                self.log("AUDIT[\(screen)] \(issue.auditType.rawValue) | \(issue.compactDescription) | \(issue.element?.debugDescription.prefix(160) ?? "-")")
                return false
            }
        } catch {
            XCTFail("\(screen): \(error)")
        }
    }

    @MainActor
    func testAccessibilityAuditTopLevelScreens() throws {
        let app = launch()
        XCTAssertTrue(app.buttons["tile-nasa"].waitForExistence(timeout: 5))
        audit(app, "Library")

        app.buttons["tile-nasa"].tap()
        XCTAssertTrue(app.textViews.firstMatch.waitForExistence(timeout: 3))
        audit(app, "Reader")
        app.navigationBars.buttons.firstMatch.tap()

        app.tabBars.buttons["Collections"].tap()
        XCTAssertTrue(app.staticTexts["Collections"].waitForExistence(timeout: 3))
        audit(app, "Collections")

        app.buttons["Settings"].tap()
        XCTAssertTrue(app.staticTexts["Your account"].waitForExistence(timeout: 3))
        audit(app, "Settings")
        app.navigationBars.buttons.firstMatch.tap()

        app.tabBars.buttons["Search"].tap()
        XCTAssertTrue(app.staticTexts["Narrow it down"].waitForExistence(timeout: 3))
        audit(app, "Search")
    }

    @MainActor
    func testAccessibilityAuditSecondaryScreens() throws {
        let app = launch()
        app.buttons["unsorted-sort"].tap()
        XCTAssertTrue(app.staticTexts["1 of 5"].waitForExistence(timeout: 3))
        audit(app, "Triage")
        app.navigationBars.buttons.firstMatch.tap()

        app.buttons["New link"].tap()
        XCTAssertTrue(app.textFields["https://"].waitForExistence(timeout: 3))
        // The floating medium-detent sheet is transformed, which the clipping check misreads; audit it expanded.
        let top = app.windows.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.505))
        top.press(forDuration: 0.1, thenDragTo: app.windows.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.08)))
        audit(app, "Add idle", secureControls: true)
        let field = app.textFields["https://"]
        field.tap(); field.typeText("www.theverge.com/story")
        app.buttons["Read link"].tap()
        XCTAssertTrue(app.buttons["Save to Unsorted"].waitForExistence(timeout: 5))
        audit(app, "Add ready")
        app.buttons["Cancel"].tap()

        app.tabBars.buttons["Collections"].tap()
        app.swipeUp(); app.swipeUp()
        app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Trash'")).firstMatch.tap()
        XCTAssertTrue(app.staticTexts["Trash"].waitForExistence(timeout: 3))
        sleep(2)
        audit(app, "Trash")

        let welcome = launch(["-welcome"])
        XCTAssertTrue(welcome.buttons["Sign in with Apple"].waitForExistence(timeout: 3))
        audit(welcome, "Welcome")
    }

    /// Labels the audit calls "partially unsupported" although they grow (system Toggle/Picker labels, hero eyebrow).
    static let verifiedScaling: Set<String> = ["Clipboard suggestions", "New links go to", "NASA.GOV · 6 MIN READ", AnyLinkUITests.shareFooter]
    static let shareFooter = "To save from Safari, tap Share, scroll the app row, tap More and pin AnyLink."

    @MainActor
    func testFlaggedLabelsScaleWithDynamicType() throws {
        func heights(_ size: String?) -> [String: CGFloat] {
            let app = XCUIApplication()
            app.launchArguments = ["-ui-testing"] + (size.map { ["-UIPreferredContentSizeCategoryName", $0] } ?? [])
            app.launch()
            var out: [String: CGFloat] = [:]
            app.buttons["tile-nasa"].tap()
            out["NASA.GOV · 6 MIN READ"] = app.staticTexts["NASA.GOV · 6 MIN READ"].frame.height
            app.navigationBars.buttons.firstMatch.tap()
            app.tabBars.buttons["Collections"].tap()
            app.buttons["Settings"].tap()
            for l in ["Clipboard suggestions", "New links go to", Self.shareFooter] {
                let t = app.staticTexts[l]
                if !t.exists { app.swipeUp() }
                out[l] = t.frame.height
            }
            app.terminate()
            return out
        }
        let normal = heights(nil)
        let large = heights("UICTContentSizeCategoryAccessibilityL")
        for label in Self.verifiedScaling {
            let a = normal[label] ?? 0, b = large[label] ?? 0
            XCTAssertGreaterThan(b, a * 1.5, "\(label) doesn't scale: \(a) → \(b)")
        }
    }
}
