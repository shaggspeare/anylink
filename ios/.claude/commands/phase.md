---
description: Run one build phase from docs/08-build-plan.md (usage: /phase 4)
argument-hint: <phase number>
---

You are building the AnyLink iOS app. Run **Phase $ARGUMENTS** from `docs/08-build-plan.md`.

1. Read `CLAUDE.md`, then the Phase $ARGUMENTS section of `docs/08-build-plan.md`, then every doc listed under its **Read:** line.
2. Skim `docs/progress.md` for what earlier phases left open.
3. Restate the phase's task list as a checklist (use the task list tool), then implement it task by task.
   - Commit after each task: `phase-$ARGUMENTS: <task>`.
   - After each package change, run `swift test --package-path Packages/AnyLinkKit`.
4. If a doc is ambiguous or contradicts the spec or the SDK, pick the option `docs/10-decisions.md` points to. If it
   doesn't cover the case, choose the most native option, record it as a new decision row and continue. Ask only if
   the choice changes the data model or the API contract.
5. At the end, run `/verify`, then append a section to `docs/progress.md`:
   - done;
   - not done, and why;
   - spec conflicts;
   - `// BACKEND:` items added;
   - what to check by hand.
6. Stop. Don't start the next phase.
