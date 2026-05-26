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

These primitives are backed by `temp/agentic/recipes/domains/extension-core/**` after harness install.

### `unlock`

Use the named flow when a vault already exists:

```bash
bash temp/agentic/recipes/validate-recipe.sh \
  temp/agentic/recipes/domains/extension-core/flows/unlock-wallet.json \
  --cdp-port <port> \
  --artifacts-dir <artifacts-dir>
```

Expected proof: unlock form is absent or password entry succeeds, then `account-menu-icon` is visible.

### `select-account`

Use the named flow with a target address:

```bash
bash temp/agentic/recipes/validate-recipe.sh \
  temp/agentic/recipes/domains/extension-core/flows/select-account.json \
  --cdp-port <port> \
  --param address=0x... \
  --artifacts-dir <artifacts-dir>
```

Expected proof: `extension-core/accounts` reports `selectedAddress` equal to the requested address.

### `navigate`

Use `navigate` nodes or existing flows such as `navigate-settings.json` for Extension routes.

### `screenshot`

Use recipe `screenshot` nodes after a route, selector, or state settle condition. Do not screenshot a loading or transitional page as proof.

### `eval-state`

Use named eval refs before raw service-worker/page eval:

```json
{ "action": "eval_ref", "ref": "extension-core/accounts" }
{ "action": "eval_ref", "ref": "extension-core/network" }
{ "action": "eval_ref", "ref": "extension-core/wallet-state" }
```

## Interaction Helpers

Use `press`, `set_input`, `wait_for`, and `screenshot` for real UI paths. Use service-worker or page eval only for inspection, setup, or internal-state proof; never use it to fabricate a visible UI result.

## Current Boundary

`setup-wallet` for a brand-new Extension profile is not a stable wallet-control primitive yet. Prefer a prepared debug profile or an existing harness fixture flow; if neither exists, record the missing fixture/profile setup as a proof gap.
