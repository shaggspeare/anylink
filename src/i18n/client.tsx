"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "./locales";
import { makeT, type Messages, type T } from "./translate";

const I18n = createContext<{ locale: Locale; t: T }>({ locale: "en", t: makeT({}) });

export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: makeT(messages, locale) }), [locale, messages]);
  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}

export const useT = () => useContext(I18n).t;
export const useLocale = () => useContext(I18n).locale;
