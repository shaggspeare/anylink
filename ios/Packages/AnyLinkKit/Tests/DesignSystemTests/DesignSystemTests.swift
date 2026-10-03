import Testing
@testable import DesignSystem

@Suite struct DesignSystemTests {
    @Test func identityIsStable() {
        #expect(AL.identity(for: "nasa.gov").tint == AL.identity(for: "nasa.gov").tint)
        #expect(AL.identity(for: "nasa.gov").initial == "N")
    }

    @Test func brandFontPicksWeightInstance() {
        #expect(AL.Font.postScriptName(.semibold) == "InstrumentSans-Regular_SemiBold")
        #expect(AL.Font.postScriptName(.regular) == "InstrumentSans-Regular")
    }
}

@Suite struct PasteAccessoryTests {
    @Test func extractsFirstWebURL() {
        #expect(PasteAccessory.firstWebURL(in: "look https://nasa.gov/x and http://a.b")?.absoluteString == "https://nasa.gov/x")
        #expect(PasteAccessory.firstWebURL(in: "mailto:a@b.c") == nil)
        #expect(PasteAccessory.firstWebURL(in: "no link here") == nil)
    }
}
