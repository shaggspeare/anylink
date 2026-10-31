// The service worker against stubbed Chrome APIs and fetch. Part of `npm test`.
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { API, SUPABASE_URL } from "./config.js";

const store = {};
let listener, authUrl, calls, routes;

globalThis.chrome = {
  runtime: { onMessage: { addListener: (fn) => (listener = fn) } },
  storage: {
    local: {
      get: async (key) => (key in store ? { [key]: store[key] } : {}),
      set: async (items) => void Object.assign(store, items),
      remove: async (key) => void delete store[key],
    },
  },
  identity: {
    getRedirectURL: () => "https://test.chromiumapp.org/",
    launchWebAuthFlow: async ({ url }) => ((authUrl = url), "https://test.chromiumapp.org/?code=c1"),
  },
  action: { openPopup: async () => {} },
};

globalThis.fetch = async (url, init = {}) => {
  calls.push({ url, headers: init.headers, body: init.body && JSON.parse(init.body) });
  const [status, json] = routes(url) || [404, {}];
  return new Response(JSON.stringify(json), { status });
};

await import("./background.js");
const send = (message) => new Promise((resolve) => listener(message, {}, resolve));
const tokens = (n) => ({ access_token: `a${n}`, refresh_token: `r${n}`, expires_in: 3600, user: { email: "me@example.com" } });
const expired = () => ({ accessToken: "a0", refreshToken: "r0", expiresAt: Date.now() - 1, email: "me@example.com" });

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  calls = [];
});

test("Google sign-in exchanges the code with the verifier its challenge was made from", async (t) => {
  // Zero bytes give a challenge with both "-" and "_" in it, so a base64url slip always shows.
  t.mock.method(crypto, "getRandomValues", (bytes) => bytes.fill(0));
  routes = (url) => url === `${SUPABASE_URL}/auth/v1/token?grant_type=pkce` && [200, tokens(1)];
  assert.deepEqual(await send({ type: "signIn", provider: "google" }), { ok: true });

  const query = new URL(authUrl).searchParams;
  assert.equal(query.get("provider"), "google");
  assert.equal(query.get("redirect_to"), "https://test.chromiumapp.org/");
  assert.equal(query.get("code_challenge_method"), "s256");
  assert.deepEqual(calls[0].body, { auth_code: "c1", code_verifier: "A".repeat(43) });
  assert.equal(query.get("code_challenge"), createHash("sha256").update("A".repeat(43)).digest("base64url"));
  assert.equal(store.session.accessToken, "a1");
});

test("an expired token is refreshed once for concurrent calls, then sent as the Bearer", async () => {
  store.session = expired();
  routes = (url) =>
    url.endsWith("grant_type=refresh_token")
      ? [200, tokens(2)]
      : url === `${API}/api/v1/library`
        ? [200, { collections: [{ id: "c1", name: "Unsorted", isInbox: true }, { id: "s1", name: "Videos", isSmart: true }] }]
        : url === `${API}/api/v1/actions/createLink` && [200, { id: "l1" }];

  const [library, saved] = await Promise.all([
    send({ type: "library" }),
    send({ type: "save", url: "https://www.example.com/a", title: "", collectionId: "c1" }),
  ]);
  assert.deepEqual(library, { email: "me@example.com", collections: [{ id: "c1", name: "Unsorted" }] });
  assert.deepEqual(saved, { url: `${API}/links/l1` });

  const refreshes = calls.filter((c) => c.url.endsWith("grant_type=refresh_token"));
  assert.deepEqual(refreshes.map((c) => c.body), [{ refresh_token: "r0" }]);
  assert.equal(store.session.refreshToken, "r2");

  const save = calls.find((c) => c.url.endsWith("/createLink"));
  assert.equal(save.headers.Authorization, "Bearer a2");
  assert.deepEqual(save.body, [
    {
      url: "https://www.example.com/a",
      title: "example.com",
      domain: "example.com",
      collectionId: "c1",
      excerpt: "",
      tint: "#9AA3AD",
      stripe: "#FFFFFF",
      initial: "E",
      contentType: "article",
      size: "M",
      tags: [],
      source: "extension",
    },
  ]);
});

test("a rejected refresh token or a 401 signs out; being offline doesn't", async () => {
  store.session = expired();
  routes = (url) => url.endsWith("grant_type=refresh_token") && [400, { msg: "Invalid Refresh Token" }];
  assert.deepEqual(await send({ type: "library" }), { signedOut: true });
  assert.equal(store.session, undefined);

  store.session = { ...expired(), expiresAt: Date.now() + 3_600_000 };
  routes = () => [401, { error: "Unauthorized" }];
  assert.deepEqual(await send({ type: "library" }), { signedOut: true });
  assert.equal(store.session, undefined);

  store.session = expired();
  routes = () => {
    throw new TypeError("Failed to fetch");
  };
  assert.match((await send({ type: "library" })).error, /Couldn't reach AnyLink/);
  assert.equal(store.session.refreshToken, "r0");
});
