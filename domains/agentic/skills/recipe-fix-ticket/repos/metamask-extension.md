---
repo: metamask-extension
parent: recipe-fix-ticket
---

# MetaMask Extension

For Extension tickets, first classify whether the bug is popup UI, full-screen UI, service worker/controller state, dapp interaction, permissions, network, transaction, migration, or build/config behavior.

Use existing e2e fixtures and controller tests before adding new helpers. Runtime proof should name the browser context and fixture.

For visible Extension UI tickets, the pass bar is a live CDP recipe run, not
only Jest/type/lint. Use the runner-appropriate `mms-recipe-harness` delegate
(Codex: `$mms-recipe-harness`; Claude/Cursor: `/mms-recipe-harness`) or its
installed portable `scripts/recipe-harness verify` wrapper, then run the recipe
with `--cdp-port <port>` and save artifacts under an ignored task directory.
Do not require personal shell aliases. Return the recipe path,
`summary.json`, `trace.json`, screenshots, evidence manifest, and any fixture
gap. If CDP is offline and runtime-start approval exists, try the harness
auto-prepare path. If approval is required and absent, run static/no-start
harness checks and record `BLOCKED: pending runtime-start approval` with the
exact command.

Load `references/metamask-extension-checklist.md` and execute it as the ordered checklist for Extension bug fixes. Name the target context: popup, sidepanel, fullscreen, dapp tab, or service-worker/controller.
