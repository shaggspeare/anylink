"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useLibrary } from "@/lib/store";
import { signOut } from "@/lib/supabase/client";
import { deleteAccount } from "@/lib/db/actions";
import { Sidebar } from "@/components/sidebar";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { AmbientOrbs } from "@/components/ambient-orbs";
import { TourButton } from "@/components/tour";
import { ExportLibrary } from "@/components/export-library";
import { linkCount } from "@/lib/format";
import { useLocalSetting } from "@/lib/use-local-setting";
import { DEFAULT_COLLECTION_KEY, useDefaultCollection } from "@/lib/use-default-collection";
import { applyTheme, THEME_KEY, type Theme } from "@/lib/theme";
import { isPro } from "@/lib/plan";
import { useRouter } from "next/navigation";
import { useLocale, useT } from "@/i18n/client";
import { languageName, LOCALE_COOKIE, LOCALES, type Locale } from "@/i18n/locales";
import { msg } from "@/i18n/translate";

const THEMES: { id: Theme; label: string }[] = [
  { id: "system", label: msg("System") },
  { id: "light", label: msg("Light") },
  { id: "dark", label: msg("Dark") },
];

const SHORTCUTS: [string, string][] = [
  ["⌘V", msg("Paste a link anywhere to save it")],
  ["N", msg("New link")],
  ["/ or ⌘K", msg("Search")],
  ["Esc", msg("Close the open link, or clear a selection")],
  ["Shift-click", msg("Select a range of cards")],
  ["← →  L  1–5", "Sort Unsorted: Trash, file, later, pick a collection"],
];

/** Web Settings, after iOS S18. iOS's "Open links in" (in-app browser vs Safari) has no
 * web counterpart. */
export default function SettingsPage() {
  const { links, trashed, collections, guest, email, openSignUp, displayName, setDisplayName, showToast, plan, openPro } =
    useLibrary();
  const [theme, setTheme] = useLocalSetting<Theme>(THEME_KEY, "light");
  const [, setDefaultCollection] = useLocalSetting<string>(DEFAULT_COLLECTION_KEY, "");
  const defaultCollectionId = useDefaultCollection();
  const folders = collections.filter((c) => !c.isSmart);
  const live = links.filter((l) => !l.archived).length;
  const t = useT();
  const locale = useLocale();
  const router = useRouter();

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <AmbientOrbs variant="library" />
      <Sidebar />
      <div className="relative lg:pl-[250px]">
        <div className="mx-auto flex max-w-[640px] flex-col gap-5 px-4 pb-10 pt-[max(24px,env(safe-area-inset-top))]">
          <h1 className="text-hero text-[30px]">{t("Settings")}</h1>

          <Section title={t("Account")}>
            {guest ? (
              <>
                <p className="text-body text-ink">{t("You're trying AnyLink without an account.")}</p>
                <button type="button" onClick={openSignUp} className="self-start text-body font-semibold text-ink underline-offset-2 hover:underline">
                  {t("Sign in or create an account")}
                </button>
              </>
            ) : (
              <>
                <p className="text-body text-ink">{email}</p>
                <div className="flex flex-col gap-0.5">
                  <p className="text-body text-ink">{t("Plan: {plan}", { plan: isPro(plan) ? "Pro" : t("Free") })}</p>
                  {isPro(plan) ? (
                    <p className="text-meta text-ink/60">{t("Manage your subscription in the iOS app.")}</p>
                  ) : (
                    <button type="button" onClick={openPro} className="self-start text-body font-semibold text-ink underline-offset-2 hover:underline">
                      {t("See what Pro adds")}
                    </button>
                  )}
                </div>
                <label className="flex items-center justify-between gap-4">
                  <span className="text-body text-ink">{t("Name on shared collections")}</span>
                  <input
                    // Remounts with the saved value, so a failed save doesn't leave stale text.
                    key={displayName ?? ""}
                    defaultValue={displayName ?? ""}
                    maxLength={40}
                    placeholder={t("Not shown")}
                    onBlur={(e) => {
                      if (e.target.value.trim() !== (displayName ?? ""))
                        setDisplayName(e.target.value).catch(() => showToast(t("Couldn't save your name.")));
                    }}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    className="h-10 min-w-0 rounded-full border border-rim/90 bg-surface/70 px-3.5 text-body text-ink"
                  />
                </label>
                <button
                  type="button"
                  onClick={signOut}
                  className="self-start text-body font-semibold text-ink underline-offset-2 hover:underline"
                >
                  {t("Sign out")}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(t("Delete your account and everything in it? This can't be undone. A Pro subscription bought in the iOS app keeps billing until you cancel it in the App Store."))) return;
                    await deleteAccount();
                    await signOut();
                  }}
                  className="self-start text-body font-semibold text-[var(--signal-orange)] underline-offset-2 hover:underline"
                >
                  {t("Delete account…")}
                </button>
              </>
            )}
            <a href="/privacy-policy" className="self-start text-meta text-ink/60 underline-offset-2 hover:underline">
              {t("Privacy Policy")}
            </a>
          </Section>

          <Section title={t("Your library")}>
            <p className="text-body text-ink">
              {linkCount(live, t)} · {t("{count} collection|{count} collections", { count: folders.length })} ·{" "}
              {t("{count} in Trash", { count: trashed.length })}
            </p>
            <a href="/start" className="text-body font-semibold text-ink underline-offset-2 hover:underline">
              {t("Import links from bookmarks or Telegram")}
            </a>
            <ExportLibrary />
          </Section>

          <Section title={t("Capture")}>
            <label className="flex items-center justify-between gap-4">
              <span className="text-body text-ink">{t("New links go to")}</span>
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
              {t("On your phone, add AnyLink to the home screen and it shows up in the share sheet.")}
            </p>
          </Section>

          <Section title={t("Appearance")}>
            <div role="radiogroup" aria-label={t("Appearance")} className="grid grid-cols-3 gap-3">
              {THEMES.map((th) => (
                <button
                  key={th.id}
                  type="button"
                  role="radio"
                  aria-checked={theme === th.id}
                  onClick={() => {
                    setTheme(th.id);
                    applyTheme(th.id);
                  }}
                  className="flex flex-col items-center gap-2"
                >
                  <span
                    className="flex h-16 w-full overflow-hidden rounded-[12px]"
                    style={{
                      border: theme === th.id ? "2.5px solid var(--color-signal)" : "1px solid rgb(var(--ink-rgb) / .12)",
                    }}
                  >
                    {th.id !== "dark" && <ThemeHalf dark={false} />}
                    {th.id !== "light" && <ThemeHalf dark />}
                  </span>
                  <span className={`text-[13px] ${theme === th.id ? "font-semibold text-ink" : "text-ink/60"}`}>
                    {t(th.label)}
                  </span>
                </button>
              ))}
            </div>
          </Section>

          <Section title={t("Language")}>
            <select
              aria-label={t("Language")}
              value={locale}
              onChange={(e) => {
                document.cookie = `${LOCALE_COOKIE}=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
                router.refresh();
              }}
              className="h-10 min-w-0 self-start rounded-full border border-rim/90 bg-surface/70 px-3.5 text-body text-ink"
            >
              {LOCALES.map((l: Locale) => (
                <option key={l} value={l}>
                  {languageName(l)}
                </option>
              ))}
            </select>
          </Section>

          <Section title={t("Keyboard")}>
            <dl className="flex flex-col gap-2">
              {SHORTCUTS.map(([keys, what]) => (
                <div key={keys} className="flex items-center justify-between gap-4">
                  <dt className="text-body text-ink">{t(what)}</dt>
                  <dd>
                    <kbd className="whitespace-nowrap rounded-[7px] bg-surface px-2 py-1 font-mono text-[11px] text-ink/70 shadow-sm">
                      {keys}
                    </kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section title={t("Help")}>
            <TourButton className="self-start text-body font-semibold text-ink underline-offset-2 hover:underline">
              {t("Show the guided tour again")}
            </TourButton>
            <Link href="/trash" className="self-start text-body font-semibold text-ink underline-offset-2 hover:underline">
              {t("Open Trash")}
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
