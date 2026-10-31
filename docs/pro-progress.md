# Pro progress

One section per phase of `docs/pro-build-plan.md`, in the order they landed. "Waiting on you" collects every step
only the user can do.

## Waiting on you

- [ ] Supabase → Authentication → URL Configuration → Redirect URLs: add
      `https://naiejkkikjnpbfhdppghkehemjlmocjk.chromiumapp.org/**` for the unpacked Chrome extension (Phase 8).
- [ ] Create a Chrome Web Store developer account. Upload `build/anylink-extension.zip` (from `npm run zip:extension`)
      without publishing, then add `https://<store id>.chromiumapp.org/**` to the same Supabase list (Phase 8).

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
