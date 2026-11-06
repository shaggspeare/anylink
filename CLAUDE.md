@AGENTS.md

# Feature parity

When adding a new feature, implement it on both iOS (`ios/`) and web (`src/`) — unless it's genuinely impossible on one platform. If so, say which and why.

# Translations

Source language is English. Supported: Ukrainian (`uk`), Russian (`ru`), Japanese (`ja`), French (`fr`), German (`de`), Italian (`it`), Korean (`ko`), Indonesian (`id`), Arabic (`ar`), Chinese Simplified (`zh-Hans`), Polish (`pl`), Spanish (`es`), Portuguese (`pt-BR`).

Every change that adds or edits user-facing copy ships its translations for all 13 languages in the same change — no English-only strings left behind.
- iOS: add the key to `ios/AnyLink/Resources/Localizable.xcstrings` with a `comment`, and a `translated` stringUnit for each language. Keep format specifiers intact (positional `%1$@`, `%2$@` when a key has several args; `%%` literal).
- Web: wrap copy in `t("English text")` (`useT()` in client components, `await getT()` on the server; `msg("…")` for module-level constants, then `t(x)` when rendered). The English text is the key, so the first argument must be a string literal. Interpolate with `{name}`, never by concatenating. Plurals: `t("{count} link|{count} links", { count })`, and the dictionary value is an object of `Intl.PluralRules` forms (`one`, `few`, `many`, `other`…). Add each key to every `src/i18n/messages/<locale>.json`; `npm run i18n:check` must report 0 missing.
- `src/app/privacy-policy` stays English (legal text).
- Keep brand names untranslated: AnyLink, AnyLink Pro, Pro, Safari, iCloud, iPhone.
