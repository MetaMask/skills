---
repo: metamask-extension
parent: recipe-fix-ticket
---

# MetaMask Extension

For Extension tickets, first classify whether the bug is popup UI, full-screen UI, service worker/controller state, dapp interaction, permissions, network, transaction, migration, or build/config behavior.

Use existing e2e fixtures and controller tests before adding new helpers. Runtime proof should name the browser context and fixture.

For visible Extension UI tickets, the pass bar is a live CDP recipe run, not
only Jest/type/lint. Use `mm-harness verify` (or the installed
`mms-recipe-harness` script), then run the recipe with `--cdp-port <port>` and
save artifacts under an ignored task directory. Return the recipe path,
`summary.json`, `trace.json`, screenshots, evidence manifest, and any fixture
gap. If CDP is offline, try the harness auto-prepare path before declaring a
runtime blocker.
