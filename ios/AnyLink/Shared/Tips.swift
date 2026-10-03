import TipKit

/// `07` § TipKit: each shown once, in context.
struct PasteTip: Tip {
    var title: Text { Text("Paste") }
    var message: Text? { Text("Copy a link anywhere, then Paste — AnyLink reads it for you.") }
}

struct LongPressTip: Tip {
    var title: Text { Text("More on a card") }
    var message: Text? { Text("Long-press a card for Move, Favorite and Trash.") }
}

struct SearchTip: Tip {
    var title: Text { Text("Filters") }
    var message: Text? { Text("Search takes filters like type:video or #design.") }
}

struct SortTip: Tip {
    var title: Text { Text("Sort Unsorted") }
    var message: Text? { Text("Swipe through Unsorted to file links in seconds.") }
}

struct ShareSheetTip: Tip {
    var title: Text { Text("Share sheet") }
    var message: Text? { Text("In Safari, tap Share, scroll the app row, tap More and pin AnyLink.") }
}

enum AppTips {
    static func configure() {
        if AppConfig.isUITesting {
            Tips.hideAllTipsForTesting()
        } else if UserDefaults.standard.bool(forKey: "resetTipsOnLaunch") {
            try? Tips.resetDatastore()
            UserDefaults.standard.set(false, forKey: "resetTipsOnLaunch")
        }
        try? Tips.configure([.displayFrequency(.daily)])
    }
}
