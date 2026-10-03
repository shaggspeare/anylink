import XCTest

final class AnyLinkUITests: XCTestCase {
    private func launch() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-ui-testing"]
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
}
