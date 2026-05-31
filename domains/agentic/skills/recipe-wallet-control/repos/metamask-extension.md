---
repo: metamask-extension
parent: recipe-wallet-control
---

# Recipe Wallet Control - MetaMask Extension

Use the Extension recipe runtime injected by `/recipe-harness` to drive wallet-semantic flows through browser/CDP contexts. Keep injection, browser launch, and runner installation in `/recipe-harness`; this overlay names the wallet primitives an agent may compose in `/recipe-cook`.

## Prerequisites

Before any primitive:

1. Confirm you are in a `metamask-extension` checkout.
2. Run `/recipe-harness extension install --target .`.
3. Confirm the intended browser is reachable over CDP.
4. Run `/recipe-harness extension verify --target . --cdp-port <port>`.
5. Use only local debug profiles and throwaway fixture wallets.

If harness verify fails, report wallet-control proof as blocked by runtime readiness, not as product failure.

## Core Wallet Primitives

These primitives are the manifest-backed Recipe v1 actions exposed by the installed MetaMask runner. Use `/recipe-harness` to install/verify the runner, then compose these actions in `/recipe-cook` recipes.

### `metamask.wallet.ensure_unlocked`

Use when a vault/profile already exists and may be locked:

```json
{ "action": "metamask.wallet.ensure_unlocked" }
```

Expected proof: the unlock form is absent after the action and wallet state can be read.

### `metamask.wallet.select_account`

Use with a deterministic fixture address:

```json
{ "action": "metamask.wallet.select_account", "address": "0x..." }
```

Expected proof: `metamask.wallet.read_state` reports the selected account/address expected by the recipe.

### `ui.navigate`

Use the official `ui.navigate` action with a raw extension `hash` route for any destination, including Perps. There is no wallet- or perps-specific navigate action:

```json
{ "action": "ui.navigate", "hash": "#/?tab=perps" }
```

### `metamask.wallet.read_state`

Read wallet state without mutating UI:

```json
{ "action": "metamask.wallet.read_state" }
```

Use this as internal-state proof alongside visible UI proof. Do not use raw page/service-worker evaluation to fabricate a visible result.

### `ui.screenshot`

Capture visual proof after a route, selector, or state settle condition:

```json
{ "action": "ui.screenshot", "path": "screenshots/wallet-state.png" }
```

Do not screenshot a loading or transitional page as proof.

## Interaction Helpers

Use namespaced Recipe v1 UI actions for real UI paths: `ui.press`, `ui.wait_for`, `ui.scroll`, and `ui.screenshot`. If text entry is needed, use a manifest-declared domain action that owns the flow until the target runner advertises and validates a text-entry UI action.

## Current Boundary

For brand-new Extension profiles, use `/mms-recipe-harness live --launch-existing-dist` with a shared wallet fixture at `temp/runtime/wallet-fixture.json` or `.agent/wallet-fixture.json`. The harness generates persisted Extension state from the Mobile-compatible fixture shape, injects it into the isolated browser profile over CDP, unlocks with the fixture password, and validates the named mnemonic/private-key accounts before recipe proof begins.
