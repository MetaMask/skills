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

## Preferred Surfaces

- Existing e2e flows and page objects for navigation and selectors.
- Existing fixtures for wallet/account/network setup.
- Simulator/device status commands before UI work.
- Named state evaluators such as `eval_ref` when the repo provides them.

## Common Action Mapping

- Open screen: `navigate` with a route or project-owned flow name.
- Tap: `press` with a stable test id or page-object target.
- Enter text: `set_input` with target and value.
- Wait: `wait_for` with a UI target or state predicate.
- Assert wallet/app state: `eval_ref` with an expected JSON shape.
- Capture proof: `screenshot` after `wait_for` or `eval_ref`.
- Reset state: fixture reset, app relaunch, or project cleanup action.

## Mobile Quality Bar

- State the simulator/device, platform, build type, and wallet fixture.
- Avoid recipes that rely on arbitrary sleeps.
- Avoid raw runtime eval as the only proof of user-visible behavior.
- Teardown or isolate wallet state so repeated runs do not inherit balances, permissions, pending txs, or network changes.
- If a recipe cannot be run, include the missing device/build/fixture requirement as a gap.
