# Pro progress

One section per phase of `docs/pro-build-plan.md`, in the order they landed. "Waiting on you" collects every step
only the user can do.

## Waiting on you

- [ ] Supabase → Authentication → URL Configuration → Redirect URLs: add
      `https://naiejkkikjnpbfhdppghkehemjlmocjk.chromiumapp.org/**` for the unpacked Chrome extension (Phase 8).
- [ ] Create a Chrome Web Store developer account. Upload `build/anylink-extension.zip` (from `npm run zip:extension`)
      without publishing, then add `https://<store id>.chromiumapp.org/**` to the same Supabase list (Phase 8).
- [ ] Optional: `example_user@anylink.local` (a placeholder account) was grandfathered to Pro too, so the crons
      still check its links. Set it back to free if you don't want to pay for those checks (Phase 1).
- [ ] Two iOS UI tests, `testAccessibilityAuditTopLevelScreens` and `testAccessibilityAuditSecondaryScreens`, fail on
      iOS 26.5 with contrast warnings on Trash, Profile and Search. They fail before the Pro work too (Phase 1).

- [ ] **Set `APP_ATTEST_SECRET` in Vercel → Production**, then redeploy. Use any long random string, e.g. the
      output of `openssl rand -base64 48`. I wasn't allowed to write secrets. Until it's set, `/api/attest/*` answer
      503: iOS installs without an account fall back to the per-IP crawl limit, and import checks and grouping fail
      for them (Phase 2).
- [ ] Never set `APP_ATTEST_DEV_SECRET` in Production. It's only for testing the simulator against a local or preview
      server, with the same value in `ios/Config.xcconfig` (Phase 2).
- [ ] Make sure App Attest is on for the App ID `com.shaggspeare.anylink`. Automatic signing usually adds it on the
      first build to a device (Phase 2).
- [ ] Run Phase 2's real-iPhone checks below (Phase 2).

- [ ] Ship a new iOS build (TestFlight) soon. Builds from before Phase 6 can't read the `recipe` type, so the server
      sends them `article` instead. Once no older build is installed, delete `src/lib/ios-types.ts` and the
      `X-AnyLink-Types` header; its `ponytail:` comment marks them (Phase 6).

- [ ] **App Store Connect** (Phase 4):
  - the Paid Apps agreement, tax and banking
  - the Small Business Program
  - the app record for `com.shaggspeare.anylink`
  - the subscription group "AnyLink Pro":
    - `com.shaggspeare.anylink.pro.monthly` at $2.99
    - `com.shaggspeare.anylink.pro.yearly` at $19.99, at the same level
  - `com.shaggspeare.anylink.pro.lifetime` at $49.99, a non-consumable
  - the V2 server notification URL `https://www.anylink.space/api/billing/apple/notifications`, for production and
    sandbox
  - a sandbox tester
- [ ] Set `APPLE_APP_ID` in Vercel → Production: the numeric Apple ID from App Store Connect → App Information. Until
      it's set, Production purchases and notifications are refused. Never set `APP_STORE_ALLOW_XCODE` on Vercel
      (Phase 4).
- [ ] Once the listing exists, set `APP_STORE_URL` in `src/lib/pro.ts`. Until then, the dialog says
      the app is coming to the App Store (Phase 4).
- [ ] Run `AnyLinkTests` → `ProStoreTests` from Xcode. Apple's simulator bug FB22237318 stops them under
      `xcodebuild`, so they skip themselves there (Phase 4).

- [ ] Make sure the App ID has **iCloud** (CloudKit container `iCloud.com.shaggspeare.anylink`) and **Push
      Notifications** turned on, if automatic signing doesn't add them on the first build to a device (Phase 3).
- [ ] Two-device iCloud sync check, and the real-iPhone pass for the local library. Both are listed under Phase 3
      below (Phase 3).

## Deploys and database changes

| When (UTC) | What | Notes |
| --- | --- | --- |
| 2026-10-31 night | Migration `20261102000000_grandfather_pro.sql` applied | All 6 accounts are now `pro` |
| 2026-10-31 night | Production deploy of Phases 1 and 8 (`main` fast-forwarded to `pro` at `a478877`) | Smoke test passed: `/`, `/app` and `/privacy-policy` return 200, `/api/v1/library` returns 401, and a signed-out crawl gets no AI tags |
| 2026-10-31 night | Migration `20261103000000_app_attest_keys.sql` applied | Empty table, row-level security on |
| 2026-10-31 night | Migration `20261103010000_app_attest_daily.sql` applied | Daily ceiling of 300 account-less groupings across all keys |
| 2026-10-31 night | Production deploy of Phases 2 and 7, plus the security fixes (`main` at `2fb7176`) | Smoke test passed. `/api/attest/challenge` answers 503 until `APP_ATTEST_SECRET` is set, and production ignores `X-AnyLink-Dev` |
| 2026-10-31 night | Migration `20261105000000_templates.sql` applied | `content_type` gains `recipe`; `links.template_data` added |
| 2026-10-31 night | Production deploy of Phase 6 (`main` at `7a15a5e`) | Smoke test passed. A live crawl of a recipe page answers `article` without `X-AnyLink-Types` and `recipe` with it, ingredients included |
| 2026-11-01 early | Migration `20261104000000_plan_expiry.sql` applied | `users.plan_product` and `users.plan_expires_at` added. All 6 accounts are Pro with no expiry (lifetime) |

Vercel preview builds fail because the project has no Preview environment variables. Only production deploys work.
An unknown share link renders the not-found page with HTTP 200 instead of 404 (a soft 404). That happens when the
page has already started streaming.

## Phase 8 · Chrome extension

**Status:** built, and the automated checks pass. Real sign-in and a real save are waiting on the Supabase redirect
URL.

### Done
- `extension/`: Manifest V3 in plain JavaScript.
  - Sign-in with Google and Apple goes through `chrome.identity` with PKCE. Email and password sign-in is also
    supported.
  - The session is kept in `chrome.storage.local` and refreshed only once, even when two calls need it at the same
    time.
  - The popup shows the tab, a collection picker and Save, then "Saved. Open it in AnyLink", plus a signed-out state.
- `npm run zip:extension` builds the store zip, without the manifest `key`.
- `extension/background.test.js` runs with `npm test`.

### Deviations
- Sign-up and password reset aren't in the extension. Those links open `anylink.space/login`.
- The token is refreshed when it's used, not on a timer, so the extension doesn't need the `alarms` permission.
- Links saved from the extension record their source as `extension`.

### Check by hand
Full steps are in `extension/README.md`.
1. Add the redirect URL, then load `extension/` unpacked. Its id should be `naiejkkikjnpbfhdppghkehemjlmocjk`.
2. Sign in with Google, then with email.
3. Save a tab into a collection. It should appear on the web, with an image and an excerpt.
4. Force a token refresh: in the service worker console, run
   `chrome.storage.local.get("session").then(({session}) => chrome.storage.local.set({session: {...session, expiresAt: 0}}))`.
   Reopen the popup; the collections should load.

## Phase 1 · Plan on the server

**Status:** done, and the checks pass. Checks that need the live server are below.

### Done
- `src/lib/plan.ts` has `isPro` and `PRO_REQUIRED`. `currentPlan()` in `current-user.ts` reads `users.plan` once per
  request.
- Turning on sharing and setting a price alert refuse free accounts with `{ ok: false, reason: "pro" }`.
  - Web disables those controls and shows a Pro notice.
  - iOS turns the refusal into `AppError.proRequired` in one place (`LiveAPI.action`) and shows a toast. It never
    signs the user out.
- Free crawls skip the AI step and the headless-browser retries. Signed-out web visitors get free crawls too.
- Import grouping keeps AI for everyone.
- The crons cover Pro accounts only. The import dead-link check stays free.
- A free owner's share link reads as not found. The token is kept, so going Pro brings the same link back, and the
  owner's dialog says the link is paused.
- The library payload carries `plan` on web and iOS. A missing value means free.
- Migration `20261102000000_grandfather_pro.sql` makes every account created before 2026-11-02 00:00 UTC Pro.

### Deviations
- The migration has a cutoff, so running it again never upgrades later sign-ups.
- `MockAPI` and the fixtures report `plan: "pro"`, so previews and UI tests behave as before.

### Not done
- Two pieces of copy are now wrong for free accounts, and later phases fix them:
  - The product page says prices are "checked twice daily" (Phase 6).
  - The tour mentions the browser retry (Phase 9).

### Check by hand
1. Make a free test account: sign up a new one, or run
   `update public.users set plan = 'free' where email = '<test>';`.
2. Check the web app as the free account:
   - The share switch is disabled and says "Share links are a Pro feature."
   - A product page says "Price alerts are a Pro feature."
   - A save gets a title, image and reading time, with no AI tags.
   - In Vercel Logs, that `POST /api/crawl` makes no call to api.openai.com.
3. Check iOS as the free account: turning on sharing shows the toast "That's a Pro feature.", and you stay signed in.
4. Check that share links pause:
   - As Pro, share a collection.
   - Set the owner's plan to free. The link should return 404.
   - Set the plan back to pro. The same link should work again.
5. Call `/api/cron/price-check` with `Authorization: Bearer $CRON_SECRET`. Only Pro accounts' products should get new
   price snapshots.

## Phase 2 · Calls without an account

**Status:** done, and the offline checks pass. Before the device checks, three things have to happen:
- `APP_ATTEST_SECRET` is set in Vercel.
- App Attest is on for the App ID.
- A deploy goes out.

### Done
- The App Attest checks are hand-written on `node:crypto` in `src/lib/app-attest.ts`, with no new dependency.
  - They cover the certificate chain to Apple's App Attestation root, the nonce, the key id, rpIdHash, aaguid and the
    counter.
  - The tests use real Apple development and production attestations, plus a real assertion.
- `GET /api/attest/challenge` returns an HMAC challenge that lasts 5 minutes. `POST /api/attest/register` stores a
  key once.
- `verifyAssertion` reads the key id and the assertion from headers. The assertion signs the SHA-256 of the body, and
  the counter only goes up.
  - A failure answers 403 with a reason: `attestation-required`, `unknown-key`, `replay` or `invalid`.
  - A key over its cap gets 429. Nothing answers 401.
- Daily caps per key: 200 crawls, 5,000 checked links and 10 groupings.
- `/api/crawl` accepts an assertion instead of a session. `POST /api/v1/local/check` and `POST /api/v1/local/group`
  serve installs without an account, and neither stores links or collections.
- On iOS, `AppAttestClient` and `LocalServices` live in AnyLinkKit. Guest crawls are signed. The App Attest
  entitlement is development in Debug and production in Release.
  - On the simulator, DEBUG builds send `X-AnyLink-Dev`. The server accepts it only where `APP_ATTEST_DEV_SECRET` is
    set.

### Security review
An independent review of the App Attest code found nothing critical or high. Its fixes are merged:
- A version check on the key row, so racing calls can't get past the daily cap.
- A daily ceiling of 300 account-less groupings across all keys.
- The dev bypass is off on Vercel production and needs a secret of 32 or more characters.
- A test that fails if the leaf certificate isn't checked.

Development keys are still accepted in production, so a Debug build on a real iPhone can be tested. Refuse them
before the App Store launch (Phase 9).

### Deviations
- The local check takes `{ id, url, title }`, not bare URLs, so dead links can be listed by title.
- The local group route creates the collection ids itself. `GROUP_LIMIT` and `SYSTEM_COLORS` moved to
  `group-links.ts`.
- Apple's fraud receipt isn't used, and registration isn't limited, so one device could register several keys.
  There's a `ponytail:` note on this.

### Check by hand
These are on a real iPhone, after the secret and a deploy.
1. Run a Debug build and add a link.
   - `select key_id, environment, sign_count, crawl_count from app_attest_keys order by created_at desc limit 1;`
     should show one development key with `crawl_count = 1`.
   - Relaunching shouldn't add a key.
2. Replay a captured `POST /api/crawl`, using Proxyman. It should get 403 `replay`.
   - Change the body and send it again. It should get 403 `invalid`.
3. Set `crawl_count = 200` for today. A new link should show the "Too many previews…" notice. Reset the count
   afterwards.
4. On production, any `X-AnyLink-Dev` header should get 403.

## Phase 7 · Export

**Status:** done, and the checks pass, including the new UI test that hands the file to Files.

### Done
- `src/lib/export.ts` writes three formats, each with a test:
  - Bookmark HTML: collections become folders. It re-parses through the importer to the same URLs, folders and dates.
  - JSON: `{ format: "anylink", version: 1, … }`.
  - CSV: RFC 4180, with a UTF-8 byte-order mark.
- `GET /api/v1/export?format=html|json|csv`, Pro only. A free account gets 403 with `{ ok: false, reason: "pro" }`.
- Web: three buttons under "Your library" in Settings.
- iOS: Settings → Export library → a format → the Files save sheet.

### Deviations
- iOS uses the Files save sheet, not the share sheet, so the download doesn't need a second tap.
- CSV cells that start with `=`, `+`, `-` or `@` get a leading `'`, so a page title can't run as a spreadsheet formula.
- Trash isn't exported. Bookmark HTML also leaves out notes and smart collections; JSON keeps them.

### Check by hand
1. Import the exported HTML into Chrome or Firefox. The folders should match your collections.
2. Open the CSV in Numbers or Excel. Non-English titles should read correctly, and commas and line breaks should stay
   inside their cells.
3. Export the JSON of a big library. Article text is included, so check the response isn't cut off by the hosting
   size limit.

## Phase 6 · Detail templates

**Status:** done on web and iOS, and the checks pass, apart from the known accessibility failure on the Search
screen.

### Done
- iOS reads an unknown content type as an article. `TemplateData` decodes one field at a time.
- Builds from before this phase don't send the `X-AnyLink-Types` header. For them, `src/lib/ios-types.ts` turns
  `recipe` into `article` in the library, shared collections, action results and crawl events.
- The `recipe` type:
  - `type:recipe` works on both platforms.
  - There's a Recipes filter in the web sidebar and the iOS Collections tab, shown only when it has links.
- `links.template_data` is filled without AI, on every save path:
  - Article: byline and date.
  - Video: provider, id, channel and duration.
  - Recipe: ingredients, steps, times and yield.
- The e-commerce template:
  - `previousPrice` is the price when the link was saved.
  - An "Under your price" badge shows when the price is at or below the alert.
  - `pricePush` and its placeholder toggle are gone.
- Pro templates on both platforms:
  - Article: byline, date and summary.
  - Video: YouTube from youtube-nocookie.com, or Vimeo with `dnt=1`. On iOS it plays in a WKWebView that keeps no
    cookies.
  - Recipe: a checkable ingredient list, the steps, the times and the yield.
- Free accounts get the generic layout, with an upsell line for each type.
- The new UI test `testTemplatesForProGenericLayoutForFree` passes. The `-free` launch argument runs the mock as a
  free account.

### Deviations
- Recipe detection runs before VideoObject, because recipe pages often embed a video.
- Older links get no `template_data` until they're saved again. A video still plays, because its id comes from the
  URL.
- Unlisted Vimeo videos won't play inline, because they need an `h=` hash that isn't stored.

### Check by hand
1. Check web as Pro:
   - A YouTube link and a Vimeo link play in place.
   - A page with Recipe JSON-LD shows the recipe card.
   - An article shows its byline and date.
   - A product with an alert set above its price shows "Under your price".
2. Check web as free: each type shows the generic layout and its upsell line.
3. Run the same checks on a new iOS build, for Pro and for free.
4. Point an older iOS build at the new server. The library should still load, with recipes shown as articles.

## Phase 4 · App Store billing and paywall

**Status:** built on server, web and iOS, and merged. Every check passes except the two baseline accessibility
audits. StoreKit purchases couldn't be driven in the simulator because of Apple's bug FB22237318. Sandbox testing and
App Store Connect are waiting on you.

### Done
- Plan expiry:
  - `isPro(row, now)` checks the plan and its expiry, in code and in SQL (`proAccounts`).
  - The crons, share links, the library and `currentPlan` all use it.
  - Accounts with Pro and no expiry are lifetime, which includes the grandfathered ones.
- `src/lib/billing/apple.ts` checks purchases with Apple's `SignedDataVerifier`, against the root certificates
  committed in `src/lib/billing/apple-roots/`.
  - `POST /api/v1/billing/apple` takes a purchase from the app and checks its `appAccountToken`.
  - `POST /api/billing/apple/notifications` handles V2 notifications.
- Lifetime fair use: after 1,000 saves in a calendar month, a lifetime account's crawls are free crawls.
- Web: one Pro dialog. Every `{ ok: false, reason: "pro" }` opens it, and so does every Pro control (share, price
  alert, export, the template upsells). Settings shows the plan.
- iOS:
  - `AnyLink.storekit`, with the three products.
  - `ProStore` buys with `appAccountToken` and listens to `Transaction.updates` from launch. It posts each
    transaction to the server, then finishes it. It also restores.
  - The paywall signs the user in first when needed. Every Pro refusal opens it.
  - Settings has AnyLink Pro, Sync with web and Manage Subscription.

### Deviations
- `ProStore` lives in the app target, with a new hosted test target `AnyLinkTests`, because StoreKitTest needs an app
  host.
- Stale events can't undo newer state:
  - Grants never shorten an expiry.
  - Ends apply only to the current product.
  - A pre-refund transaction posted again counts as a replay.
- `src/proxy.ts` skips `api/billing/`.

### Check by hand
1. Run `ProStoreTests` from Xcode. Expect 7 passes.
2. Simulator purchase sheet:
   - Clear `SUPABASE_URL` in `ios/Config.xcconfig`, run `xcodegen generate`, then ⌘R.
   - Open Profile → AnyLink Pro and buy a product.
   - Profile should show Pro.
   - Restore the xcconfig afterwards.
3. Sandbox, on a real iPhone, after the App Store Connect setup:
   - Buy Monthly. Profile and web Settings should show Pro within seconds.
   - Renewals, about every 5 minutes in the sandbox, move `plan_expires_at` forward.
   - Cancel the subscription and let it expire. The plan should turn free.
4. Web as a free account: share, price alert, export and the upsell lines each open the Pro dialog.

## Phase 3 · Local library on iOS

**Status:** built, and merged with Phases 2, 4 and 6. Every check passes except the two baseline accessibility
audits (209 package tests, zero warnings). Two-device iCloud sync and the real-iPhone checks are waiting on you.

### Done
- Decision D28 (a local library replaces D21 for free users), plus updates to the architecture doc and the screen
  specs S0, S1, S9, S18 and S19.
- `LocalStore` is `Local.store` in the App Group, mirrored to `iCloud.com.shaggspeare.anylink`.
  - Each link and collection is one record, holding the model as JSON, with no unique constraints and no
    relationships.
  - Image bytes are in external storage and sync with their link.
- `LocalAPI` implements the whole API over the store.
  - Import dedupe, collections and filters work offline.
  - Pages are read with the attested crawler.
  - The dead-link check and grouping go through Phase 2's services, and fall back to grouping by folder and domain.
  - Sharing, price alerts and export answer "Pro required", which opens the paywall.
- The library re-reads when CloudKit brings in another device's changes, and when the app becomes active.
- Guest mode is gone.
  - A new install opens its library with no sign-in wall.
  - Sign in moved to Settings.
  - A Pro account switches to the server library. A Free account keeps the local library and sees the toast "On
    Free, your iPhone and web libraries stay separate."
- The share extension saves a PendingSave for a local library, and the app files it when it opens. Widgets work in
  both modes.
- Settings in local mode shows Sign in and the iCloud sync status, and hides the display name and Delete account.
- `project.yml` adds iCloud (CloudKit), `aps-environment` and the remote-notification background mode.

### Deviations
- The dedupe, share-copy and grouping rules moved into `Networking/LibraryRules.swift`, which the mock and the local
  library now share.
- The inbox is built in, not stored, so two devices can't each create one.
- The share extension follows a `serverLibrary` flag in the App Group instead of `signedIn`.
- Reordering does nothing in a local library, because nothing in the app reorders yet.

### Check by hand
1. Two simulators or devices on one Apple Account, with iCloud on:
   - Install the Debug build on each. Profile should show "iCloud sync · On".
   - Save a link on A, then bring B to the foreground. The link should appear.
   - Create a collection on A and move the link into it. Both should appear on B.
2. Real iPhone:
   - A fresh install has no sign-in wall.
   - Three saves fill in a title, image and reading time, and Supabase `links` has no rows for them.
   - With the app force-quit, share from Safari and run "Save to AnyLink" in Shortcuts. Both links appear when the
     app opens.
   - The widget shows recent saves.
   - A Safari bookmarks import groups links and flags dead ones.
   - With iCloud off, the app still works.
   - Signing in as Pro opens the server library. Signing out brings back the local one.

## Phase 9 · Launch prep

**Status:** the code and docs are done. Device QA, screenshots and submission are yours.

### Done
- Landing page:
  - A pricing section after "How it works", with the Free and Pro cards and the three prices.
  - Production shows it, and its nav link, only once `APP_STORE_URL` is set in `src/lib/pro.ts`. Development always
    shows it.
  - `APP_STORE_URL` and the Pro benefits list now live in `src/lib/pro.ts`, shared with the Pro dialog.
- Privacy policy, dated November 1, 2026, now covers:
  - the local library in iCloud
  - App Attest keys
  - purchases
  - Pro and AI
  - the Chrome extension
  - Microlink, the import link check and export
- Docs:
  - `docs/app-store-listing.md`: the draft listing, privacy-label answers, review notes and product names.
  - `docs/auth-setup.md`: the new environment variables, plus the Apple and App Store Connect setup.
  - `docs/pro-qa.md`: an hour-long TestFlight QA script, plus the launch hardening checklist.
- Two follow-ups done after the merge:
  - The tour says the AI pass and the browser retry are Pro.
  - The delete-account confirmation, on web and iOS, says App Store billing continues until cancelled (Apple
    guideline 5.1.1(v)).

### Needs you
- Approve the listing copy and the privacy labels in `docs/app-store-listing.md`. Its open questions are listed at
  the end: support URL, iPad for 1.0, age rating, and the promo video size.
- Create the two demo accounts for App Review.
- Run `docs/pro-qa.md` on TestFlight. Work through its hardening checklist right before you submit.
