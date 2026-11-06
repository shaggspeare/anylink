/** Web languages. English is the source: its text is the key, so it has no dictionary. Same set as iOS. */
export const LOCALES = ["en", "uk", "ru", "ja", "fr", "de", "it", "ko", "id", "ar", "zh-Hans", "pl", "es", "pt-BR"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = "lang";
export const isLocale = (v: string | undefined): v is Locale => LOCALES.includes(v as Locale);

/** Each language named in itself, for the picker. */
export const languageName = (l: Locale) => new Intl.DisplayNames([l], { type: "language" }).of(l) ?? l;

/** First supported language in an Accept-Language header ("de-CH,de;q=0.9" → de, "zh-CN" → zh-Hans). */
export function matchLocale(header: string | null): Locale {
  for (const part of (header ?? "").split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase();
    if (!tag) continue;
    if (tag.startsWith("zh")) return "zh-Hans"; // ponytail: Traditional Chinese readers get Simplified until zh-Hant exists
    if (tag.startsWith("pt")) return "pt-BR";
    const base = tag.split("-")[0];
    const hit = LOCALES.find((l) => l === base);
    if (hit) return hit;
  }
  return "en";
}
