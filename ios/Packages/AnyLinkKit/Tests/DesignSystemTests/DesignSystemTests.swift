import Testing
import Foundation
import CoreGraphics
import ImageIO
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

@Suite struct ImageLoaderTests {
    @Test func downsamplesToTheLongestSide() throws {
        // A 400×200 PNG drawn with CoreGraphics, downsampled to 100 px.
        let ctx = CGContext(data: nil, width: 400, height: 200, bitsPerComponent: 8, bytesPerRow: 0,
                            space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        ctx.setFillColor(CGColor(red: 1, green: 0.35, blue: 0.12, alpha: 1))
        ctx.fill(CGRect(x: 0, y: 0, width: 400, height: 200))
        let data = NSMutableData()
        let dest = CGImageDestinationCreateWithData(data, "public.png" as CFString, 1, nil)!
        CGImageDestinationAddImage(dest, ctx.makeImage()!, nil)
        CGImageDestinationFinalize(dest)
        let small = try #require(ImageLoader.downsample(data as Data, maxPixels: 100))
        #expect(small.width == 100 && small.height == 50)
        #expect(ImageLoader.downsample(Data("nope".utf8), maxPixels: 100) == nil)
    }
}
