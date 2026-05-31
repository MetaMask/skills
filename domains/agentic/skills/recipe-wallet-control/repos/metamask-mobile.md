---
repo: metamask-mobile
parent: recipe-wallet-control
---

# Recipe Wallet Control — MetaMask Mobile

Use the agentic mobile scripts under `scripts/perps/agentic/` to drive a debug MetaMask Mobile app through wallet-semantic primitives. The shell wrappers call `scripts/perps/agentic/cdp-bridge.js` for Hermes/CDP evaluation, route changes, presses, inputs, scrolling, unlock, and eval refs. Reuse `simulator-control` or `agent-device` for generic device inspection when useful, but prefer this overlay for wallet setup, route navigation, screenshots, and controller state.

## Harness Launch Requirement

Launch via harness only (`recipe-harness launch` / `preflight.sh --mode fast`). Non-harness launch lacks Metro/CDP wiring and fixtures. Never use `yarn start:ios`, `xcrun simctl launch`, or manual taps. Prefer `--mode fast`; if it reports a cache miss, stop and ask for explicit approval before escalating to `auto`, `rebuild-native`, or `clean`.

## Prerequisites

1. `metamask-mobile` checkout with `scripts/perps/agentic/` present.
2. Simulator/emulator booted, matching `.js.env` (`IOS_SIMULATOR`, `WATCHER_PORT`).
3. Fixture files contain only throwaway test wallets.

If not met, interrupt and ask the user to fix via the recovery table below.

## Status and Recovery

```bash
bash scripts/perps/agentic/app-state.sh status
```

**Status succeeds** → proceed. **Status fails** → diagnose and recover:

| State | Detection | Recovery |
|---|---|---|
| Not installed | `xcrun simctl listapps <sim> \| grep io.metamask` empty | Ask user to approve: `preflight.sh --platform <plat> --mode fast`. |
| Installed, not launched | Home screen visible, "0 targets" | Ask user to approve: `preflight.sh --platform <plat> --mode fast` or `start-metro.sh --platform <plat> --launch`. |
| Running, wrong port/no CDP | App visible but status fails ("0 targets" / "Cannot reach Metro") | Ask user before killing/relaunching: kill app + kill stale Metro (`lsof -i :<port>`) + `preflight.sh --platform <plat> --mode fast`. |

### Preflight modes

| Mode | Behavior |
|---|---|
| `--mode fast` | No build — reuses an installed matching app or shared cache, and fails loudly on cache/fingerprint miss. Default for agent/human validation lanes. |
| `--mode auto` | Fingerprint-gated reuse; builds on cache miss. Use only after explicit runtime/rebuild approval or in a dedicated cache-warming lane. |
| `--mode clean` | Full: `yarn setup` → `pod install --repo-update` → build → Metro → CDP. Use only after explicit clean-rebuild approval for corrupted state. |

Fresh wallet validation (bypasses existing vault):

```bash
bash scripts/perps/agentic/preflight.sh \
  --platform ios --mode fast \
  --wallet-setup --wallet-fixture .agent/wallet-fixture.json
# If fast reports a missing/stale cache, stop and ask before rerunning with auto/clean.
```

## Core Wallet Primitives

### `metamask.wallet.ensure_unlocked`

Use the Recipe v1 wallet action to unlock an existing vault with the fixture password:

```bash
MM_PASSWORD="$WALLET_PASSWORD" bash scripts/perps/agentic/unlock-wallet.sh
# or
bash scripts/perps/agentic/unlock-wallet.sh "$WALLET_PASSWORD"
```

Expected output prints the current route, unlock result, and route after unlock. Failure usually means the app is not on the login screen, the password is wrong, or CDP is disconnected.

### `metamask.wallet.setup`

Use the Recipe v1 wallet setup action to seed a debug wallet from a JSON fixture:

```bash
bash scripts/perps/agentic/setup-wallet.sh --fixture .agent/wallet-fixture.json
```

Expected output validates the fixture, creates or unlocks the vault, and prints an account summary. For validation evidence, start from clean state or capture a before/after account assertion because the script intentionally skips creation when a vault already exists.

### `ui.navigate`

Use the official `ui.navigate` action with a raw app `route` (and optional `params`) for any app, wallet, or Perps destination. There is no wallet- or perps-specific navigate action:

```bash
bash scripts/perps/agentic/app-navigate.sh WalletTabHome
bash scripts/perps/agentic/app-navigate.sh PerpsMarketDetails '{"market":{"symbol":"BTC","name":"BTC","price":"0","change24h":"0","change24hPercent":"0","volume":"0","maxLeverage":"100"}}'
```

Expected output prints the previous and current routes and, unless `--no-screenshot` is used, a verification screenshot path. If a route fails, list mounted routes first:

```bash
bash scripts/perps/agentic/app-navigate.sh --list
```

Some route aliases are idempotent when the app is already on the target tab/screen. Treat "previous route equals current route" as success only when the route/status evidence matches the intended destination.

### `ui.screenshot`

Capture the current simulator/emulator screen through the Recipe v1 screenshot action:

```bash
bash scripts/perps/agentic/screenshot.sh recipe-wallet-control-home
```

Expected output is an absolute PNG path under `.agent/screenshots/`. Failure usually means no matching booted simulator or connected Android device was found.

### `metamask.wallet.read_state`

Read wallet/controller state through manifest-backed state actions where available; use raw CDP inspection only for debugging/setup evidence:

```json
{ "action": "metamask.wallet.read_state" }
{ "action": "metamask.perps.read_positions", "market": "ETH" }
{ "action": "metamask.perps.read_orders", "market": "ETH" }
```

## Interaction Helpers

Use these only to complete real UI flows around the wallet primitives. Do not inject final validation state directly; drive the same UI code path a user would hit.

### `ui.press`

```bash
bash scripts/perps/agentic/app-state.sh press <testId>
```

### text entry

```bash
bash scripts/perps/agentic/app-state.sh set-input <testId> "text value"
```

### `ui.scroll`

```bash
bash scripts/perps/agentic/app-state.sh scroll --test-id <testId> --offset 600
bash scripts/perps/agentic/app-state.sh scroll --offset 600
```

### `ui.wait_for`

Prefer Recipe v1 `ui.wait_for` nodes for repeated polling. For a one-off check, poll a route or expression with `app-state.sh route` or `app-state.sh eval` in the shell and fail loudly on timeout.

### go back

```bash
bash scripts/perps/agentic/app-state.sh can-go-back
bash scripts/perps/agentic/app-state.sh go-back
```

### guarded raw CDP inspection

```bash
bash scripts/perps/agentic/app-state.sh eval 'JSON.stringify({route: globalThis.__AGENTIC__.getRoute().name})'
bash scripts/perps/agentic/app-state.sh eval-async '(async function(){ return JSON.stringify(await someDebugCall()); })()'
```

Use raw eval for inspection or debug-only setup, not to fabricate a passing assertion.
