import SwiftUI
#if canImport(CoreText)
import CoreText
#endif

extension AL {
    public enum Font {
        public static func brand(_ size: CGFloat, _ weight: SwiftUI.Font.Weight, relativeTo style: SwiftUI.Font.TextStyle) -> SwiftUI.Font {
            .custom("InstrumentSans-Regular", size: size, relativeTo: style).weight(weight)
        }

        // Type scale from 03-design-system §2
        public static let largeTitle = brand(30, .semibold, relativeTo: .largeTitle)
        public static let hero = brand(36, .semibold, relativeTo: .largeTitle)
        public static let sheetHero = brand(30, .semibold, relativeTo: .title)
        public static let readerTitle = brand(30, .semibold, relativeTo: .title)
        public static let title = brand(22, .semibold, relativeTo: .title2)
        public static let cardTitleL = brand(19, .semibold, relativeTo: .title3)
        public static let productTitle = brand(24, .semibold, relativeTo: .title2)
        public static let price = brand(34, .semibold, relativeTo: .largeTitle)
        public static let tileTitle = brand(13.5, .semibold, relativeTo: .subheadline)
        public static let rowTitle = brand(14, .semibold, relativeTo: .subheadline)
        public static let readerBody = brand(17, .regular, relativeTo: .body)
        public static let lead = brand(14.5, .regular, relativeTo: .callout)
        public static let body = brand(13.5, .medium, relativeTo: .subheadline)
        public static let chip = brand(12.5, .medium, relativeTo: .footnote)
        public static let meta = brand(11.5, .regular, relativeTo: .caption)
        public static let eyebrow = brand(10.5, .semibold, relativeTo: .caption2)
    }

    public static func registerFonts() {
        #if canImport(CoreText)
        guard let url = Bundle.module.url(forResource: "InstrumentSans-Variable", withExtension: "ttf", subdirectory: "Fonts") else {
            #if DEBUG
            print("[AL] ⚠ InstrumentSans-Variable.ttf not found in bundle")
            #endif
            return
        }
        var error: Unmanaged<CFError>?
        CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error)
        if let error = error?.takeRetainedValue() {
            #if DEBUG
            print("[AL] Font registration error: \(error)")
            #endif
        }
        #if DEBUG && canImport(UIKit)
        if let names = UIFont.fontNames(forFamilyName: "Instrument Sans") as [String]? {
            print("[AL] Instrument Sans PostScript names: \(names)")
        }
        #endif
        #endif
    }
}
