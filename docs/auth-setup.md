# Sign-in setup: Google, Apple and email

The code for all three sign-in methods is done on web and iOS. This guide covers the setup in the Supabase, Google, Apple, Resend and Vercel dashboards. Work through it top to bottom; each step depends on the ones above it.

## The values you'll paste

| What | Value |
|---|---|
| Website | `https://www.anylink.space` (`anylink.space` redirects here) |
| App after sign-in, and the guest demo | `https://www.anylink.space/app` |
| Web sign-in callback | `https://www.anylink.space/auth/callback` |
| iOS sign-in callback | `anylink://auth-callback` |
| Supabase project | `xcljmzxsbepvcskjfadg` |
| Supabase OAuth callback (used by Google and Apple) | `https://xcljmzxsbepvcskjfadg.supabase.co/auth/v1/callback` |
| Apple Team ID | `376HNWM383` |
| iOS bundle ID | `app.anylink.ios` |
| Apple Services ID (web) | `app.anylink.web` |

---

## 1. Database migration

Do this before the new code is deployed.

1. In the Supabase dashboard, open **SQL Editor → New query**.
2. Paste the contents of `supabase/migrations/20261008000000_accounts.sql` and click **Run**. The migration:
   - adds a `plan` column to `users`
   - removes the unique check on `users.email`
   - moves the old single-user library to `example_user@anylink.local`
   - adds a trigger that gives every new sign-up a row in `public.users`
3. To check it worked, open **Table Editor → users**. You should see the `plan` column, and the old account's email should now be `example_user@anylink.local`.

---

## 2. Supabase URL configuration

Open **Authentication → URL Configuration**.

1. Set **Site URL** to `https://www.anylink.space`.
2. Under **Redirect URLs**, add each of these:
   - `https://www.anylink.space/auth/callback`
   - `https://anylink.space/auth/callback`
   - `http://localhost:3000/auth/callback`
   - `anylink://auth-callback`
   - `https://*.vercel.app/auth/callback` (so sign-in also works on Vercel preview deployments)

Supabase only sends people back to URLs on this list. If sign-in seems to do nothing, a missing entry here is the usual cause.

---

## 3. Email sign-in

Users get one email containing both a 6-digit code and a sign-in link. They can type the code, or tap the link on the device they're signing in on.

### 3a. Turn on the provider

Open **Authentication → Sign In / Providers → Email** and set:

- **Enable Email provider:** on
- **Confirm email:** on
- **Email OTP Length:** `6`

### 3b. Email templates

Open **Authentication → Emails → Templates**. Edit both **Confirm signup** (sent to new users) and **Magic Link** (sent to returning users). Give each this body:

```html
<h2>Sign in to AnyLink</h2>
<p>Your code: <strong style="font-size:24px;letter-spacing:4px">{{ .Token }}</strong></p>
<p>Or tap this link on the device you're signing in on:</p>
<p><a href="{{ .ConfirmationURL }}">Sign in to AnyLink</a></p>
```

### 3c. Sending from your own domain (required)

Supabase's built-in sender only allows a few emails per hour, and only to your team's addresses. Real users need your own sender.

1. Create a Resend account at resend.com.
2. Go to **Domains → Add domain** and enter `anylink.space`.
3. Add the DNS records Resend shows you (SPF and DKIM) at your DNS provider. Wait until the domain shows **Verified**.
4. Go to **API Keys → Create** and copy the key.
5. In Supabase, open **Project Settings → Authentication → SMTP Settings** and turn on **Enable custom SMTP**:
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: your Resend API key
   - Sender email: `login@anylink.space`
   - Sender name: `AnyLink`
6. Open **Authentication → Rate Limits** and raise the emails-per-hour limit to around `100`.

**Test:** at `https://www.anylink.space/login`, enter your email. Check that the email arrives, that the code signs you in, and that the link signs you in.

---

## 4. Google

### 4a. Google Cloud Console

Go to console.cloud.google.com and create a project called `AnyLink`, or pick an existing one. Then open **Google Auth Platform**. In older consoles this is **APIs & Services → OAuth consent screen**.

**Branding**

- App name: `AnyLink`
- Support email: your address
- Logo: optional
- Application home page: `https://www.anylink.space`
- Authorized domains: `anylink.space` and `supabase.co`

**Audience**

- User type: **External**.
- While the app's status is "Testing", only test users you add can sign in. Click **Publish app** when you're ready for real users.
- The basic email and profile access used here doesn't need Google's review. Google may ask you to verify `anylink.space` in Search Console, which takes one DNS TXT record.

**Data access**

Keep the default scopes: `openid`, `userinfo.email` and `userinfo.profile`.

**Clients → Create client**

- Application type: **Web application**
- Name: `AnyLink`
- Authorized JavaScript origins:
  - `https://www.anylink.space`
  - `https://anylink.space`
  - `http://localhost:3000`
- Authorized redirect URIs:
  - `https://xcljmzxsbepvcskjfadg.supabase.co/auth/v1/callback`

Click **Create**, then copy the **Client ID** and **Client secret**.

### 4b. Supabase

1. Open **Authentication → Sign In / Providers → Google**.
2. Turn it on, paste the Client ID and Client secret, and click **Save**.

The iOS app uses this same web client: it opens Google in a browser sheet, so you don't need a separate iOS client.

**Test:** at `/login`, click **Continue with Google**. You should end up at `https://www.anylink.space/app`, signed in.

---

## 5. Apple

This needs a paid Apple Developer account. Everything below is under **developer.apple.com → Certificates, IDs & Profiles**.

### 5a. App ID (the iOS app)

1. Open **Identifiers** and select `app.anylink.ios`. If it doesn't exist, create it under **App IDs → App**.
2. Turn on **Sign In with Apple** (Enable as a primary App ID).
3. Turn on **Associated Domains**. This lets `https://www.anylink.space/links/…` links open in the app.
4. Click **Save**. If Xcode asks, let it regenerate the provisioning profiles.

### 5b. Services ID (the website)

1. In **Identifiers**, click **+**, choose **Services IDs**, and click **Continue**.
2. Set the description to `AnyLink Web` and the identifier to `app.anylink.web`, then click **Register**.
3. Open the new Services ID, turn on **Sign In with Apple**, and click **Configure**:
   - Primary App ID: `app.anylink.ios`
   - Domains and Subdomains: `xcljmzxsbepvcskjfadg.supabase.co`
   - Return URLs: `https://xcljmzxsbepvcskjfadg.supabase.co/auth/v1/callback`
4. Click **Next**, then **Done**, **Continue** and **Save**.

### 5c. Signing key

1. Open **Keys** and click **+**.
2. Name it `AnyLink Sign in with Apple`.
3. Turn on **Sign in with Apple**, click **Configure**, and pick `app.anylink.ios` as the primary App ID.
4. Click **Register**, then **Download** the `.p8` file. You can only download it once, so store it somewhere safe.
5. Note the **Key ID**.

### 5d. Client secret

Supabase needs a secret generated from the `.p8` file, not the file itself.

1. Open supabase.com/docs/guides/auth/social-login/auth-apple and find the secret generator on that page.
2. Enter:
   - Team ID: `376HNWM383`
   - Key ID: from step 5c
   - Services ID: `app.anylink.web`
   - The contents of the `.p8` file
3. Copy the generated secret.

**The secret expires after 6 months.** Set a calendar reminder to make a new one. If it expires, Apple sign-in on the website stops working; the iOS button keeps working.

### 5e. Supabase

1. Open **Authentication → Sign In / Providers → Apple** and turn it on.
2. Set **Client IDs** to `app.anylink.web,app.anylink.ios`. You need both: the iOS ID is what lets the iPhone's built-in button work.
3. Paste the secret from step 5d into **Secret Key (for OAuth)** and click **Save**.

### 5f. Emails to "Hide My Email" users (optional)

Apple users who hide their email get an `@privaterelay.appleid.com` address. Supabase's sign-in emails don't need this step. If you'll ever email users yourself:

1. Open **Services → Sign in with Apple for Email Communication**.
2. Register `anylink.space` and `login@anylink.space`.

---

## 6. JWT signing keys

This makes sign-in checks on the server faster.

1. Open **Project Settings → JWT Keys**.
2. If it says **Legacy JWT secret**, click **Migrate**. This creates an ECC (P-256) key.
3. Click **Rotate** to make the new key current.

The server then verifies each request itself instead of calling Supabase every time. People who are already signed in stay signed in.

---

## 7. Vercel

1. In **Settings → Domains**, make sure `www.anylink.space` is the production domain and `anylink.space` redirects to it. That way sign-in never lands on the `.vercel.app` address.
2. In **Settings → Environment Variables**:
   - Delete `CURRENT_USER_ID` and `API_TOKEN`.
   - Keep `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL`.
3. Redeploy.
4. Check that `https://www.anylink.space/.well-known/apple-app-site-association` returns JSON containing `376HNWM383.app.anylink.ios`.

In your local `.env.local`, also delete `CURRENT_USER_ID` and `API_TOKEN`.

---

## 8. iOS config

`ios/Config.xcconfig` isn't committed. It should contain:

```
ANYLINK_API_BASE = https:/$()/www.anylink.space
SUPABASE_URL = https:/$()/xcljmzxsbepvcskjfadg.supabase.co
SUPABASE_ANON_KEY = <the same anon key as NEXT_PUBLIC_SUPABASE_ANON_KEY>
DEVELOPMENT_TEAM = 376HNWM383
```

Keep the `$()`. Xcode config files treat `//` as the start of a comment, so without it the URL gets cut off.

After changing it, run `xcodegen generate` in `ios/`.

---

## 9. Testing

| Where | What to check |
|---|---|
| `/login` on the website | Each method signs you in: the email code, the email link, Google and Apple. |
| The website, signed out | `/app` shows the demo library. After 2 saves, a sign-up prompt appears. Sign up, and your 2 saves are in your new library. |
| iPhone (Apple needs a real device) | The Apple button, Google, the email code, and the email link opened on the phone all sign you in. |
| iPhone, "Skip for now" | After 2 saves, a sign-up sheet appears. Sign up, and your saves upload. |
| iPhone, universal links | Tapping `https://www.anylink.space/links/<id>` in Notes opens the app. |
| Supabase | Each test account appears under **Authentication → Users**, with a matching row in **Table Editor → users**. |

## Common errors

| Error | Cause |
|---|---|
| `redirect_uri_mismatch` (Google) | The redirect URI in step 4a doesn't exactly match `https://xcljmzxsbepvcskjfadg.supabase.co/auth/v1/callback`. |
| `invalid_client` (Apple, website) | The Services ID, domain or return URL in step 5b is wrong, or the secret has expired. |
| `Unacceptable audience` (Apple, iPhone) | `app.anylink.ios` is missing from **Client IDs** in step 5e. |
| You land on `/login?error=1` | The callback URL is missing from **Redirect URLs** in step 2. |
| No email arrives | Custom SMTP isn't set up (step 3c), or you've hit the rate limit. |
| iOS build: "Associated Domains capability" signing error | Step 5a, item 3 hasn't been done yet. |

## Rollout order

1. Run the migration (step 1).
2. Deploy the website.
3. Ship the iOS build.

Older iOS builds send the old shared `API_TOKEN`, which the API no longer accepts. They'll ask to sign in again.
