# Pro build plan

Work **one phase per Claude Code session**, in order, unless a phase says it can move. Every phase ends at a
**gate**: its acceptance list passes, the checks below are green, and a summary is appended to
`docs/pro-progress.md`. Create that file in Phase 1, using the section layout of `ios/docs/progress.md`.

The decision behind this plan is `docs/adr/0002-free-libraries-stay-on-their-platform.md`. The terms are in
`CONTEXT.md` § Plans and § Link detail.

> Prompt: *"Read docs/pro-build-plan.md and do Phase N. Stop at the gate."*

## What ships

| | Free | Pro |
| --- | --- | --- |
| Library | Local library on iOS (iCloud, no account), or a server library on web (account) | One server library for web and iOS |
| Saving, collections, tags, notes, images, highlights, reader view, smart collections, import with AI grouping, share extension, widgets, Shortcuts, Spotlight, Chrome extension (needs a web account) | Yes | Yes |
| Save enrichment | Title, hero image, reading time, content type without AI | Adds AI summary and tags, and the headless-browser retry |
| Link detail | Generic layout | Templates: e-commerce (price history and price alert), article, video, recipe |
| Link health checks, share links, export as HTML, JSON or CSV | No | Yes |

Pro costs $2.99 a month, $19.99 a year or $49.99 lifetime. Lifetime has a fair-use cap of about 1,000 AI saves a
month. Pro is sold only in the App Store:

- `com.shaggspeare.anylink.pro.monthly` and `com.shaggspeare.anylink.pro.yearly`, in one subscription group
- `com.shaggspeare.anylink.pro.lifetime`, a non-consumable

Existing accounts are grandfathered to Pro.

## Rules for these phases

- Each phase changes server, web and iOS together, and the root `CLAUDE.md` parity rule applies. The `ios/CLAUDE.md`
  rule against touching backend code covers `ios/docs/08-build-plan.md` phases, not these.
- Before writing web code, read the relevant guide in `node_modules/next/dist/docs/` (see `AGENTS.md`).
- iOS work follows `ios/CLAUDE.md`, including its definition of done. Write a screen's copy into
  `ios/docs/04-screens.md` before building the screen.
- Approving this plan approves the data model, API and dependency changes it names. Ask before making any others.
- Pro checks go inside each gated action in `src/lib/db/actions.ts`. The web app calls those actions directly; the
  `/api/v1/actions` dispatcher serves only iOS.
- Never put helpers in `actions.ts`. It is a `"use server"` file, so every export becomes a public endpoint.
- A Pro refusal returns `{ ok: false, reason: "pro" }`, the same way `setPinned` reports the pin limit.
  - Don't throw: production builds hide Server Action error text.
  - Don't answer 401: iOS signs the user out on 401.
- Commit after each task: `pro-<phase>: <task>`.

**Checks at every gate:**

- `npm test`
- `npx tsc --noEmit`
- `npm run lint`
- `ios/scripts/verify.sh`
- the `xcodebuild … test` UI tests from `ios/CLAUDE.md`

## Order

Phases 1 to 5 run in order. Phases 6, 7 and 8 need only Phase 1, so they can run while the App Store Connect setup
for Phase 4 is pending. Phase 9 is last.

## Needs you

Start these early. The phase that needs each one is in brackets.

- [ ] Run each new migration in `supabase/migrations/` on production (any phase that adds one).
- [ ] Make sure the app ID has App Attest and iCloud, with the CloudKit container `iCloud.com.shaggspeare.anylink`,
      if automatic signing doesn't turn them on (2, 3).
- [ ] Test on a real iPhone: App Attest doesn't run in the simulator (2, 3, 5).
- [ ] App Store Connect (4):
  - [ ] the Paid Apps agreement, tax and banking
  - [ ] the Small Business Program
  - [ ] the app record and the three products
  - [ ] the server notification URL
  - [ ] a sandbox tester
- [ ] `APPLE_APP_ID` in Vercel (4).
- [ ] A Chrome Web Store developer account, and the extension's redirect URL in Supabase Auth (8).
- [ ] Deploy the CloudKit schema to production, then submit the app and the extension (9).

---

## Phase 1 · Plan on the server

**Goal:** the server knows each account's plan, enforces every Pro rule, and tells both apps the plan.

**Read:**
- ADR 0002
- `src/lib/db/current-user.ts`
- in `src/lib/db/actions.ts`: `setPinned`, `setCollectionShared`, `setAlertThreshold`, `createLink` and `groupInbox`
- `src/lib/crawler/index.ts`
- `src/app/api/crawl/route.ts`
- `getLibraryData` and `sharedCollectionRows` in `src/lib/db/queries.ts`
- `src/lib/db/check-links.ts`
- `src/app/api/cron/price-check/route.ts`
- `src/app/layout.tsx` and `src/lib/store.tsx`

**Tasks:**
1. Create `src/lib/plan.ts`, a plain module with `isPro(plan)`. Phase 4 adds expiry and fair use to it.
2. In `current-user.ts`, add a request-cached `currentPlan()` that reads `users.plan`. Signed-out callers are free.
3. Gate `setCollectionShared` (turning sharing on only) and `setAlertThreshold`.
   - Web: the share dialog and the price alert input show a "Pro feature" notice until Phase 4 adds the dialog.
   - iOS: map the reason to `AppError.proRequired` next to `pinLimit`, and show it as a toast for now.
4. Give `crawlUrl` an options argument, `{ ai, browser }`.
   - A free crawl skips `enrichWithLLM` and the three `parseWithBrowser` retries, so the existing fallback chain
     runs: microlink, then salvage, then `metadataFloor`.
   - `/api/crawl` and `createLink` pass the plan in. Look the plan up before `after(fillFromPage)`, which runs
     outside the request.
   - Signed-out web visitors get free crawls too.
5. `groupInbox` keeps AI for everyone: import grouping is free, capped by `GROUP_LIMIT`.
6. Crons:
   - price-check joins `users` and keeps only `plan = 'pro'`.
   - `linksNeedingCheck` adds the same join only when no `userId` is passed. The import dead-link check stays free.
7. Share links pause.
   - `sharedCollectionRows` selects the owner's plan. When the owner is free, the collection reads as not found for
     viewers, for the shared API and for `saveFromShare`.
   - The token is kept, so going Pro brings the same link back.
   - The owner's share dialog says the link is paused.
8. Send the plan to both apps.
   - `getLibraryData` returns `plan`, and `layout.tsx` passes it into `LibraryProvider`.
   - iOS `LibrarySnapshot` decodes `plan` and treats a missing value as free.
9. Add the migration `supabase/migrations/20261102000000_grandfather_pro.sql`. It sets every existing account to Pro
   and is safe to rerun.

**Gate:**
- A free account's save makes no OpenAI call and launches no Chromium (check the logs). It still gets a title, image
  and reading time.
- A free account can't turn on sharing or set a price alert, on web or iOS. It sees a Pro notice and stays signed in.
- The crons skip a free account's links and include a Pro account's.
- A free owner's share link reads as not found. Making the owner Pro brings back the same link.
- iOS decodes the library with and without `plan`.
- Existing accounts read as Pro.

**Needs you:** run the migration on production.

## Phase 2 · Calls without an account

**Goal:** the server serves an iOS install that has no account: crawl, import link checks and AI grouping. Apple's
App Attest verifies each call, and the server stores nothing.

**Read:**
- `src/app/api/crawl/route.ts`, `src/app/api/import/check/route.ts` and `src/lib/db/check-links.ts`
- `groupInbox` and `src/lib/rank/group-links.ts`
- `LiveCrawler.swift` and `LiveAPI.swift` in AnyLinkKit Networking
- Apple's App Attest guides "Establishing your app's integrity" and "Validating apps that connect to your server"

**Tasks:**
1. Migration: `app_attest_keys`, holding the key id, public key, sign counter, environment, and created and last-used
   times.
2. Key registration.
   - `GET /api/attest/challenge` returns a short-lived challenge signed with a server secret, so no table is needed.
   - `POST /api/attest/register` verifies an attestation for `<team id>.com.shaggspeare.anylink` and stores the key.
3. Add a `verifyAssertion(request)` helper.
   - The key id and the assertion travel in headers and sign the SHA-256 of the body.
   - The counter must go up on every call.
   - A failure answers 403, never 401.
4. Pick an App Attest verification library, or write the check with `node:crypto` and a small CBOR decoder. Record
   the choice in the progress summary. This plan approves one such dependency.
5. Routes for installs without an account, all requiring a valid assertion:
   - `/api/crawl` accepts an assertion instead of a session. It runs a free crawl, with a daily cap per key instead
     of the per-IP limit.
   - `POST /api/v1/local/check`: a dead-link check for a list of URLs, reusing the import check.
   - `POST /api/v1/local/group`: AI grouping for a list of link summaries, reusing `groupLinks` with the
     `groupByMetadata` fallback.
6. Write the daily caps per key (crawl, check, group) as a pure function, with a node:test.
7. Add `AppAttestClient` to Networking on iOS.
   - It creates and attests one key per install and keeps the key id in the shared keychain.
   - It signs each request.
   - If Apple rejects the key, it registers again once.
   - `LiveCrawler` and a new `LocalServices` client use it when there is no session.
8. Simulator and DEBUG builds can't attest. They send a dev header carrying `APP_ATTEST_DEV_SECRET` from the
   xcconfig, and the server honours it only when that variable is set. Never set it in production.

**Gate:**
- On a real iPhone, the first launch registers a key, and crawl, check and group succeed.
- A replayed assertion or a changed body gets 403, and nobody is signed out.
- The simulator works with the dev secret and fails without it.
- A key over its daily cap gets 429.
- Calls verified this way write no links or collections.

**Needs you:** make sure App Attest is on for the app ID, and run the gate on a real iPhone.

## Phase 3 · Local library on iOS

**Goal:** a new iOS user saves links with no account. Their local library lives in SwiftData and syncs through
their private CloudKit database. The share extension, widgets, intents and Spotlight all work with it.

**Read:**
- ADR 0002
- `ios/docs/02-architecture.md` and `ios/docs/10-decisions.md` (D21)
- `AppEnvironment.swift`, `RootView.swift`, `WelcomeView.swift` and `RouteViews.swift`
- in AnyLinkKit: `LibraryStore.swift`, `Networking.swift`, `MockAPI.swift`, `Persistence.swift`,
  `ShareSession.swift` and `OnboardingModel.swift`
- `ShareViewController.swift`, `AnyLinkWidgets.swift` and `SaveLinkIntent.swift`
- Apple's "Syncing model data across a person's devices"

**Tasks:**
1. Docs first.
   - Add the local library to `ios/docs/10-decisions.md` as a decision that replaces D21 for free users.
   - Update the persistence section of `02-architecture.md`.
   - Write the local-mode copy and states into `04-screens.md`: first launch without sign-in, Settings, and iCloud
     unavailable.
2. Add `LocalStore` to Persistence, using SwiftData models that CloudKit accepts.
   - One record per link and one per collection. Each holds the existing Codable model as JSON, plus `id` and
     `updatedAt`.
   - Every property has a default, and nothing uses `@Attribute(.unique)`.
   - Image items keep their bytes in `.externalStorage`.
   - It is a separate store in the App Group container, opened with
     `ModelConfiguration(cloudKitDatabase: .private("iCloud.com.shaggspeare.anylink"))`.
3. Add `LocalAPI` to Store. It implements `AnyLinkAPI` over `LocalStore`.
   - It takes the import dedupe and collection logic from `MockAPI`.
   - Crawls, import checks and grouping go through Phase 2's `LocalServices`.
   - Creating collections and filters works offline.
   - `setShared` and `setPriceAlert` return Pro required.
   - Hero images stay remote URLs. Add `// ponytail: remote hero URLs; cache them on device if hotlink blocks show up.`
4. Refresh `LibraryStore` when CloudKit brings in remote changes, and when the app comes to the foreground.
5. Replace guest mode with the local library.
   - `AppEnvironment.local()` takes over from `.guest()`.
   - The first launch opens the library directly. Welcome keeps "Sign in" for Pro accounts.
   - Remove `guestLimit` and its checks in `LibraryStore` and `RouteViews`, `adoptGuest`, and `Guest.store`.
6. Extensions.
   - The share extension saves a PendingSave for a local library instead of asking the user to sign in.
   - The app drains PendingSaves into `LocalAPI`.
   - The app writes `WidgetSummary` in local mode too.
7. Settings in local mode hides the display name and Delete account. It shows "Sign in" and the iCloud status.
8. In `project.yml`, add iCloud with the CloudKit container and the remote-notification background mode. Then run
   `xcodegen generate`.
9. Tests.
   - `LocalAPI` on an in-memory container: create, move, tag, trash and restore, import dedupe, a snapshot round
     trip, and draining PendingSaves.
   - Update the UI tests that assumed guest mode.

**Gate:**
- On a fresh install there is no sign-in wall. Three saves show a title, image and reading time, and the server has
  no rows for them.
- Two simulators on one iCloud account, using CloudKit development: a save and a move on one appear on the other
  after it comes to the foreground.
- The share extension and the Save intent work with the app closed. The links are enriched when the app opens.
- Widgets show recent saves.
- A bookmark import groups links and flags dead ones.
- Without iCloud, the app still works on one device and says that sync is off.

**Needs you:** make sure iCloud is on for the app ID, sign both simulators into one iCloud account, and run one
check on a real iPhone.

## Phase 4 · App Store billing and paywall

**Goal:** people buy Pro in the iOS app. The server records the purchase and keeps it current. Both apps show the
plan, and web points people to the iOS app.

**Read:**
- through context7: StoreKit 2 (`Product`, `Transaction`, `appAccountToken`), App Store Server Notifications V2,
  and Apple's App Store Server Library for Node
- `Auth.swift`, `WelcomeView.swift` and `SettingsView.swift`
- `src/app/settings/page.tsx`
- `src/lib/plan.ts`

**Tasks:**
1. Write the copy and states for the paywall and the web Pro dialog into `ios/docs/04-screens.md`. The web dialog
   reuses that copy.
2. Plan expiry.
   - Migration: add `users.plan_product` and `users.plan_expires_at`.
   - `isPro` becomes: the plan is pro, and either there is no expiry or the expiry is still ahead. Grandfathered
     rows have no product and count as lifetime.
   - Use the same rule in the cron filters and the share-link check.
   - Cover it with a table test in `src/lib/plan.test.ts`.
3. Server verification uses Apple's `@apple/app-store-server-library`, with `SignedDataVerifier` and Apple's root
   certificates committed to the repo.
   - `POST /api/v1/billing/apple` (signed in) verifies a transaction from the app. It rejects the transaction unless
     its `appAccountToken` is the user's id, then sets the plan.
   - `POST /api/billing/apple/notifications` takes App Store Server Notifications V2. Renewal, expiry, grace period,
     refund and revoke update the plan. Any other type is logged and ignored.
4. Lifetime fair use: once a lifetime account has saved 1,000 links in a calendar month, its crawls are free crawls
   until the next month. Add `// ponytail: counts links, not AI calls; count AI calls if this gets abused.`
5. StoreKit 2 on iOS.
   - Add an `AnyLink.storekit` configuration with the three products.
   - Add a `ProStore` that loads the products and buys with `appAccountToken` set to the Supabase user id.
   - From launch, it listens to `Transaction.updates` and posts each verified transaction to the server.
   - Restore runs `AppStore.sync()`.
6. Buying needs an account. The paywall runs the existing sign-in (Apple, Google, email) first, then the purchase.
   Once the server confirms, Phase 5 moves the library.
7. The iOS paywall.
   - It shows the Pro benefits, the three products with their `displayPrice` (yearly preselected), and Restore.
   - It links to the Terms of Use (Apple's standard EULA) and the Privacy Policy.
   - Settings gets Manage Subscription and "Sync with web".
   - Share and price alert open the paywall now. Later phases add their own entry points.
8. Web gets one Pro dialog: "Pro is sold in the AnyLink iOS app", with the App Store link once it exists.
   - Every `{ ok: false, reason: "pro" }` and every Pro control opens it.
   - Settings shows the plan.

**Gate:**
- In the simulator, with the StoreKit configuration:
  - buying monthly, yearly or lifetime each turns the account Pro within seconds
  - Restore works on a fresh install
- In the sandbox on a real iPhone:
  - an accelerated renewal keeps Pro
  - expiry turns the account free through the notification
  - a refund test notification turns it free
- A tampered transaction is rejected, and so is one carrying another user's `appAccountToken`.
- Web shows the Pro dialog and the plan.
- Tests cover the `isPro` table, notification handling with the verifier stubbed, and `ProStore` under a
  StoreKitTest session.

**Needs you:** in App Store Connect:
- the Paid Apps agreement, tax and banking
- the Small Business Program
- the app record
- the subscription group "AnyLink Pro", with monthly at $2.99 and yearly at $19.99
- lifetime at $49.99
- the notification URL `https://www.anylink.space/api/billing/apple/notifications`, for production and sandbox
- a sandbox tester

Then set `APPLE_APP_ID` in Vercel.

## Phase 5 · Upgrade and lapse

**Goal:** going Pro moves the local library into the server library without losing anything, and merges it with any
web library. A lapse returns iOS to a local library, again without losing anything.

**Read:**
- `CONTEXT.md` (Upgrade, Lapse)
- the Phase 3 and 4 code
- `LibraryStore.swift`: refresh, apply and the outbox
- `importLinks` and `saveFromShare` in `actions.ts`
- `getLibraryData`

**Tasks:**
1. Migration: `links.client_id`, nullable and unique per user.
2. Add a Pro-only `uploadLibrary` action.
   - Collections match by name. Links match by normalized URL. Notes and images match by `client_id`.
   - A match merges tags, highlights and notes, and keeps the earliest save date.
   - It takes batches of 200. Running it again creates nothing new.
   - The merge rule is a pure function with a node:test table.
3. Upgrade on iOS. Once the server confirms Pro:
   - Upload the local library in batches, with a progress screen. The upload resumes if the app is killed.
   - Switch to server mode: `LiveAPI` plus the offline cache.
   - Leave the local store untouched as a backup.
4. Uploaded links get their AI summary the first time a Pro user opens one, not in bulk. Add
   `// ponytail: lazy backfill bounds AI cost; backfill in bulk if users ask.`
5. Lapse on iOS. When the library comes back with `plan: free` in server mode:
   - Copy the server library into the local store as a union, deleting nothing.
   - Switch to local mode.
   - Stay signed in, so web keeps working.
   - Show a one-time notice.
6. Resubscribing works the same way as upgrading. Only links added during the lapse upload as new.
7. Tests: the merge rule, plus the upgrade and lapse transitions in Swift against stub APIs.

**Gate:**
- Upgrade a local library holding 50 links, 3 collections, notes, highlights and one image. Web shows all of it with
  no duplicates, and running the upload again adds nothing.
- An account with an overlapping web library merges without duplicates.
- After expiry:
  - iOS keeps everything, in local mode
  - links saved on web after that don't reach iOS
  - links saved on iOS during the lapse upload once on resubscribe
- Killing the app mid-upload, then relaunching, finishes the upload.

**Needs you:** one sandbox run on a real iPhone: buy, check web, let it expire, then check iOS.

## Phase 6 · Detail templates

Needs only Phase 1.

**Goal:** Pro accounts get detail templates for e-commerce, article, video and recipe on web and iOS. Free accounts
get the generic layout.

**Read:**
- `src/components/link-detail-view.tsx`, `product-panel.tsx` and `reader-panel.tsx`
- in `src/lib/crawler/parse-page.ts`: `detectContentType`, the JSON-LD parser and the Readability call
- `src/lib/structure/structure-content.ts`, `src/lib/types.ts` and `src/lib/db/schema.ts`
- on iOS: `Models.swift`, `ProductView.swift` (`LinkDetailView`), `ReaderView.swift`, `LinkTile.swift` and
  `QueryLanguage.swift`
- the video player note in `docs/ios/02-features-and-ios-native.md`

**Tasks:**
1. Ship this first: iOS decodes an unknown `ContentType` as `.article` instead of failing. Today one unknown value
   fails the whole library and the offline cache. Add a test.
2. Add the `recipe` content type.
   - Add a migration: `ALTER TYPE content_type ADD VALUE IF NOT EXISTS 'recipe'`.
   - Add it to `types.ts` and to the iOS `ContentType`.
   - Handle it everywhere the code branches on content type. Find those places with
     `grep -rn "contentType\|content_type" src` and `grep -rn "ContentType\|contentType" ios`. There are about 15 on
     web and 10 on iOS.
   - Support `type:recipe` in the query language.
3. Add a `links.template_data` jsonb column for what each template needs. None of it uses AI.
   - Article: author and published date. Readability already returns them as `byline` and `publishedTime`, and
     today the code throws them away.
   - Video: provider, video id, channel and duration, taken from the URL, VideoObject JSON-LD or oEmbed.
   - Recipe: ingredients, steps, prep, cook and total time, and yield, taken from Recipe JSON-LD.
   - Product data stays in `product_data` and the price tables.
   - Detection checks for Recipe JSON-LD before falling back to article.
   - The AI's list of allowed types adds recipe.
4. Finish the e-commerce template. The price tracking it takes over is only half built:
   - Set `previousPrice`.
   - Compare the latest price with the alert threshold, and show an "under your price" badge in-app on both
     platforms.
   - Hide the specs block when it's empty.
   - Remove `FeatureFlags.pricePush` and its placeholder toggle.
5. Templates on web and iOS:
   - e-commerce: the product panel
   - article: the reader view, plus the AI summary and the byline
   - video: new; a privacy-enhanced YouTube or Vimeo embed, in a WKWebView on iOS
   - recipe: new; a checkable ingredient list, the steps and the times
6. The generic layout for free accounts: hero image, title, site, note, Open original, and the reader body for
   articles. It is today's reader panel minus the Pro parts. Its upsell opens the paywall or the Pro dialog.
7. Write the copy and states for the new screens into `ios/docs/04-screens.md`.

**Gate:**
- node:test fixtures cover:
  - Recipe JSON-LD, giving the type and the ingredients
  - YouTube and Vimeo ids
  - the article byline and date
- A library with an unknown content type still loads on iOS.
- Each of the four types looks right on web and iOS, for Pro and for free. Capture screenshots.
- A price under the threshold shows the badge on both platforms.
- Searching `type:recipe` works on both platforms.

## Phase 7 · Export

Needs only Phase 1.

**Goal:** Pro accounts export their library as Netscape bookmark HTML, JSON or CSV, on web and iOS.

**Read:**
- `parseBookmarks` in `src/lib/import/parse.ts`
- `ImportParsers.swift` in AnyLinkKit Store
- `src/app/settings/page.tsx` and `SettingsView.swift`
- `getLibraryData`

**Tasks:**
1. Create `src/lib/export.ts` with three pure functions:
   - Bookmark HTML: collections become `<H3>` folders, with `ADD_DATE` and `TAGS`.
   - JSON: collections, and links with their notes, tags and highlights.
   - CSV: URL, title, collection, tags, note, saved date and excerpt, quoted per RFC 4180.
2. Add `GET /api/v1/export?format=html|json|csv`, Pro only, answering with a file attachment.
3. Web: add Export buttons under "Your library" in Settings.
4. iOS: add an Export row in Settings that downloads the file and hands it to the share sheet.
5. Free accounts get the Pro dialog or the paywall.
6. Skip re-importing AnyLink JSON for now. Add it when someone asks to restore from it.

**Gate:**
- An HTML export of a fixture library re-parses with `parseBookmarks` to the same URLs and folders.
- CSV escapes commas, quotes and line breaks.
- JSON keeps every field.
- On both platforms, Pro gets all three files and free sees the Pro screen.

## Phase 8 · Chrome extension

Needs only Phase 1.

**Goal:** anyone with a web account saves the current tab to a collection from Chrome.

**Read:**
- `current-user.ts` (Bearer tokens)
- `src/proxy.ts`, whose matcher skips `api/v1`
- the redirect URLs section of `docs/auth-setup.md`
- `createLink` and `GET /api/v1/library`
- Chrome's docs on Manifest V3, `chrome.identity` and `chrome.storage`

**Tasks:**
1. Put the extension in `extension/` at the repo root.
   - Manifest V3, with an action popup and a service worker.
   - Plain JavaScript, no bundler.
   - Permissions: `activeTab`, `storage` and `identity`, plus host permission for `https://www.anylink.space/*`.
   - Pin the extension id with the manifest `key`.
2. Sign-in.
   - Use `chrome.identity.launchWebAuthFlow` against Supabase's authorize endpoint, with PKCE over plain `fetch`.
   - Offer Google and Apple, plus email and password through the token endpoint.
   - Keep the session in `chrome.storage.local`, and refresh it before it expires.
3. The popup shows the tab's title and URL, and a collection picker filled from `/api/v1/library`. Add
   `// ponytail: loads the whole library; add a collections-only endpoint if large libraries make it slow.`
4. Saving.
   - Save sends `createLink` from the service worker to `/api/v1/actions`, with a Bearer token, so the server needs
     no CORS change.
   - After the save, the popup shows "Saved", which opens the link in AnyLink.
5. Free and Pro accounts work the same. A signed-out user sees Sign in.
6. Add an npm script that zips `extension/` for the Chrome Web Store.

**Gate:**
- Loaded unpacked, the extension signs in with Google and with email.
- It saves a tab into a chosen collection, and the link shows up enriched on web.
- The session still works after an hour, so token refresh works.
- The zip builds.

**Needs you:** create a Chrome Web Store developer account, and add `https://<extension id>.chromiumapp.org/` to
Supabase's redirect URLs.

## Phase 9 · Launch

**Goal:** the app, Pro and the extension are submitted, and the landing page sells Pro.

**Read:** `src/app/page.tsx`, `src/app/privacy-policy/page.tsx`, `design/app-store/` and `docs/auth-setup.md`.

**Tasks:**
1. Landing page: add a pricing section after "How it works". It shows the Free and Pro table, the three prices and
   the App Store badge.
2. Privacy policy: cover the local library in iCloud, App Attest, purchases, and what Pro stores on the server.
3. App Store listing:
   - name, subtitle, description, keywords and promotional text
   - screenshots taken from the simulator
   - the promo video in `design/app-store/` as the app preview, if it meets Apple's specs
   - privacy labels
   - review notes, with a demo Pro account
4. Add the new environment variables and the Apple setup to `docs/auth-setup.md`.
5. Write a TestFlight QA script and run it. It covers:
   - a free account on two devices
   - each purchase
   - upgrade and lapse
   - each template, on both plans
   - export
   - share links
   - the extension

**Gate:**
- The TestFlight build passes the QA script.
- The app and the extension are submitted.
- The landing page shows pricing.

**Needs you:**
- Deploy the CloudKit schema to production in the CloudKit Console.
- Approve the listing copy and the privacy labels.
- Submit the app and the extension for review.
