---
repo: metamask-extension
parent: recipe-cook
---

# MetaMask Extension

Use this overlay when cooking recipes for `metamask-extension`.

## Runtime Harness

Before claiming live Extension recipe proof, install and verify `/recipe-harness`:

```sh
.agents/skills/mms-recipe-harness/scripts/recipe-harness.sh extension install --target .
.agents/skills/mms-recipe-harness/scripts/recipe-harness.sh extension verify --target . --cdp-port <port>
```

Use `mme-4` when available. Record `.agent/recipe-harness/extension/manifest.json` and the verify artifacts. Exclude harness overlay paths from product diffs and PR evidence.

## Discovery

Before authoring new actions, inspect the checkout for existing automation:

```sh
find test tests e2e development temp -iname '*agentic*' -o -iname '*recipe*' -o -iname '*fixture*' -o -iname '*playwright*'
find . -maxdepth 3 -iname '*manifest*' -o -iname '*fixture*'
```

Prefer repo-owned browser, extension, fixture, and mock helpers over raw CDP snippets.

## Preferred Surfaces

- Existing e2e fixtures for unlocked wallets, networks, dapps, and permissions.
- Browser or extension automation already used by the repo.
- Project-owned helpers for service worker/background state.
- Command recipes for reducers, selectors, controllers, migrations, or build artifacts.

## Common Action Mapping

- Launch extension: project-owned browser launch or `playwright` action.
- Open route/popup: `navigate` or extension-specific route action.
- Inspect service worker/background: `service_worker` with a named query.
- Interact with UI: `press`, `set_input`, `wait_for`, `screenshot`.
- Assert internal state: command-level test or named state query.
- Capture proof: screenshot, trace, console log, test report, or state JSON.

## Extension Quality Bar

- Name the browser/channel, extension build, fixture, and dapp/network dependency.
- Use UI evidence for user-visible claims and command/state evidence for internal claims.
- Wait for route, selector, service worker response, or controller state before screenshots.
- Do not use backend or state probes as the primary proof of a popup UI claim.
- Keep raw CDP and service worker eval scoped, named, and tied to the claim.
