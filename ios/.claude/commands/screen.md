---
description: Build or fix one screen against its spec (usage: /screen S8 Add a link sheet)
argument-hint: <screen id and name from docs/04-screens.md>
---

Work only on screen **$ARGUMENTS** from `docs/04-screens.md`.

1. Read that screen's section, `docs/03-design-system.md` for the components it uses, and any doc it links to.
2. List its states. Each state gets a `#Preview` (light and dark), fed by `Fixtures` / `MockAPI`.
3. Implement or fix the layout, interactions and copy exactly as written. Use existing DesignSystem components. If
   one is missing, add it to DesignSystem (with previews) rather than styling inline.
4. Check: VoiceOver labels, the largest Dynamic Type size, Reduce Transparency, Reduce Motion.
5. Run `swift test` if package code changed, and build the app.
6. Summarise in five lines or fewer: states covered, differences from the spec (and why), follow-ups.
