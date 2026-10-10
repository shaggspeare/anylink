"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useLibrary } from "@/lib/store";
import { supabaseBrowser } from "@/lib/supabase/client";
import { deleteAccount } from "@/lib/db/actions";
import { Sidebar } from "@/components/sidebar";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { AmbientOrbs } from "@/components/ambient-orbs";
import { TourButton } from "@/components/tour";
import { linkCount } from "@/lib/format";
import { useLocalSetting } from "@/lib/use-local-setting";
import { DEFAULT_COLLECTION_KEY, useDefaultCollection } from "@/lib/use-default-collection";
import { applyTheme, THEME_KEY, type Theme } from "@/lib/theme";

const THEMES: { id: Theme; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

const SHORTCUTS: [string, string][] = [
  ["⌘V", "Paste a link anywhere to save it"],
  ["N", "New link"],
  ["/ or ⌘K", "Search"],
  ["Esc", "Close the open link, or clear a selection"],
  ["Shift-click", "Select a range of cards"],
  ["← →  L  1–5", "Sort Unsorted: Trash, file, later, pick a collection"],
];

/** Web Settings, after iOS S18. iOS's "Open links in" (in-app browser vs Safari) has no
 * web counterpart. */
export default function SettingsPage() {
  const { links, trashed, collections, guest, email, openSignUp } = useLibrary();
  const [theme, setTheme] = useLocalSetting<Theme>(THEME_KEY, "light");
  const [, setDefaultCollection] = useLocalSetting<string>(DEFAULT_COLLECTION_KEY, "");
  const defaultCollectionId = useDefaultCollection();
  const folders = collections.filter((c) => !c.isSmart);
  const live = links.filter((l) => !l.archived).length;

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <AmbientOrbs variant="library" />
      <Sidebar />
      <div className="relative lg:pl-[250px]">
        <div className="mx-auto flex max-w-[640px] flex-col gap-5 px-4 pb-10 pt-[max(24px,env(safe-area-inset-top))]">
          <h1 className="text-hero text-[30px]">Settings</h1>

          <Section title="Account">
            {guest ? (
              <>
                <p className="text-body text-ink">You&apos;re trying AnyLink without an account.</p>
                <button type="button" onClick={openSignUp} className="self-start text-body font-semibold text-ink underline-offset-2 hover:underline">
                  Sign in or create an account
                </button>
              </>
            ) : (
              <>
                <p className="text-body text-ink">{email}</p>
                <button
                  type="button"
                  onClick={async () => {
                    await supabaseBrowser().auth.signOut();
                    // A full load, so the store drops their library.
                    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                    location.assign("/");
                  }}
                  className="self-start text-body font-semibold text-ink underline-offset-2 hover:underline"
                >
                  Sign out
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm("Delete your account and everything in it? This can't be undone.")) return;
                    await deleteAccount();
                    await supabaseBrowser().auth.signOut();
                    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                    location.assign("/");
                  }}
                  className="self-start text-body font-semibold text-[var(--signal-orange)] underline-offset-2 hover:underline"
                >
                  Delete account…
                </button>
              </>
            )}
            <a href="/privacy-policy" className="self-start text-meta text-ink/60 underline-offset-2 hover:underline">
              Privacy Policy
            </a>
          </Section>

          <Section title="Your library">
            <p className="text-body text-ink">
              {linkCount(live)} · {folders.length} {folders.length === 1 ? "collection" : "collections"} ·{" "}
              {linkCount(trashed.length)} in Trash
            </p>
            <a href="/start" className="text-body font-semibold text-ink underline-offset-2 hover:underline">
              Import links from bookmarks or Telegram
            </a>
          </Section>

          <Section title="Capture">
            <label className="flex items-center justify-between gap-4">
              <span className="text-body text-ink">New links go to</span>
              <select
                value={defaultCollectionId}
                onChange={(e) => setDefaultCollection(e.target.value)}
                className="h-10 min-w-0 rounded-full border border-rim/90 bg-surface/70 px-3.5 text-body text-ink"
              >
                {folders.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-meta text-ink/60">
              On your phone, add AnyLink to the home screen and it shows up in the share sheet.
            </p>
          </Section>

          <Section title="Appearance">
            <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-3 gap-3">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={theme === t.id}
                  onClick={() => {
                    setTheme(t.id);
                    applyTheme(t.id);
                  }}
                  className="flex flex-col items-center gap-2"
                >
                  <span
                    className="flex h-16 w-full overflow-hidden rounded-[12px]"
                    style={{
                      border: theme === t.id ? "2.5px solid var(--color-signal)" : "1px solid rgb(var(--ink-rgb) / .12)",
                    }}
                  >
                    {t.id !== "dark" && <ThemeHalf dark={false} />}
                    {t.id !== "light" && <ThemeHalf dark />}
                  </span>
                  <span className={`text-[13px] ${theme === t.id ? "font-semibold text-ink" : "text-ink/60"}`}>
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Keyboard">
            <dl className="flex flex-col gap-2">
              {SHORTCUTS.map(([keys, what]) => (
                <div key={keys} className="flex items-center justify-between gap-4">
                  <dt className="text-body text-ink">{what}</dt>
                  <dd>
                    <kbd className="whitespace-nowrap rounded-[7px] bg-surface px-2 py-1 font-mono text-[11px] text-ink/70 shadow-sm">
                      {keys}
                    </kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section title="Help">
            <TourButton className="self-start text-body font-semibold text-ink underline-offset-2 hover:underline">
              Show the guided tour again
            </TourButton>
            <Link href="/trash" className="self-start text-body font-semibold text-ink underline-offset-2 hover:underline">
              Open Trash
            </Link>
          </Section>
        </div>
        <div className="h-[calc(6rem+env(safe-area-inset-bottom))] lg:hidden" />
      </div>
      <BottomTabBar />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="glass-55 flex flex-col gap-3 rounded-[22px] p-5">
      <h2 className="text-eyebrow text-ink/60">{title}</h2>
      {children}
    </section>
  );
}

/** A tiny screen in the literal canvas colours, so the thumbnail doesn't flip with the theme. */
function ThemeHalf({ dark }: { dark: boolean }) {
  return (
    <span className="flex flex-1 flex-col gap-1.5 p-2.5" style={{ background: dark ? "#0f1012" : "#eceef0" }}>
      <span className="h-1.5 w-7 rounded-full" style={{ background: dark ? "#eceef0" : "#17181b" }} />
      <span className="h-1.5 w-11 rounded-full opacity-40" style={{ background: dark ? "#eceef0" : "#17181b" }} />
    </span>
  );
}
