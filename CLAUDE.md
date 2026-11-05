@AGENTS.md

# Feature parity

When adding a new feature, implement it on both iOS (`ios/`) and web (`src/`) — unless it's genuinely impossible on one platform. If so, say which and why.

# Translations

Source language is English. Supported: Ukrainian (`uk`), Russian (`ru`), Japanese (`ja`), French (`fr`), German (`de`), Italian (`it`), Korean (`ko`), Indonesian (`id`), Arabic (`ar`), Chinese Simplified (`zh-Hans`), Polish (`pl`), Spanish (`es`), Portuguese (`pt-BR`).

Every change that adds or edits user-facing copy ships its translations for all 13 languages in the same change — no English-only strings left behind.
- iOS: add the key to `ios/AnyLink/Resources/Localizable.xcstrings` with a `comment`, and a `translated` stringUnit for each language. Keep format specifiers intact (positional `%1$@`, `%2$@` when a key has several args; `%%` literal).
- Web: same rule once web i18n exists (it doesn't yet — `src/` is English-only).
- Keep brand names untranslated: AnyLink, AnyLink Pro, Pro, Safari, iCloud, iPhone.
