import { cookies, headers } from "next/headers";
import { isLocale, LOCALE_COOKIE, matchLocale, type Locale } from "./locales";
import { makeT, type Messages } from "./translate";

/** The visitor's pick in Settings, else their browser's language. */
export async function getLocale(): Promise<Locale> {
  const picked = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(picked) ? picked : matchLocale((await headers()).get("accept-language"));
}

export async function getMessages(locale: Locale): Promise<Messages> {
  if (locale === "en") return {};
  return (await import(`./messages/${locale}.json`)).default;
}

/** For Server Components and Server Actions. */
export async function getT() {
  const locale = await getLocale();
  return makeT(await getMessages(locale), locale);
}
