# App Store release 1.0: what's left, and the listing

The first section is the release checklist. The rest is the copy for App Store Connect, for you to approve or edit. The
voice follows `ios/docs/04-screens.md` and the landing page: short, plain, second person. Character counts are in
brackets, against Apple's limits.

## What's left for 1.0

Pro and the Chrome extension are **parked** for 1.0 (decided 2026-11-15):
- Every account gets everything Pro has, and nothing is sold.
- The extension isn't released.
- The code for both stays. § Parked says how to bring them back.

Do these in order. Steps marked *(Claude)* are code or deploys: ask for them.

1. [x] **Deploy the parked-Pro change** *(Claude)*. Until it's live, the server still treats new accounts as free.
2. [x] **Vercel → Production: set `APP_ATTEST_SECRET`**, then redeploy.
   - Use any long random string, e.g. from `openssl rand -base64 48`.
   - Without it, iPhones without an account can't check imported links or group them, and get a lower preview limit.
3. [x] **Apple Developer → Identifiers → `com.shaggspeare.anylink`:** turn on App Attest, iCloud (container
   `iCloud.com.shaggspeare.anylink`) and Push Notifications. Automatic signing may add them on the first device build.
4. [x] **App Store Connect: create the app record** for `com.shaggspeare.anylink`. A free app with no purchases needs
   no Paid Apps agreement, tax or banking.
5. [ ] **CloudKit: deploy the schema to Production** before the first TestFlight build. The steps are in
   `docs/pro-qa.md` § Launch hardening checklist → Before the TestFlight run.
6. [ ] **Rewrite the privacy policy for parked Pro** *(Claude drafted it, 2026-11-15; you approve, then deploy)*.
   - What signing in adds is now described as "with an account", not "with Pro", and the purchases text is gone.
   - It has to be deployed before App Review reads it.
   - Its Chrome extension section stays, marked TODO: it's accurate for anyone who loads the extension.
7. [ ] **Upload a new build from `main`, and attach it to version 1.0** *(Claude can attach it)*.
   - Every build in App Store Connect (3–7) is from Oct 11–14. None of them has the local library, iCloud sync,
     Pro parked or the translations, so the earlier TestFlight round tested an older app.
   - Build 5 is attached now. The new listing describes the current app, so submitting build 5 would be refused.
   - Run § TestFlight QA on the new build.
8. [ ] **Refuse development App Attest keys in production** *(Claude did the code, 2026-11-15; live with the next
   deploy)*.
   - Production now answers 403 `development-key` at registration and on every call from a development key. That
     includes keys registered earlier.
   - After the deploy, a Debug build on a real iPhone can't use production without an account. TestFlight builds
     still can.
9. [ ] **Finish the listing.** *(Claude)* entered these through the API on 2026-11-15, in English and the 13 app
   languages:
   - name, subtitle, description, keywords and promotional text;
   - the privacy policy, support and marketing URLs;
   - price Free, and the review notes.

   Already set by you: the age rating (17+) and the categories. Left for you:
   - [ ] **App Privacy** answers, from § App Privacy. There's no API for them, so enter them on the website.
   - [ ] **Copyright**, e.g. "2026 <your name>".
   - [ ] **The content rights declaration.** AnyLink shows titles, images and text from the pages people save.
   - [ ] **Availability:** which countries. China mainland needs an ICP filing, so most apps leave it out.
   - [ ] **iPad**, see § Before you submit. If the new build supports iPad, it needs iPad screenshots.
   - [ ] **Screenshots:** 9 iPhone 6.7" ones are uploaded in English, and the other languages reuse them. Check they
     match the new build.
10. [ ] **Create the demo account** for App Review on production. Enter it, with your contact details, in App Store
    Connect → App Review Information. The notes are already there.
11. [ ] **Submit.**
12. [ ] **Once the app is live:** set `APP_STORE_URL` in `src/lib/pro.ts` to
    `https://apps.apple.com/app/id6821579363`, and deploy *(Claude)*. "Get the iPhone app"
    on the landing page then goes to the App Store. The pricing section stays hidden while Pro is parked.

### TestFlight QA (about 30 minutes)

On a real iPhone, with the TestFlight build:
- [ ] A fresh install has no sign-in wall, and Profile has no AnyLink Pro section.
- [ ] Save three links from Safari's share sheet. Each gets a title, an image and a reading time.
- [ ] A second device on the same Apple Account shows the same links (Profile → iCloud sync is On).
- [ ] Import Safari bookmarks. The links are grouped into collections, and dead ones are flagged.
- [ ] Without an account, try to share a collection. Sign in should open.
- [ ] Sign in with Apple:
  - It shows "Moving your library to your account…", then "Your library now syncs with the web".
  - anylink.space shows the same library, with no duplicates.
- [ ] Signed in, save a new link. It gets an AI summary and tags.
- [ ] Recipe, video, article and product pages show their own layouts, and a price alert can be set.
- [ ] Share a collection, and open the link in a private browser window.
- [ ] Export HTML, JSON and CSV from Profile.
- [ ] Sign out: the iPhone library comes back.
- [ ] Sign in with an email account, then delete it from Profile.
- [ ] On the web, Settings shows no plan line and the landing page has no pricing section.

### Parked

**Pro.** Two switches control it:
- `PRO_FOR_EVERYONE` in `src/lib/plan.ts`, for the server and the web.
- `AppConfig.proForEveryone` in `ios/AnyLink/App/AppConfig.swift`, for iOS.

While they're on:
- Every account counts as Pro, and so do web guests.
- An iPhone without an account gets Pro's layouts. Anything that needs an account asks it to sign in.
- The billing code, the paywall and the Pro tests stay as they are. iOS UI tests pass `-pro-gating` to test the
  gating.

To bring Pro back:
1. Decide about the accounts made while Pro was parked. They're `free` in the database, so turning the switches off
   lapses them: their iPhones go back to a local library, and their share links pause.
   - To keep them on Pro, grandfather them with a migration like `20261102000000_grandfather_pro.sql`.
   - Otherwise, let them lapse.
2. Turn both switches off, deploy, and ship an app update. Builds with the switch on never show the paywall.
3. Put back the Pro parts of this doc: the description, What's New, the Purchases privacy row, the review notes and
   the in-app purchases. Update the privacy policy to match.
4. Then follow the App Store Connect and test steps in `docs/pro-progress.md` § Waiting on you.

**Chrome extension.** It's marked TODO in `extension/README.md`. To ship it:
- Add the Supabase redirect URLs.
- Create the Chrome Web Store listing.
- Run the checks in `docs/pro-progress.md` § Phase 8.

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
• Layouts for articles, videos, recipes and products

FREE, WITH NO ACCOUNT
Your library lives on your iPhone and syncs to your other Apple devices through your own iCloud. It isn't stored on our servers.

SIGN IN FOR MORE, STILL FREE
Sign in, and your library is one library on your iPhone and the web, with:
• AI summaries and tags on every save
• A second read in a full browser when a page won't load
• Price history and price alerts
• Link health checks
• Share links to your collections
• Export as HTML, JSON or CSV

Privacy Policy: https://www.anylink.space/privacy-policy
```

(1,530 of 4,000.) There's no Terms of Use link, because 1.0 sells nothing. Apple asks for one once the app sells
subscriptions, so add it back with Pro: `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`.

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
• Sign in, free, for one library on your iPhone and the web, with AI summaries, price alerts, share links and export
```

If App Store Connect doesn't show this field for a first version, use the text as TestFlight's "What to Test".

## App Privacy ("nutrition label")

From the code as of 1.0, with Pro parked. The privacy policy (`src/app/privacy-policy/page.tsx`) says the same in longer form.

**Do you or your third-party partners collect data from this app?** Yes.

**Tracking:** none. Nothing is used to track people across other companies' apps or websites, and nothing goes to data
brokers or ad networks. Answer "No" to every "used for tracking" question.

| Category | Data type | Linked to the user | Purpose | What it is in AnyLink |
| --- | --- | --- | --- | --- |
| Contact Info | Email Address | Yes | App Functionality | The account's sign-in email |
| Contact Info | Name | Yes | App Functionality | The name Apple or Google may share at sign-in, and the display name on shared collections |
| User Content | Photos or Videos | Yes | App Functionality | Images saved to an account's library on the server |
| User Content | Emails or Text Messages | Yes | App Functionality | A Telegram or WhatsApp import keeps the words around each link (`links.import_meta`) |
| User Content | Other User Content | Yes | App Functionality | Links, notes, highlights, tags and collections in a server library; page text and titles sent for previews, link checks and AI grouping |
| Identifiers | User ID | Yes | App Functionality | The account id |
| Identifiers | Device ID | No | App Functionality | The App Attest key id of an install without an account (`app_attest_keys`), used against abuse |
| Usage Data | Product Interaction | Yes | Product Personalization | `user_signals`: moves, and accepted or changed groupings, plus onboarding answers, kept to improve grouping |

Not collected: purchases (1.0 sells nothing; add Purchase History back with Pro), health, financial info, location, sensitive info, contacts, browsing
history, search history, diagnostics, and any other data. The app has no analytics or crash-reporting SDK.

Judgment calls, so you can decide differently:
- **Emails or Text Messages** is the cautious reading of chat imports. If you'd rather count them as Other User
  Content, drop that row.
- **Browsing History** is left out: AnyLink stores links people choose to save, not pages they visit.
- **A local library isn't collected.** It stays in the user's own private CloudKit database, which AnyLink can't
  read. Calls from local libraries (previews, link checks, grouping) store nothing, but the same data types are
  collected from accounts, so they're declared once, as linked.

## App Review notes

Fill in the demo account before submitting. Create it on production as a normal email sign-up: while Pro is parked,
every account has everything.

```
AnyLink works without an account: add a link with the + button, or share one to AnyLink from Safari. That library stays on the iPhone and in the user's iCloud.

Signing in is optional and free. It moves the library into the user's AnyLink account, so the same library is on the web at https://www.anylink.space. It also adds AI summaries and tags, price alerts, share links and export. Sign in from the Profile tab, with Sign in with Apple or the demo account below. Without an account, sharing a collection asks you to sign in.

The app has no in-app purchases.

Demo account: <email> / <password>

Delete account is in the Profile tab when signed in.
```

## In-app purchases

**Parked: none in 1.0.** Kept for when Pro comes back (§ Parked).

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
- **Category:** Productivity, with Lifestyle as the secondary (set).
- **iPad:** `ios/project.yml` builds for iPhone and iPad (`TARGETED_DEVICE_FAMILY: "1,2"`), so App Store Connect will
  ask for iPad screenshots too. Make it `"1"` for 1.0 if iPad should wait for its own phase.
- **Age rating:** set to 17+. Unrestricted web access, user-generated content and social media are answered yes.
- **App preview:** `design/app-store/anylink-promo-9x16.mp4` is 1080 × 1920, 20 s, H.264 at 30 fps. That size only
  fits the 5.5" iPhone slot; current iPhones take 886 × 1920, so it needs re-cutting. Apple also wants previews to be
  screen captures of the app, and this one is a designed animation, so it may be refused. Screenshots alone are fine.
