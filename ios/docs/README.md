# AnyLink iOS: documentation map

These docs exist so that Claude Code (or a developer) can build the AnyLink iPhone app in Swift and SwiftUI phase by
phase, without having to guess. The design direction is **version B ("designer's take")** from the design canvas.

## Files

| File | What it covers | Read it when |
|---|---|---|
| `../CLAUDE.md` | Stack, commands, rules, definition of done | Always (Claude Code loads it automatically) |
| `01-product.md` | What AnyLink is, principles, voice, v1 scope | Phase 0, and whenever behaviour is unclear |
| `02-architecture.md` | Targets, modules, state, navigation, concurrency | Phases 0–3, and before adding a new type |
| `03-design-system.md` | Swift tokens, fonts, surfaces, components with exact sizes | Any UI work |
| `04-screens.md` | Every screen: layout, states, interactions, copy, acceptance | The phase that builds that screen |
| `05-data-and-api.md` | Models, API contract, crawl stream, auth, sync, backend gaps | Phases 1, 5, 11 |
| `06-query-language.md` | Search/filter grammar, parser, evaluator, test table | Phases 1 and 8 |
| `07-ios-native.md` | Share Extension, paste, App Intents, Spotlight, TipKit, Charts, highlights | Phases 5, 6, 12, 13 |
| `08-build-plan.md` | Ordered phases with tasks, acceptance criteria and a prompt for each | Start of every session |
| `09-testing.md` | Unit, UI, snapshot, accessibility and manual QA | Every phase gate |
| `10-decisions.md` | Decision log: spec conflicts, why B differs from A, open questions | When a doc and the spec disagree |
| `spec/01-design-tokens-and-visual-spec.md` | Original token and visual spec (from the web app) | Exact values |
| `spec/02-features-and-ios-native.md` | Original feature spec and backend contract | Exact rules and copy |
| `fixtures/library.json` | Sample library (collections, links, trash) | `Fixtures` module, previews, MockAPI |
| `fixtures/crawl-*.ndjson` | Recorded crawl streams: success, excerpt-only, failed | MockAPI, crawl tests |
| `../templates/project.yml` | XcodeGen starting point | Phase 0 |
| `../.claude/commands/*.md` | `/phase`, `/verify`, `/screen` slash commands | Day-to-day use |

## Visual references

- **Design canvas** (A spec-strict vs B designer's take, with comments): the "AnyLink iOS — A spec-strict vs B
  designer's take" design artifact.
- **Clickable prototype of B**: the "AnyLink B Prototype" artifact. Treat its behaviour (transitions, what each
  tap does, toasts) as the interaction reference.

Neither reference is code to port. They are HTML mockups. Build native SwiftUI that matches their layout and behaviour.

## How to drive Claude Code with these docs

1. Put this folder at the root of an empty git repo, together with `CLAUDE.md`, `templates/` and `.claude/`.
2. Start Claude Code in the repo and run `/phase 0`, or say:
   *"Read CLAUDE.md and docs/08-build-plan.md. Do Phase 0. Stop at the phase gate and report."*
3. Review the summary, run the app, then run `/phase 1`, and so on. Run `/verify` before closing a phase.
4. When the backend team ships an endpoint from `05-data-and-api.md` § Gaps, ask Claude Code to
   *"replace the `// BACKEND:` mocks for <endpoint> with LiveAPI calls"*.

## Precedence

What you say in the conversation › `docs/10-decisions.md` › other `docs/` files › `docs/spec/` › the prototype.
