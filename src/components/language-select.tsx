"use client";

import { useRouter } from "next/navigation";
import { useLocale, useT } from "@/i18n/client";
import { languageName, LOCALE_COOKIE, LOCALES } from "@/i18n/locales";

/** Saves the pick in the locale cookie and re-renders the page in it. Used by Settings and the landing nav. */
export function LanguageSelect({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const t = useT();
  return (
    <select
      aria-label={t("Language")}
      value={locale}
      onChange={(e) => {
        document.cookie = `${LOCALE_COOKIE}=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
      className={className}
    >
      {LOCALES.map((l) => (
        <option key={l} value={l}>
          {languageName(l)}
        </option>
      ))}
    </select>
  );
}
