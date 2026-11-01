# Pro QA script (TestFlight)

Run this on the TestFlight build before submitting. With the setup done, it takes about an hour. It gathers the
"Check by hand" steps from `docs/pro-progress.md` and the phase gates in `docs/pro-build-plan.md`, without repeats.
Tick each box when it passes. When something fails, write down the device, the account and the time, so the Vercel
logs can be matched.

Sections 1 and 2 need Phase 3, the local library. Steps marked **Phase 5** need upgrade and lapse, which may not be
built yet. Until they are, skip those steps and run the rest.

## Before you start (about 15 minutes, the day before is fine)

- [ ] Production runs the latest server code, every migration is applied, and Vercel has `APP_ATTEST_SECRET` and
      `APPLE_APP_ID` (`docs/auth-setup.md` step 7).
- [ ] The CloudKit schema is deployed to Production (the checklist at the end). TestFlight builds use CloudKit's
      production database, so iCloud sync fails without it.
- [ ] Two devices, **A** and **B**, have the TestFlight build. Both are signed in to the same Apple Account, with
      iCloud on. Delete any older AnyLink from both first.
- [ ] Purchases on **A** go to your sandbox tester, so a month lasts 5 minutes. TestFlight's own purchases renew only
      once a day. On A: Settings → your name → Media & Purchases → Sign Out, then Settings → Developer → Sandbox
      Apple Account → sign in. iCloud stays signed in.
- [ ] Three accounts made on the web with email and password, each confirmed: **QA-F** stays free, **QA-M** buys
      monthly and then yearly, and **QA-L** buys lifetime. Plus-addresses such as `you+qa-m@…` work.
- [ ] Five test links in a note on A: an article with an author (from the Guardian or BBC News, say), a YouTube video,
      a Vimeo video, a recipe page with a recipe card (BBC Good Food or Serious Eats), and a product page from a big
      shop.
- [ ] A bookmarks file of about 50 links in Files on A. Export one from anylink.space → Settings → Bookmarks (HTML)
      with your own account, or from Chrome.
- [ ] A computer with Chrome, and the Supabase SQL Editor open on production for these read-only checks:

```sql
-- An account's plan
select email, plan, plan_product, plan_expires_at from users where email = '<email>';

-- The newest App Attest keys
select environment, sign_count, crawl_count, check_count, group_count, created_at
from app_attest_keys order by created_at desc limit 3;

-- An account's links, then any URL saved twice
select count(*) from links where user_id = (select id from users where email = '<email>') and deleted_at is null;
select url, count(*) from links where user_id = (select id from users where email = '<email>')
group by url having count(*) > 1;
```

## 1. Free, on two devices (10 min)

- [ ] On A, open AnyLink. The library opens, with no sign-in wall.
- [ ] Add the article with **+**. It gets a title, an image and a reading time, without a summary or AI tags.
- [ ] Close the app. Share the recipe to AnyLink from Safari, then run the **Save to AnyLink** shortcut with the
      YouTube link. Open the app: both are there, and they fill in with titles and images.
- [ ] The key query shows a `production` key, with `crawl_count` at 3 or more. Relaunching doesn't add a key.
      `select count(*) from links where url like '%<part of the article URL>%'` is 0: the server kept nothing.
- [ ] Add the product and the Vimeo link with **+**. Open each of the five: each has the generic layout, ending with
      its upsell line, such as "Pro adds the summary, the author and the date here." Tapping the line opens the
      paywall.
- [ ] Add a note to the article, highlight a sentence in it, and share a photo to AnyLink from Photos.
- [ ] Collections → Import links → the bookmarks file. The links group into collections, and the dead ones are
      listed. `check_count` and `group_count` have gone up.
- [ ] Add the AnyLink widget to the Home Screen. It shows the latest saves.
- [ ] Open AnyLink on B. Everything from A arrives soon after the app comes to the foreground, the photo included.
      Move a link to another collection on B; A shows the move once it comes to the foreground.
- [ ] On B, turn off iCloud for AnyLink (Settings → your name → iCloud). The app says sync is off, and still saves a
      link. Turn iCloud back on.

## 2. What free can't do (5 min)

- [ ] On A: turning on sharing for a collection, setting a price alert on the product, and Profile → Export library
      each open the paywall. Under Export, the footer reads "Export is a Pro feature."
- [ ] Profile shows AnyLink Pro as "Free", and Sync with web as "Pro". Both open the paywall.
- [ ] On the web as QA-F, save the five test links. Each gets a title, an image and a reading time, without AI tags,
      and each link page has the generic layout and its upsell line.
- [ ] Still as QA-F: the share switch, the price alert, the Export buttons and the upsell lines each open the Pro
      dialog, which says "Pro is sold in the AnyLink iOS app." Settings shows "Plan: Free" and **See what Pro adds**.

## 3. Buy monthly, and upgrade (10 min)

- [ ] On the web as QA-M, save the article and the recipe, and make a collection named like one of A's.
- [ ] On A: Profile → AnyLink Pro. The paywall lists the benefits, the three plans with their prices (Yearly selected),
      Restore purchases, and the Terms of Use and Privacy Policy links.
- [ ] Choose Monthly → Continue. "Sign in to buy Pro" appears: sign in as QA-M, then buy with the sandbox tester. The
      toast "You're on Pro" shows, and Profile shows Pro.
- [ ] The plan query for QA-M shows `pro`, `com.shaggspeare.anylink.pro.monthly`, and an expiry about 5 minutes away.
- [ ] **Phase 5:** a progress screen uploads the local library. Swipe the app away halfway through and reopen it. The
      upload picks up again and finishes.
- [ ] **Phase 5:** on the web as QA-M, every link, collection, note, highlight and the photo from A is there, merged
      with the two web links. The duplicates query returns no rows, and the shared collection name appears once.

## 4. Pro templates (5 min)

Check each on A and on the web, both as QA-M.

- [ ] The article shows "By {author} · {date}" and a summary card.
- [ ] The YouTube and Vimeo videos play in place. On A, nothing loads from the video site before you tap play.
- [ ] The recipe shows its time chips, an ingredient checklist and numbered steps.
- [ ] The product shows its price and chart. Set an alert above the current price: "Under your price" shows.
- [ ] A new save gets an AI summary and tags.
- [ ] Five minutes after the purchase, QA-M's expiry has moved forward: the renewal reached the server.

## 5. Share links and export (7 min)

- [ ] On A, turn on sharing for a collection and copy its link. In a private browser window, the link shows the
      collection and its links. Keep it for sections 6 and 9.
- [ ] On A: Profile → Export library → "Bookmarks (HTML)", then "Everything (JSON)", then "Spreadsheet (CSV)". Each
      opens the Files save sheet with `anylink-{date}.{ext}`.
- [ ] On the web as QA-M, the three Export buttons in Settings download the same files.
- [ ] Import the HTML into Chrome (Bookmarks → Import bookmarks). The folders match the collections.
- [ ] Open the CSV in Numbers. Non-English titles read correctly, and commas and line breaks stay inside their cells.

## 6. Lapse (10 min, including a 5-minute wait)

- [ ] On A: Profile → Manage Subscription → cancel. While the period runs out, do section 7.
- [ ] Once it has ended, the plan query for QA-M shows `free`, with `plan_expires_at` at the moment Pro ended. The
      expiry notification reached the server.
- [ ] **Phase 5:** A shows a one-time notice and stays signed in. Every link, collection, note, highlight and the
      photo is still there, now in a local library.
- [ ] The share link from section 5 reads as not found. On the web as QA-M, the collection's share dialog says the
      link is paused.
- [ ] The web still has QA-M's whole library, and Settings shows "Plan: Free".
- [ ] **Phase 5:** save a link on the web (call it W) and another on A (call it I). W doesn't reach A.

## 7. Chrome extension (5 min, during the wait)

- [ ] In `chrome://extensions`, turn on Developer mode and load `extension/` unpacked. Its id is
      `naiejkkikjnpbfhdppghkehemjlmocjk`. If the Chrome Web Store build is uploaded, test that one instead.
- [ ] Sign in with Google and sign out. Then sign in with email as QA-F.
- [ ] Save a tab into a collection. "Saved. Open it in AnyLink" opens it on the web, with an image and an excerpt.
- [ ] Force a token refresh. In the service worker's console, run
      `chrome.storage.local.get("session").then(({session}) => chrome.storage.local.set({session: {...session, expiresAt: 0}}))`,
      then reopen the popup. The collections load.

## 8. The old iOS build (5 min)

- [ ] On B, install the last build from before Phase 6: TestFlight → AnyLink → Previous Builds.
- [ ] Sign in as QA-F. The library loads, and the recipe shows as an article.
- [ ] Save a link. It gets a title and an image.
- [ ] Turn on sharing for a collection. It's refused, and you stay signed in.
- [ ] Put B back on the current build.

## 9. Resubscribe yearly (4 min)

- [ ] On A: Profile → AnyLink Pro → Yearly → Continue. Pro is back, and the plan query shows
      `com.shaggspeare.anylink.pro.yearly`.
- [ ] **Phase 5:** I is uploaded once: it's on the web, and the duplicates query returns no rows. W now shows on A.
- [ ] The share link from section 5 works again, at the same address.

## 10. Lifetime and Restore (5 min)

- [ ] On A: Profile → Sign out. Then Profile → AnyLink Pro → Lifetime → Continue, sign in as QA-L, and buy. The plan
      query for QA-L shows `pro`, `com.shaggspeare.anylink.pro.lifetime`, and no expiry.
- [ ] Delete the app from A and install it again from TestFlight. Sign in as QA-F, then Profile → AnyLink Pro →
      Restore purchases. QA-F stays Free, because the purchases on this Apple Account belong to QA-M and QA-L. Note
      the message it shows: one that says QA-F's purchase is still being confirmed is a bug.

## Afterwards

- [ ] Cancel QA-M's yearly subscription on A, so it stops renewing.
- [ ] On A, sign out of the sandbox tester (Settings → Developer → Sandbox Apple Account), and sign back in under
      Media & Purchases.
- [ ] Keep QA-F and QA-L for the App Review notes in `docs/app-store-listing.md`, if you like.

## Extra checks, if there's time

From earlier phases' "Check by hand":

- [ ] Replay an account-less `POST /api/crawl` captured with Proxyman: 403 `replay`. Change the body and send it
      again: 403 `invalid` (Phase 2).
- [ ] Set a key's `crawl_count` to 200 for today. A new link on that device shows the "Too many previews…" notice.
      Reset the count afterwards (Phase 2).
- [ ] On production, a call with an `X-AnyLink-Dev` header gets 403 (Phase 2).
- [ ] Call `/api/cron/price-check` with `Authorization: Bearer $CRON_SECRET`. Only Pro accounts' products get new price
      snapshots (Phase 1).
- [ ] Export the JSON of a big library, and check the hosting size limit doesn't cut it off (Phase 7).
- [ ] In Vercel Logs, a free account's `POST /api/crawl` makes no call to api.openai.com (Phase 1).
