# Sign-in setup checklist

Code for Google, Apple and email sign-in is in place on web and iOS. The steps below are the parts done in dashboards. Do them in this order.

`<project>` is your Supabase project ref (from `NEXT_PUBLIC_SUPABASE_URL`) and `<domain>` is the production web domain.

## 1. Database (before deploying)

- [ ] Run `supabase/migrations/20261008000000_accounts.sql` in the Supabase SQL editor. It does four things:
  - adds `users.plan`
  - drops the unique constraint on `users.email`
  - moves the old library to `example_user@anylink.local`
  - adds the `auth.users` → `public.users` trigger

## 2. Supabase → Authentication → URL Configuration

- [ ] Site URL: `https://<domain>`
- [ ] Redirect URLs:
  - `https://<domain>/auth/callback`
  - `http://localhost:3000/auth/callback`
  - `anylink://auth-callback`

## 3. Email

- [ ] Providers → Email: enabled, and "Confirm email" on.
- [ ] Email OTP length: 6.
- [ ] Templates → **Magic Link** and **Confirm signup**: put both the code and the link in the body, e.g.
  `Your code: {{ .Token }}` and `<a href="{{ .ConfirmationURL }}">Sign in</a>`.
- [ ] Project Settings → Auth → SMTP: connect a real sender such as Resend. The built-in sender only allows a few emails an hour.

## 4. Google

- [ ] Google Cloud Console → APIs & Services → Credentials → create an OAuth client ID of type **Web application**.
  - Authorized redirect URI: `https://<project>.supabase.co/auth/v1/callback`
- [ ] Set up the OAuth consent screen (app name, support email, your domain).
- [ ] Supabase → Providers → Google: paste the client ID and secret.

iOS uses the same web client through a browser sheet, so you don't need a separate iOS client.

## 5. Apple

- [ ] Apple Developer → Identifiers → App ID `app.anylink.ios`: turn on **Sign in with Apple**. The entitlement is already in `project.yml`.
- [ ] Identifiers → **Services ID** (e.g. `app.anylink.web`): turn on Sign in with Apple.
  - Domain: `<project>.supabase.co`
  - Return URL: `https://<project>.supabase.co/auth/v1/callback`
- [ ] Keys → create a key with Sign in with Apple enabled. Download the `.p8` file and note the Key ID and your Team ID.
- [ ] Supabase → Providers → Apple:
  - Client IDs: `app.anylink.web,app.anylink.ios`. The second one is what lets the native iOS button work.
  - Secret key: generate it from the `.p8` file with Supabase's generator.
  - **The secret expires after 6 months.** Set a reminder to regenerate it.

## 6. JWT signing keys

- [ ] Supabase → Project Settings → JWT Keys: switch to asymmetric keys (ECC P-256). The server then verifies sessions locally instead of calling Supabase Auth on every request.

## 7. Environment

- [ ] Vercel: remove `CURRENT_USER_ID` and `API_TOKEN`. Keep `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] `.env.local`: remove the same two.
- [ ] `ios/Config.xcconfig`:
  - set `SUPABASE_URL = https:/$()/<project>.supabase.co` (the `$()` keeps xcconfig from treating `//` as a comment)
  - set `SUPABASE_ANON_KEY`
  - remove `ANYLINK_API_TOKEN`

## Rollout order

Deploy the backend first, then ship the iOS build. Older iOS builds send the shared `API_TOKEN`, which the API no longer accepts.
