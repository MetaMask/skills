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

The same `scripts/recipe-harness.sh` path is mirrored under `.claude/skills/mms-recipe-harness/` and `.cursor/rules/mms-recipe-harness/`; examples use `.agents/skills` because Codex reads that tree.

Use `mme-4` when available. Record `${RECIPE_HARNESS_ROOT:-temp/agentic/recipe-harness}/extension/manifest.json` and the verify artifacts. Exclude harness overlay paths from product diffs and PR evidence.

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

Use only action names declared by the installed v1 action manifest. Typical Extension mappings are:

- Launch extension: `/recipe-harness` live/verify flow or runner setup with `--launch-existing-dist`.
- Open route/popup: `ui.navigate` with a raw extension `hash` route, e.g. `{ "hash": "#/?tab=perps" }`.
- Probe browser/extension runtime: `cdp.target` for target metadata and reachability.
- Interact with UI: `ui.press`, `ui.wait_for`, `ui.scroll`, `ui.screenshot`, and any manifest-declared text-entry action.
- Assert internal/domain state: command-level tests, `assert_json`, or manifest-declared domain actions such as `metamask.wallet.read_state` and `metamask.perps.assert_positions`.
- Capture proof: `ui.screenshot`, trace, console log, test report, or state JSON, then `index_artifacts` for extra files not registered by the runner.

## Extension Quality Bar

- Name the browser/channel, extension build, fixture, and dapp/network dependency.
- Use UI evidence for user-visible claims and command/state evidence for internal claims.
- Wait for route, selector, service worker response, or controller state before screenshots.
- Do not use backend or state probes as the primary proof of a popup UI claim.
- Keep raw CDP and service worker eval scoped, named, and tied to the claim.
