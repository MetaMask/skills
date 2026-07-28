---
repo: metamask-mobile
parent: mobile-visual-testing
metadata:
  location: test/llm-workflow/
  type: mobile-testing
---

# MetaMask Mobile Visual Testing — iOS

Use this skill to visually validate MetaMask Mobile through the project-local `mm` CLI.

## Architecture

The `mm` CLI and a persistent local HTTP daemon come from `@metamask/client-mcp-core`. The device backend is `@metamask/device-mcp`, which drives the iOS Simulator through **`idb`** (`idb-companion` + `fb-idb`). Accessibility trees, taps, typing, and screenshots all flow through idb — there is no XCUITest runner in this workflow.

For full architecture, component locations, and safety details, see the on-demand references below and the in-repo doc `tests/llm-workflow/README.md`.

## Scope

- iOS Simulator only; Android is unsupported.
- The workflow is prod-only and preserves installed app/wallet state by default.
- Launch reuses an installed MetaMask app on the target simulator.
- The workflow does not build the app, discover local build outputs, or initialize test state.

## Prerequisites

```bash
# Verify the iOS toolchain (Xcode, idb, idb_companion, booted simulator)
yarn mm:doctor

# Install idb if MM_IOS_DEPENDENCY_MISSING is reported
brew tap facebook/fb && brew install idb-companion && pip3 install fb-idb

# Build/install MetaMask separately if it is not already installed
yarn setup && yarn start:ios

# Boot a simulator when needed
xcrun simctl boot <UDID>
```

Run `yarn mm:doctor` before launching; it prints a PASS/FAIL report with install commands for anything missing and exits non-zero when a prerequisite is absent. If an app is not installed, install it separately on the simulator before launching.

## Required Workflow

### 1. Launch

```bash
# Reuse the installed app and its current state
yarn mm launch

# Pin a simulator if needed
yarn mm launch --device-id <UDID>
```

There is only one supported environment: prod. Do not request or switch launch contexts. Supplying `--context e2e` is rejected.

### 2. Reuse Knowledge

```bash
yarn mm knowledge-search "<flow name>"
yarn mm knowledge-sessions
```

Reuse a known successful sequence when available. Otherwise discover the flow and let the session record it.

### 3. Observe Before Acting

```bash
yarn mm describe-screen
```

Use fresh output after navigation. Accessibility refs (`e1`, `e2`, ...) are ephemeral.

### 4. Interact

Only two targeting methods work on iOS: **test IDs** and **accessibility refs**. Use one per command; prefer a stable test ID, fall back to a fresh a11y ref from `describe-screen`.

```bash
yarn mm click --testid unlock-submit
yarn mm type --testid unlock-password "<password supplied for this wallet>"
yarn mm wait-for --testid account-overview --timeout 15000
yarn mm get-text --testid balance-display

yarn mm click e5
yarn mm type e2 "text"
```

`--selector` (CSS) and `--within` (scoped search) are **rejected by the iOS driver** even though the shared CLI accepts the flags — see Gotchas. To disambiguate duplicate targets, use a unique test ID or the exact element's fresh a11y ref.

The CLI flag is `--testid` (all lowercase); `--testId` is silently mis-parsed as a positional target and hits the wrong element. `mm type` clears the field before typing (idb does `cmd+a` → delete → type).

### 5. Verify and Capture Evidence

After a mutating sequence:

1. Run `yarn mm describe-screen`.
2. Confirm the expected state.
3. Capture meaningful before/after evidence:

```bash
yarn mm screenshot --name "after-action"
```

If the state is wrong, capture a debug screenshot, search knowledge, and retry from fresh refs.

### 6. Cleanup

```bash
yarn mm cleanup
yarn mm cleanup --shutdown
```

Always clean up when testing is complete.

## Metro and Runtime Inspection

For JS development, attach the installed development app to Metro:

```bash
yarn watch:clean
MM_METRO_PORT=8081 yarn mm launch
```

Node 20 may require `NODE_OPTIONS="--experimental-websocket"` for `mm cdp`; Node 22+ includes WebSocket support.

`mm cdp` evaluates JavaScript in the Hermes runtime through Metro's inspector proxy:

```bash
yarn mm cdp Runtime.evaluate '{"expression":"JSON.stringify(globalThis.__DEV__)"}'
```

Prefer controller methods over raw Redux mutation when inspecting or changing runtime state. Runtime modifications affect the current installed app state; restore any state changed during testing.

## Batching

Use `run-steps` only for known deterministic sequences:

```bash
yarn mm run-steps '{"steps":[
  {"tool":"type","args":{"testId":"login-password-input","text":"<password>"}},
  {"tool":"click","args":{"testId":"log-in-button"}},
  {"tool":"wait_for","args":{"testId":"wallet-screen","timeoutMs":15000}}
]}'
```

The input must be an object containing `steps`, not a bare array.

## Mobile Limitations and Gotchas

- **Only `--testid` and a11y refs target elements.** `--selector` throws (`CSS selectors are not supported on mobile`) and `--within` throws (`Scoped element search (within) is not supported on mobile`) at the driver, even though the shared CLI parses both flags. Do not use them on iOS.
- **`--testid` is case-sensitive and lowercase.** `--testId` is not recognized as a flag; the value is treated as a positional target and silently hits the wrong element (usually timing out).
- **Element matching is fuzzy and case-insensitive.** idb matches on accessibility label/identifier by substring, so `--testid Confirm` can match `Confirm Transaction`. Prefer exact, unique test IDs to avoid hitting the wrong element.
- **`mm type` clears first.** idb runs `cmd+a` → delete → type, so there is no need to clear the field manually. There is no trailing-newline submit trick; to submit, tap the on-screen keyboard action button (a fresh a11y ref) or the form's submit control.
- No `mm build`; build/install separately.
- No URL navigation, tab switching, browser notification pages, or browser clipboard APIs.
- `navigate-home` and `navigate-settings` are not implemented; navigate through visible UI elements.
- `mm cdp` requires Metro.
- One Metro process per worktree is recommended.
- Mutating commands can return compact observations; request a full `describe-screen` whenever refs or state are uncertain.
- Never assume wallet credentials, balances, networks, or onboarding state. Inspect the installed app and obtain needed credentials from the user/environment.

## Error Recovery

- `MM_IOS_DEPENDENCY_MISSING`: `idb` is not installed. Run `yarn mm:doctor`, then `brew tap facebook/fb && brew install idb-companion && pip3 install fb-idb`.
- `MM_WAIT_TIMEOUT`: target did not become visible; describe the screen and verify scope/test ID.
- `MM_CLICK_TIMEOUT`: click may have completed; describe before retrying.
- `MM_TYPE_TIMEOUT`: field interaction stalled; inspect focus and use a fresh target.
- `MM_IOS_RUNNER_NOT_READY`: verify simulator and that MetaMask is installed.
- `MM_IOS_APP_IDENTITY_MISMATCH`: this is an internal safety check; reuse the existing installed app or install a matching app outside the mm workflow.

For the full error-code table and troubleshooting, see [references/error-recovery.md](references/error-recovery.md).

## Reference Guides

Load these on demand — not required for standard visual testing:

- **[references/cli-reference.md](references/cli-reference.md)** — full command tables, syntax rules, targeting details, and commands not available on mobile.
- **[references/error-recovery.md](references/error-recovery.md)** — error codes, common failures, and troubleshooting.
- **[references/state-manipulation.md](references/state-manipulation.md)** — read/write runtime state and call controller methods via `mm cdp` (Hermes runtime).
- **[references/runtime-monitoring.md](references/runtime-monitoring.md)** — capture network requests and console logs via Hermes runtime interceptors. Load when testing flows that involve API calls or debugging silent failures.

## References and Attribution

- **In-repo workflow doc:** `tests/llm-workflow/README.md` — daemon/session architecture, installed-app safety, and the canonical prerequisites (`idb`, `yarn mm:doctor`).
- **Upstream packages:** `@metamask/client-mcp-core` (CLI + daemon) and `@metamask/device-mcp` (idb-based iOS device backend).
