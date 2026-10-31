import { API, SUPABASE_KEY, SUPABASE_URL } from "./config.js";

// The service worker owns the session. The popup closes as soon as a sign-in window takes focus, so sign-in
// has to finish here. One owner also means one refresh at a time, and Supabase refresh tokens are single-use.

const AUTH = `${SUPABASE_URL}/auth/v1`;
const OFFLINE = "Couldn't reach AnyLink. Check your connection and try again.";

chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  handle(message).then(reply, (error) => reply({ error: error.message }));
  return true; // the reply comes after an await
});

async function handle(m) {
  if (m.type === "signIn") return m.provider ? signInWith(m.provider) : signInWithPassword(m.email, m.password);
  if (m.type === "signOut") return signOut();
  if (m.type === "library") return library();
  if (m.type === "save") return save(m.url, m.title, m.collectionId);
}

// Session

const getSession = async () => (await chrome.storage.local.get("session")).session ?? null;

/** Expiry is counted on this clock from `expires_in`, so a skewed system clock can't expire a fresh token. */
async function keep(tokens, email) {
  const session = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    email: tokens.user?.email ?? email ?? null,
  };
  await chrome.storage.local.set({ session });
  return session;
}

/** Supabase Auth's token endpoint, for the `pkce`, `password` and `refresh_token` grants. Errors carry the status. */
async function grant(type, body) {
  const res = await fetch(`${AUTH}/token?grant_type=${type}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {
    throw new Error(OFFLINE);
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) return data;
  throw Object.assign(new Error(data.msg || data.error_description || "Sign-in failed. Try again."), { status: res.status });
}

let refreshing = null;

/** A live access token, refreshed when it has under a minute left; null when signed out. */
async function accessToken() {
  const session = await getSession();
  if (!session) return null;
  if (session.expiresAt - Date.now() > 60_000) return session.accessToken;
  refreshing ??= refresh(session).finally(() => (refreshing = null));
  return refreshing;
}

async function refresh(session) {
  try {
    return (await keep(await grant("refresh_token", { refresh_token: session.refreshToken }), session.email)).accessToken;
  } catch (error) {
    // Revoked or expired: sign in again. Offline or a server error: keep the session and retry next time.
    if (error.status < 500) {
      await chrome.storage.local.remove("session");
      return null;
    }
    throw error;
  }
}

// Sign-in

const base64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Google or Apple through Supabase's authorize endpoint, with PKCE (RFC 7636) over plain fetch. */
async function signInWith(provider) {
  try {
    const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    const url = `${AUTH}/authorize?${new URLSearchParams({
      provider,
      redirect_to: chrome.identity.getRedirectURL(),
      code_challenge: base64url(new Uint8Array(digest)),
      code_challenge_method: "s256",
    })}`;
    const redirect = await chrome.identity.launchWebAuthFlow({ url, interactive: true }).catch(() => null);
    if (!redirect) throw new Error("Sign-in was cancelled.");
    const back = new URL(redirect).searchParams;
    if (!back.get("code")) throw new Error(back.get("error_description") || "Sign-in didn't finish. Try again.");
    await keep(await grant("pkce", { auth_code: back.get("code"), code_verifier: verifier }));
    return { ok: true };
  } catch (error) {
    // The popup closed when the sign-in window opened; it shows this when it opens again.
    await chrome.storage.local.set({ signInError: error.message });
    throw error;
  } finally {
    // Chrome 127+ reopens the popup. On older versions, they click the icon again.
    await chrome.action.openPopup?.().catch(() => {});
  }
}

async function signInWithPassword(email, password) {
  await keep(await grant("password", { email, password }));
  return { ok: true };
}

async function signOut() {
  const session = await getSession();
  await chrome.storage.local.remove("session");
  // Ends this session only: the web app and iOS stay signed in.
  if (session) {
    fetch(`${AUTH}/logout?scope=local`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.accessToken}` },
    }).catch(() => {});
  }
  return { ok: true };
}

// AnyLink

/** A call to AnyLink's API as the signed-in user; null when signed out. */
async function api(path, body) {
  const token = await accessToken();
  if (!token) return null;
  const res = await fetch(API + path, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
  }).catch(() => {
    throw new Error(OFFLINE);
  });
  if (res.status === 401) {
    // The server no longer takes this session. iOS signs out on a 401 too.
    await chrome.storage.local.remove("session");
    return null;
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error(data?.error || "Something went wrong. Try again.");
  return data;
}

async function library() {
  // ponytail: loads the whole library; add a collections-only endpoint if large libraries make it slow.
  const data = await api("/api/v1/library");
  if (!data) return { signedOut: true };
  // Smart collections are saved searches and own no links, so nothing can be saved into one.
  const collections = data.collections.filter((c) => !c.isSmart).map(({ id, name }) => ({ id, name }));
  return { email: (await getSession())?.email, collections };
}

async function save(url, title, collectionId) {
  const domain = new URL(url).hostname.replace(/^www\./, "");
  // Saved unread, like the iOS share sheet: with no excerpt, the server reads the page after the save and
  // fills in the card. A title sent as the bare domain gets replaced by the page's own.
  const link = await api("/api/v1/actions/createLink", [
    {
      url,
      title: title || domain,
      domain,
      collectionId,
      excerpt: "",
      tint: "#9AA3AD",
      stripe: "#FFFFFF",
      initial: domain[0]?.toUpperCase() ?? "?",
      contentType: "article",
      size: "M",
      tags: [],
      source: "extension",
    },
  ]);
  return link ? { url: `${API}/links/${link.id}` } : { signedOut: true };
}
