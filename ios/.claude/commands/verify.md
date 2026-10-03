---
description: Build, test and check the definition of done for the current work
---

Verify the current state of the AnyLink iOS repo:

1. Run `scripts/verify.sh`. If it doesn't exist yet, run `xcodegen generate`,
   `swift test --package-path Packages/AnyLinkKit`, and
   `xcodebuild -scheme AnyLink -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build`.
   Fix every error **and warning**.
2. Grep for violations of `CLAUDE.md` rules in the app and DesignSystem sources:
   - hex colour literals or `Color(red:` outside `Tokens.swift`;
   - `.font(.system(size:` in screens;
   - `UIPasteboard.general.url` or `.string` reads;
   - force unwraps (`!`) outside tests;
   - `DispatchQueue`;
   - TODOs without an owner.
3. For each screen touched since the last commit on main, check that every state listed in `docs/04-screens.md`
   has a `#Preview`, in light and dark.
4. If UI tests exist for the touched area, run them.
5. Report a short table: check · pass/fail · what you fixed. Don't move on to new feature work.
