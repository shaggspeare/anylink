// The popup only draws. The service worker signs in, keeps the session and talks to AnyLink, because this
// popup closes whenever a sign-in window takes focus.

const $ = (id) => document.getElementById(id);
const send = (message) => chrome.runtime.sendMessage(message).catch((error) => ({ error: error.message }));
let tab;

function show(view, error = "") {
  for (const id of ["loading", "signed-out", "signed-in"]) $(id).hidden = id !== view;
  $("error").textContent = error;
}

async function load() {
  // Left by a Google or Apple sign-in that failed while the popup was closed.
  const { signInError = "" } = await chrome.storage.local.get("signInError");
  await chrome.storage.local.remove("signInError");

  const library = await send({ type: "library" });
  if (library.signedOut) return show("signed-out", signInError);

  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const savable = /^https?:\/\//.test(tab?.url ?? "");
  $("tab").hidden = !tab?.url;
  $("title").textContent = tab?.title || tab?.url || "";
  $("url").textContent = tab?.url ?? "";
  $("collection").replaceChildren(...(library.collections ?? []).map((c) => new Option(c.name, c.id)));
  $("collection").disabled = Boolean(library.error);
  $("email").textContent = library.email ?? "";
  $("save").disabled = !savable || Boolean(library.error);
  show("signed-in", library.error ?? (savable ? "" : "AnyLink can't save this tab. Open a web page and try again."));
}

function busy(on) {
  for (const control of $("signed-out").querySelectorAll("button, input")) control.disabled = on;
}

for (const provider of ["apple", "google"]) {
  $(provider).addEventListener("click", async () => {
    busy(true);
    // The sign-in window usually closes this popup; the service worker opens it again when sign-in ends.
    await send({ type: "signIn", provider });
    busy(false);
    load();
  });
}

$("password-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  busy(true);
  const result = await send({ type: "signIn", email: $("email-input").value.trim(), password: $("password").value });
  busy(false);
  if (result.error) return show("signed-out", result.error);
  load();
});

$("save").addEventListener("click", async () => {
  $("save").disabled = true;
  $("save").textContent = "Saving…";
  const saved = await send({ type: "save", url: tab.url, title: tab.title, collectionId: $("collection").value });
  $("save").disabled = false;
  $("save").textContent = "Save to library";
  if (saved.signedOut) return show("signed-out", "Your session ended. Sign in again to save.");
  if (saved.error) return show("signed-in", saved.error);
  $("save").hidden = true;
  $("collection").disabled = true;
  $("saved").href = saved.url;
  $("saved").hidden = false;
});

$("sign-out").addEventListener("click", async () => {
  await send({ type: "signOut" });
  show("signed-out");
});

load();
