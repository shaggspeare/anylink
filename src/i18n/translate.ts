/** A dictionary maps the English text to its translation. Plural keys ("{count} link|{count} links") map to the
 * forms Intl.PluralRules names for that language: { one, few, many, other, … }. */
export type Messages = Record<string, string | Partial<Record<Intl.LDMLPluralRule, string>>>;
export type Vars = Record<string, string | number>;
export type T = (key: string, vars?: Vars) => string;

/** `t("{count} selected", { count: 3 })`. Missing keys fall back to the English key. */
export function makeT(messages: Messages, locale = "en"): T {
  const rules = new Intl.PluralRules(locale);
  return (key, vars) => {
    const value = messages[key] ?? key;
    const count = typeof vars?.count === "number" ? vars.count : NaN;
    let s: string;
    if (typeof value === "string") {
      // English plurals live in the key itself: "one|other".
      const [one, other = one] = value.split("|");
      s = count === 1 ? one : other;
    } else {
      s = value[rules.select(count)] ?? value.other ?? key;
    }
    return vars
      ? s.replace(/\{(\w+)\}/g, (m, name) =>
          name in vars ? (typeof vars[name] === "number" ? vars[name].toLocaleString(locale) : String(vars[name])) : m,
        )
      : s;
  };
}

/** Marks a string for translation where `t` isn't available (module-level constants). Translate it with `t(x)` when
 * it's rendered. */
export const msg = (key: string) => key;
