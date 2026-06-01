---
repo: metamask-mobile
parent: recipe-wallet-control
---

# Recipe Wallet Control — MetaMask Mobile

Drive a debug MetaMask Mobile app through wallet-semantic **v1 manifest actions** (`metamask.wallet.*`, `metamask.perps.*`, `ui.*`, `app.*`) run by the recipe runner. The mobile bridge under `scripts/perps/agentic/` (e.g. `cdp-bridge.js`) is the runtime those actions call for Hermes/CDP evaluation, route changes, presses, inputs, scrolling, unlock, and eval refs — it is a runtime implementation detail, not the authoring surface. Author recipes with the actions below; reach for raw bridge shell commands only for interactive debugging/inspection. Reuse `simulator-control` or `agent-device` for generic device inspection when useful.

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

Unlock an existing vault with the seeded fixture password. The action is idempotent — it inspects lock state and only unlocks if needed:

```json
{ "action": "metamask.wallet.ensure_unlocked", "timeout_ms": 45000 }
```

The password comes from the wallet fixture supplied to the run, not a node field. Failure usually means the app is not on the login screen, the fixture password is wrong, or CDP is disconnected.

### `metamask.wallet.setup`

Seed a debug wallet from the run's JSON fixture:

```json
{ "action": "metamask.wallet.setup", "timeout_ms": 45000 }
```

The fixture (accounts, password, settings) is provided to the run by the harness, not a node field. Setup validates the fixture, creates or unlocks the vault, and yields an account summary. For validation evidence, start from clean state or capture a before/after account assertion, because setup intentionally skips creation when a vault already exists.

### `ui.navigate`

Use the official `ui.navigate` action with a raw app `route` (and optional `params`) for any app, wallet, or Perps destination. There is no wallet- or perps-specific navigate action:

```json
[
  { "action": "ui.navigate", "route": "WalletTabHome", "timeout_ms": 30000 },
  { "action": "ui.navigate", "route": "PerpsMarketDetails", "params": { "market": { "symbol": "BTC", "name": "BTC", "price": "0", "change24h": "0", "change24hPercent": "0", "volume": "0", "maxLeverage": "100" } }, "timeout_ms": 30000 }
]
```

`ui.navigate` reports the previous and current routes; pair it with a `ui.wait_for` on a screen `test_id` to prove the destination settled. Some routes are idempotent when the app is already on the target tab/screen — treat "previous route equals current route" as success only when a following `ui.wait_for`/screenshot confirms the intended destination. If a route name is wrong the action fails with the attempted route; confirm route names against the app's navigation config.

### `ui.screenshot`

Capture the current simulator/emulator screen through the official screenshot action:

```json
{ "action": "ui.screenshot", "path": "screenshots/recipe-wallet-control-home.png" }
```

The runner writes the PNG under the run's artifacts dir. Failure usually means no matching booted simulator or connected Android device was found.

### `metamask.wallet.read_state`

Read wallet/controller state through manifest-backed state actions where available; use raw CDP inspection only for debugging/setup evidence:

```json
[
  { "action": "metamask.wallet.read_state" },
  { "action": "metamask.perps.read_positions", "market": "ETH" },
  { "action": "metamask.perps.read_orders", "market": "ETH" }
]
```

## Interaction Helpers

Use these only to complete real UI flows around the wallet primitives. Do not inject final validation state directly; drive the same UI code path a user would hit.

### `ui.press`

```json
{ "action": "ui.press", "target": "<testId>" }
```

### `ui.set_input`

```json
{ "action": "ui.set_input", "test_id": "<testId>", "value": "text value" }
```

### `ui.scroll`

```json
[
  { "action": "ui.scroll", "test_id": "<testId>", "scroll_into_view": true },
  { "action": "ui.scroll", "delta_y": 600 }
]
```

### `ui.wait_for`

```json
[
  { "action": "ui.wait_for", "test_id": "<testId>", "expected": "present", "timeout_ms": 30000 },
  { "action": "ui.wait_for", "text": "Perps", "timeout_ms": 30000 }
]
```

Prefer `ui.wait_for` over fixed sleeps for any settle/poll condition; fail loudly on timeout.

### go back (bridge debug)

There is no v1 "go back" action. In recipes, drive back-navigation through the real UI (`ui.press` a back control). For interactive debugging only, the installed bridge exposes:

```bash
bash scripts/perps/agentic/app-state.sh can-go-back
bash scripts/perps/agentic/app-state.sh go-back
```

### guarded raw CDP inspection (bridge debug)

There is no v1 eval action. For inspection or debug-only setup only, the installed bridge exposes raw eval:

```bash
bash scripts/perps/agentic/app-state.sh eval 'JSON.stringify({route: globalThis.__AGENTIC__.getRoute().name})'
bash scripts/perps/agentic/app-state.sh eval-async '(async function(){ return JSON.stringify(await someDebugCall()); })()'
```

Use raw eval for inspection or debug-only setup, not to fabricate a passing assertion. Recipes must prove state through manifest actions (`metamask.wallet.read_state`, `metamask.perps.read_*`, `assert_json`), never raw eval.
