---
repo: metamask-extension
parent: recipe-wallet-control
---

# Recipe Wallet Control - MetaMask Extension

Use the Extension recipe runtime injected by `/recipe-harness` to drive wallet-semantic flows through browser/CDP contexts. Install/launch via /recipe-harness; this overlay names the wallet primitives.

## Prerequisites

Before any primitive:

1. Confirm you are in a `metamask-extension` checkout.
2. Run `/recipe-harness extension install --target .`.
3. Confirm the intended browser is reachable over CDP.
4. Run `/recipe-harness extension verify --target . --cdp-port <port>`.
5. Use only local debug profiles and throwaway fixture wallets.

If harness verify fails, report wallet-control proof as blocked by runtime readiness, not as product failure.

**Dist-freshness gate.** Verify's `dist-freshness` check compares the git id in `dist/chrome/manifest.json` to HEAD:

- `stale` (verify fails) — dist built from another commit, or source edited since build. Stop; ask: reuse / `yarn start` (watch) / rebuild. (`build:test` = e2e baseline only.)
- `no-build` / `unknown` — can't prove parity; confirm before relying on it.
- `fresh` — proceed.

## Core Wallet Primitives

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

Use namespaced Recipe v1 UI actions for real UI paths: `ui.press`, `ui.wait_for`, `ui.scroll`, and `ui.screenshot`. No text-entry ui.* yet; use a manifest domain action.

## Current Boundary

```bash
/mms-recipe-harness live --cdp-port <port> --launch-existing-dist  # fixture at temp/runtime/wallet-fixture.json or .agent/wallet-fixture.json
```

Harness injects fixture state and unlocks before proof.
