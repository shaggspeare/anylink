import XCTest

final class AnyLinkUITests: XCTestCase {
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
        let field = app.textFields["nasa.gov/missions/…"]
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
        XCTAssertTrue(app.buttons["Save to Unsorted"].exists)
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
        let highlight = app.buttons["Highlight"].firstMatch
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
}
