# Free libraries stay on their platform; Pro joins them on the server

Until the Pro launch, every signed-in user's library lived on the server and synced to iOS for free, so there was nothing worth paying for. From the launch, a free iOS user keeps a local library on the device. It syncs between their Apple devices through iCloud and needs no account. A free web user keeps a server library that isn't connected to iOS. Pro is the only way to join the two: the iOS library moves into the server library, which then serves both apps. Pro is sold only through the App Store, because a second billing system is more operations than a side project should carry.

## Considered Options

- **Sync stays free, and Pro sells only AI and power features**: rejected. Cross-device sync is the feature people most clearly pay for, and giving it away left Pro thin.
- **Free iOS users get a server account like web users**: rejected. They would cost server storage, and the account would give them nothing extra.
- **Stripe on web next to the App Store**: parked. Two billing systems mean two sets of purchase records to keep in step, and the app is iPhone-first. Until it exists, web-only users can't buy Pro.

## Consequences

- iOS has two data modes. A local library is a SwiftData store mirrored to the user's private CloudKit database. A server library uses the API plus the offline cache. An upgrade or a lapse moves a library from one mode to the other, and neither deletes anything.
- Free iOS users have no login. The server calls they still need (crawl, import link checks, AI grouping) are verified with Apple's App Attest, and the server stores nothing for them.
- Share links, link health, price tracking and export need the server library, so they are Pro.
- Feature parity still holds: on each platform, a free library syncs within that platform.
