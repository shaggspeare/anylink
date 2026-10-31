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
