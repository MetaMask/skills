---
repo: metamask-mobile
parent: recipe-wallet-control
---

# Recipe Wallet Control — MetaMask Mobile

Use the agentic mobile scripts under `scripts/perps/agentic/` to drive a debug MetaMask Mobile app through wallet-semantic primitives. The shell wrappers call `scripts/perps/agentic/cdp-bridge.js` for Hermes/CDP evaluation, route changes, presses, inputs, scrolling, unlock, and eval refs. Reuse `simulator-control` or `agent-device` for generic device inspection when useful, but prefer this overlay for wallet setup, route navigation, screenshots, and controller state.

## Harness Launch Requirement

**Launch via harness only** (`preflight.sh` or `start-metro.sh --launch`). `__AGENTIC__` is in any debug build (patched by `recipe-harness install`), but non-harness launch (manual tap, Xcode, `xcrun simctl launch`) won't have Metro on the correct `WATCHER_PORT` or CDP targets on that port. Fixtures also won't be injected. Kill and relaunch via `preflight.sh` if the app was started outside the harness.

**Never use `yarn start:ios`, `xcrun simctl launch`, or manual taps** — they bypass harness port/CDP wiring.

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
| Not installed | `xcrun simctl listapps <sim> \| grep io.metamask` empty | Ask user: `preflight.sh --platform <plat> --mode auto` (builds + installs + Metro + CDP; ~15min first, ~2min cached) |
| Installed, not launched | Home screen visible, "0 targets" | Ask user: `preflight.sh --platform <plat> --mode auto` or `start-metro.sh --platform <plat> --launch` |
| Running, wrong port/no CDP | App visible but status fails ("0 targets" / "Cannot reach Metro") | Ask user: kill app + kill stale Metro (`lsof -i :<port>`) + `preflight.sh --platform <plat> --mode auto` |

### Preflight modes

| Mode | Behavior |
|---|---|
| `--mode auto` | Fingerprint-gated reuse; builds on cache miss. Default. |
| `--mode fast` | No build — fails if app missing or fingerprint mismatch. CI use. |
| `--mode clean` | Full: `yarn setup` → `pod install --repo-update` → build → Metro → CDP. Use for corrupted state. |

Fresh wallet validation (bypasses existing vault):

```bash
bash scripts/perps/agentic/preflight.sh \
  --platform ios --mode clean \
  --wallet-setup --wallet-fixture .agent/wallet-fixture.json
```

## Core Wallet Primitives

### `unlock`

Unlock an existing vault with the fixture password:

```bash
MM_PASSWORD="$WALLET_PASSWORD" bash scripts/perps/agentic/unlock-wallet.sh
# or
bash scripts/perps/agentic/unlock-wallet.sh "$WALLET_PASSWORD"
```

Expected output prints the current route, unlock result, and route after unlock. Failure usually means the app is not on the login screen, the password is wrong, or CDP is disconnected.

### `setup-wallet`

Seed a debug wallet from a JSON fixture:

```bash
bash scripts/perps/agentic/setup-wallet.sh --fixture .agent/wallet-fixture.json
```

Expected output validates the fixture, creates or unlocks the vault, and prints an account summary. For validation evidence, start from clean state or capture a before/after account assertion because the script intentionally skips creation when a vault already exists.

### `navigate`

Navigate to a registered route:

```bash
bash scripts/perps/agentic/app-navigate.sh WalletTabHome
bash scripts/perps/agentic/app-navigate.sh PerpsMarketDetails '{"market":{"symbol":"BTC","name":"BTC","price":"0","change24h":"0","change24hPercent":"0","volume":"0","maxLeverage":"100"}}'
```

Expected output prints the previous and current routes and, unless `--no-screenshot` is used, a verification screenshot path. If a route fails, list mounted routes first:

```bash
bash scripts/perps/agentic/app-navigate.sh --list
```

Some route aliases are idempotent when the app is already on the target tab/screen. Treat "previous route equals current route" as success only when the route/status evidence matches the intended destination.

### `screenshot`

Capture the current simulator/emulator screen:

```bash
bash scripts/perps/agentic/screenshot.sh recipe-wallet-control-home
```

Expected output is an absolute PNG path under `.agent/screenshots/`. Failure usually means no matching booted simulator or connected Android device was found.

### `eval-state`

Read wallet/controller state via CDP:

```bash
bash scripts/perps/agentic/app-state.sh status
bash scripts/perps/agentic/app-state.sh accounts
bash scripts/perps/agentic/app-state.sh eval-ref --list
bash scripts/perps/agentic/app-state.sh eval-ref perps/positions
bash scripts/perps/agentic/app-state.sh state engine.backgroundState.AccountsController
```

Expected output is JSON or route/state text from the running app. Failure means CDP cannot evaluate in the app context or the requested eval ref/path is not registered.

## Interaction Helpers

Use these only to complete real UI flows around the wallet primitives. Do not inject final validation state directly; drive the same UI code path a user would hit.

### `press`

```bash
bash scripts/perps/agentic/app-state.sh press <testId>
```

### `set-input` / `type`

```bash
bash scripts/perps/agentic/app-state.sh set-input <testId> "text value"
```

### `scroll`

```bash
bash scripts/perps/agentic/app-state.sh scroll --test-id <testId> --offset 600
bash scripts/perps/agentic/app-state.sh scroll --offset 600
```

### `wait-for`

Prefer recipe `wait_for` nodes for repeated polling. For a one-off check, poll a route or expression with `app-state.sh route` or `app-state.sh eval` in the shell and fail loudly on timeout.

### `go-back`

```bash
bash scripts/perps/agentic/app-state.sh can-go-back
bash scripts/perps/agentic/app-state.sh go-back
```

### guarded `raw-eval`

```bash
bash scripts/perps/agentic/app-state.sh eval 'JSON.stringify({route: globalThis.__AGENTIC__.getRoute().name})'
bash scripts/perps/agentic/app-state.sh eval-async '(async function(){ return JSON.stringify(await someDebugCall()); })()'
```

Use raw eval for inspection or debug-only setup, not to fabricate a passing assertion.

## Path Caveat

The primitives currently live under `scripts/perps/agentic/`. A follow-up should graduate them to `scripts/agentic/`; update this skill when that lands.

## Compose-Up Note

If you are authoring a per-PR verification recipe, use `/recipe-cook` and let it call these primitives. Do not hand-write large recipe graphs inside this skill.
