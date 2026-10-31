# AnyLink for Chrome

Saves the current tab to a collection in your AnyLink library. Manifest V3, plain JavaScript, no build step.

| File | What it does |
| --- | --- |
| `manifest.json` | Permissions: `activeTab`, `storage`, `identity`, and `https://www.anylink.space/*`. The `key` pins the dev id. |
| `background.js` | The service worker: sign-in, the session and its refresh, and the calls to AnyLink |
| `popup.html`, `popup.js` | The popup. It only draws, and asks the service worker for everything else. |
| `config.js` | The Supabase URL and anon key (public, the same ones the web app ships) and the AnyLink origin |

## Extension ids

| Build | Id | Supabase redirect URL |
| --- | --- | --- |
| Loaded unpacked from this folder | `naiejkkikjnpbfhdppghkehemjlmocjk`, pinned by the manifest `key` | `https://naiejkkikjnpbfhdppghkehemjlmocjk.chromiumapp.org/**` |
| Chrome Web Store | Assigned by the store on the first upload | `https://<store id>.chromiumapp.org/**` |

Google and Apple sign-in only work for an id whose redirect URL is in Supabase: **Authentication → URL Configuration →
Redirect URLs**. Email and password sign-in works without it.

To give both builds one id, upload the zip to the Developer Dashboard once without publishing, open **Package → View
public key**, and paste that key, on one line, into `key` in `manifest.json`. The unpacked build then gets the store
id, and only that redirect URL is needed.

The dev key's private half isn't needed to load the extension or to publish it. If you have it, it's `extension.pem`
beside this folder, and it stays out of git.

## Load it unpacked

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this `extension/` folder.
3. Check that the id is `naiejkkikjnpbfhdppghkehemjlmocjk`. Pin AnyLink to the toolbar from the puzzle-piece menu.

After changing a file, click the reload arrow on the extension's card.

## Sign in and save

1. Click the AnyLink icon.
2. Choose **Continue with Apple** or **Continue with Google**, or enter the email and password of an AnyLink account.
   - A sign-in window opens, and the popup closes.
   - When you finish, the window closes and the popup opens again, signed in. On Chrome before 127, click the icon
     again.
   - New accounts are made on anylink.space. "New here?" and "Forgot password?" open its sign-in page.
3. Pick a collection and click **Save to library**. **Saved. Open it in AnyLink** opens the link on anylink.space,
   where you need to be signed in to the same account.

The session is kept in `chrome.storage.local` and refreshed when it has less than a minute left. **Sign out** ends this
session only: the web app and iOS stay signed in.

## Build for the Chrome Web Store

```bash
npm run zip:extension    # → build/anylink-extension.zip
```

The zip leaves out the manifest `key`, which the store doesn't use, along with tests, this README and any `.pem`
file. Bump `version` in `manifest.json` before each upload.

## Tests

`npm test` runs `background.test.js`. It drives the service worker against stubbed Chrome APIs and `fetch`, covering
the PKCE exchange, refreshing an expired token, the `createLink` request, and signing out on a rejected token.

## If sign-in fails

| What you see | Why |
| --- | --- |
| The sign-in window ends on the AnyLink website instead of closing | This build's redirect URL isn't in Supabase's Redirect URLs |
| "Sign-in was cancelled." | The sign-in window was closed before it finished |
| "Your session ended. Sign in again to save." | Supabase rejected the refresh token, or AnyLink answered 401 |
