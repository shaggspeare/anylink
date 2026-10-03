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
}
