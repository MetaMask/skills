---
repo: metamask-mobile
parent: recipe-fix-ticket
---

# MetaMask Mobile

For Mobile tickets, first classify whether the bug is navigation, rendering, wallet state, controller state, network, transaction, notification, deeplink, or build/config behavior.

Use existing fixtures and page objects before adding new helpers. Runtime proof should avoid inherited simulator state.

For visible Mobile UI tickets, the pass bar is a live recipe run on the intended
simulator/device, not only Jest/type/lint. Use the runner-appropriate
`mms-recipe-harness` delegate (Codex: `$mms-recipe-harness`; Claude/Cursor:
`/mms-recipe-harness`) or its installed portable `scripts/recipe-harness verify`
wrapper, then run the recipe through the installed Mobile recipe runner and save
artifacts under an ignored task directory. Do not require personal shell aliases. Return the recipe path, `summary.json`, `trace.json`,
screenshots/video when available, evidence manifest, and any fixture/device gap.
If the app or simulator is not reachable and runtime-start approval exists, let
the harness preflight attempt to prepare it. If approval is required and absent,
run static/no-start harness checks and record `BLOCKED: pending runtime-start
approval` with the exact command.

Load `references/metamask-mobile-checklist.md` and execute it as the ordered checklist for Mobile bug fixes. Runtime proof should avoid inherited simulator state and name the fixture/setup flow used.
