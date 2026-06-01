---
repo: metamask-mobile
parent: recipe-cook
---

# MetaMask Mobile

Use this overlay when cooking recipes for `metamask-mobile`.

## Discovery

Before authoring new actions, inspect what the checkout already exposes:

```sh
find scripts test e2e -iname '*agentic*' -o -iname '*recipe*' -o -iname '*fixture*'
yarn --silent a:status 2>/dev/null || true
```

If `/recipe-wallet-control` is installed, read its Mobile overlay and action vocabulary. Treat it as an implementation layer for wallet primitives, not as the recipe contract.

## Runtime Harness

Before claiming live Mobile recipe proof, install and verify `/recipe-harness`:

```sh
.agents/skills/mms-recipe-harness/scripts/recipe-harness.sh mobile install --target .
.agents/skills/mms-recipe-harness/scripts/recipe-harness.sh mobile verify --target .
```

The same `scripts/recipe-harness.sh` path is mirrored under `.claude/skills/mms-recipe-harness/` and `.cursor/rules/mms-recipe-harness/`; examples use `.agents/skills` because Codex reads that tree.

Do this especially on historical commits, where the checked-out runner may be stale or absent. Record `${RECIPE_HARNESS_ROOT:-temp/agentic/recipe-harness}/mobile/manifest.json` and the verify artifacts. Exclude harness overlay paths from product diffs and PR evidence.

## Preferred Surfaces

- `/recipe-harness` verified Mobile runtime for live recipe proof.
- Existing e2e flows and page objects for navigation and selectors.
- Existing fixtures for wallet/account/network setup.
- Simulator/device status commands before UI work.
- Manifest-declared app, UI, wallet, and domain actions exposed by the installed runner manifest.

## Common Action Mapping

Use only action names declared by the installed v1 action manifest. Typical Mobile mappings are:

- Open app area/screen: `ui.navigate` with a raw `route` (and optional `params`), e.g. `{ "route": "PerpsMarketListView" }` or `{ "route": "PerpsMarketDetails", "params": { "market": { "symbol": "ETH" } } }`.
- Tap: `ui.press` with a stable `test_id`, text, or page-object target.
- Enter text: use a domain action that owns the flow unless the installed manifest declares a text-entry UI action.
- Scroll: `ui.scroll` with direction/target parameters.
- Wait: `ui.wait_for` with `test_id`, `text`, `expected`, or `visible` (manifest-declared fields).
- Assert wallet/app/domain state: manifest-declared actions such as `metamask.wallet.read_state`, `metamask.perps.assert_positions`, or `assert_json` over a real artifact/output.
- Capture proof: `ui.screenshot` after `ui.wait_for` or a domain assertion.
- Index proof: `index_artifacts` for screenshots/logs not automatically registered by the runner.
- Reset state: fixture setup, app relaunch, or manifest-declared project cleanup action.

## Mobile Quality Bar

- State the simulator/device, platform, build type, and wallet fixture.
- Prefer focused tests or recipe commands over broad lint/test globs. Do not run full-repo eslint or unbounded `**/*` commands from recipes.
- Avoid recipes that rely on arbitrary sleeps.
- Add `timeout_ms` to slow Mobile commands so runner output records a real timeout instead of leaving the operator to infer a stall.
- Avoid raw runtime eval as the only proof of user-visible behavior.
- Teardown or isolate wallet state so repeated runs do not inherit balances, permissions, pending txs, or network changes.
- If a recipe cannot be run, include the missing device/build/fixture requirement as a gap.
