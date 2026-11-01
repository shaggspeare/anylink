# App Store listing (draft)

Copy for App Store Connect, for you to approve or edit. The voice follows `ios/docs/04-screens.md` and the landing
page: short, plain, second person. Character counts are in brackets, against Apple's limits.

## Name and subtitle

| Field | Text | Count |
| --- | --- | --- |
| Name | AnyLink: Bookmark Manager | 25 of 30 |
| Subtitle | Save links. We read the rest. | 29 of 30 |

The tagline "Paste anything. We read the rest." is 33 characters, too long for the subtitle. If the name is taken, try
"AnyLink: Save Links for Later" (29). Apple searches the name, subtitle and keywords together, so the keywords below
don't repeat their words.

## Promotional text

Shown above the description. It can change without a new build.

> Save any link from any app. AnyLink reads the page, files it in a collection and keeps it easy to find. Free on
> iPhone, with no account needed.

(143 of 170)

## Description

```
Paste anything. We read the rest.

AnyLink is a library for the links you save. Share a link from any app, and it's filed before the sheet closes, with its title, image and reading time. Your saves stop being a pile and become a library you'll actually browse.

SAVE FROM ANYWHERE
• Share to AnyLink from Safari or any app, or paste a link you copied
• Save with Siri and Shortcuts, and see your latest saves in widgets
• Bring in your Safari bookmarks, another browser's export, Telegram Saved Messages, a WhatsApp chat or any text with links. AnyLink groups them into collections and flags the links that are gone.

ORGANISE
• Collections, tags, notes, images and highlights
• Sort Unsorted with a swipe
• Trash keeps your mistakes recoverable

FIND
• One search for everything, including the text inside articles
• Save the searches you repeat as smart collections
• Find your saves from Spotlight

READ
• A clean reader view, without the clutter

FREE, WITH NO ACCOUNT
Your library lives on your iPhone and syncs to your other Apple devices through your own iCloud. It isn't stored on our servers.

ANYLINK PRO
One library on your iPhone and the web, and more:
• AI summaries and tags on every save
• A second read in a full browser when a page won't load
• Layouts for products, articles, videos and recipes
• Price history and price alerts
• Link health checks
• Share links to your collections
• Export as HTML, JSON or CSV

Pro is a monthly or yearly subscription, or a one-time lifetime purchase. Subscriptions renew automatically until you cancel in Settings › Apple Account › Subscriptions. Lifetime includes about 1,000 AI saves a month.

Terms of Use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Privacy Policy: https://www.anylink.space/privacy-policy
```

(1,787 of 4,000.) Apple asks for the Terms of Use link in the description (or a custom EULA) whenever an app sells
subscriptions, so keep the last two lines. Prices aren't in the text, because they differ by country and the App Store
shows them.

## Keywords

```
later,reader,collection,organizer,article,recipe,price,tracker,wishlist,notes,highlight,clipper,web
```

(99 of 100.) Commas without spaces, singular words (the App Store matches plurals), and no competitor or Apple names.
"read" in the subtitle and "later" here together cover "read later".

## What's New in 1.0

```
The first App Store release of AnyLink.
• Save links from any app, with their title, image and reading time
• A free library on your iPhone, synced through iCloud, with no account
• AnyLink Pro: one library on your iPhone and the web, AI summaries, layouts for products, articles, videos and recipes, share links and export
```

If App Store Connect doesn't show this field for a first version, use the text as TestFlight's "What to Test".

## App Privacy ("nutrition label")

From the code as of Phase 9. The privacy policy (`src/app/privacy-policy/page.tsx`) says the same in longer form.

**Do you or your third-party partners collect data from this app?** Yes.

**Tracking:** none. Nothing is used to track people across other companies' apps or websites, and nothing goes to data
brokers or ad networks. Answer "No" to every "used for tracking" question.

| Category | Data type | Linked to the user | Purpose | What it is in AnyLink |
| --- | --- | --- | --- | --- |
| Contact Info | Email Address | Yes | App Functionality | The account's sign-in email |
| Contact Info | Name | Yes | App Functionality | The name Apple or Google may share at sign-in, and the display name on shared collections |
| User Content | Photos or Videos | Yes | App Functionality | Images saved to a library on the server (an account's library, or Pro on iPhone) |
| User Content | Emails or Text Messages | Yes | App Functionality | A Telegram or WhatsApp import keeps the words around each link (`links.import_meta`) |
| User Content | Other User Content | Yes | App Functionality | Links, notes, highlights, tags and collections in a server library; page text and titles sent for previews, link checks and AI grouping |
| Identifiers | User ID | Yes | App Functionality | The account id, also sent to Apple as the purchase's `appAccountToken` |
| Identifiers | Device ID | No | App Functionality | The App Attest key id of an install without an account (`app_attest_keys`), used against abuse |
| Purchases | Purchase History | Yes | App Functionality | The plan, the Pro product and its expiry (`users.plan*`) |
| Usage Data | Product Interaction | Yes | Product Personalization | `user_signals`: moves, and accepted or changed groupings, plus onboarding answers, kept to improve grouping |

Not collected: health, financial info (Apple takes the payment), location, sensitive info, contacts, browsing
history, search history, diagnostics, and any other data. The app has no analytics or crash-reporting SDK.

Judgment calls, so you can decide differently:
- **Emails or Text Messages** is the cautious reading of chat imports. If you'd rather count them as Other User
  Content, drop that row.
- **Browsing History** is left out: AnyLink stores links people choose to save, not pages they visit.
- **A local library isn't collected.** It stays in the user's own private CloudKit database, which AnyLink can't
  read. Calls from local libraries (previews, link checks, grouping) store nothing, but the same data types are
  collected from accounts, so they're declared once, as linked.

## App Review notes

Fill in the two accounts before submitting. Both should be created on production: the free one as a normal sign-up,
the Pro one set to `plan = 'pro'` with no expiry.

```
AnyLink works without an account: add a link with the + button, or share one to AnyLink from Safari.

Pro is the in-app purchase.
• Open the paywall from the Profile tab › AnyLink Pro. Trying a Pro feature opens it too: share a collection, set a price alert on a product, or export the library. On the free plan, each link page also ends with a line that opens it.
• Buying needs an account, so the paywall asks you to sign in first. Use the free demo account below, Sign in with Apple, or a new email account.
• Products: Pro Monthly and Pro Yearly (auto-renewable, group "AnyLink Pro"), and Pro Lifetime (non-consumable). Restore purchases is on the paywall.
• The account turns Pro within a few seconds of buying. To see the same library on the web, sign in at https://www.anylink.space with the same account.

Demo account, free (to try buying): <email> / <password>
Demo account, already Pro: <email> / <password>

Delete account is in the Profile tab when signed in.
```

## In-app purchases

The subscription group's display name is **AnyLink Pro**, and the app name shown with it is **AnyLink**.

| Product id | Type | Reference name | Display name | Description |
| --- | --- | --- | --- | --- |
| `com.shaggspeare.anylink.pro.monthly` | Auto-renewable, 1 month, $2.99 | Pro Monthly | Pro Monthly | Every Pro feature, billed monthly |
| `com.shaggspeare.anylink.pro.yearly` | Auto-renewable, 1 year, $19.99 | Pro Yearly | Pro Yearly | Every Pro feature, billed yearly |
| `com.shaggspeare.anylink.pro.lifetime` | Non-consumable, $49.99 | Pro Lifetime | Pro Lifetime | Every Pro feature, paid for once |

Display names are 30 characters or fewer and descriptions 45 or fewer, which fits Apple's limits. Each product needs a
review screenshot: a screenshot of the paywall (S19) does for all three.

## Before you submit

- **Support URL** (required) has to reach a way to contact you. The site has no support page yet; the privacy policy
  ends with the contact email, so `https://www.anylink.space/privacy-policy` works until there is one.
- **Privacy Policy URL:** `https://www.anylink.space/privacy-policy`.
- **Category:** Productivity, with Utilities as the secondary.
- **iPad:** `ios/project.yml` builds for iPhone and iPad (`TARGETED_DEVICE_FAMILY: "1,2"`), so App Store Connect will
  ask for iPad screenshots too. Make it `"1"` for 1.0 if iPad should wait for its own phase.
- **Age rating:** the questionnaire asks about unrestricted web access. Links open in an in-app Safari view, which
  can reach any site, and answering yes raises the rating. Decide how to answer before you fill it in.
- **App preview:** `design/app-store/anylink-promo-9x16.mp4` is 1080 × 1920, 20 s, H.264 at 30 fps. That size only
  fits the 5.5" iPhone slot; current iPhones take 886 × 1920, so it needs re-cutting. Apple also wants previews to be
  screen captures of the app, and this one is a designed animation, so it may be refused. Screenshots alone are fine.
