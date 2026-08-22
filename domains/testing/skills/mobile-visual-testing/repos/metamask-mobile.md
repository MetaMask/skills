---
repo: metamask-mobile
parent: mobile-visual-testing
metadata:
  location: test/llm-workflow/
  type: mobile-testing
---

# MetaMask Mobile Visual Testing — iOS and Android

Use this skill to visually inspect and interact with an already-installed MetaMask Mobile app through the project-local `mm` CLI. This entrypoint is a self-sufficient runbook for the normal workflow; load a reference for exhaustive syntax, error inventories, or advanced runtime work.

## Architecture

The `mm` CLI and a persistent local HTTP daemon come from `@metamask/client-mcp-core`. The device backend is `@metamask/device-mcp`, which provides native device interaction:

- **iOS**: drives the iOS Simulator through `idb` (`idb-companion` + `fb-idb`) — no XCUITest runner.
- **Android**: drives an already-running emulator through ADB and UIAutomator — no Appium.

Accessibility discovery, taps, typing, and screenshots all flow through native debug channels. For implementation architecture, daemon/session internals, and current validation evidence, see the in-repo doc `tests/llm-workflow/README.md`.

## Scope and State Safety

The CLI context is always `prod`. `--context e2e`, fixtures, seeding, and environment switching are rejected. "Prod context" does not require the installed binary to be a release build — Metro/Hermes inspection needs a compatible development build.

- Simulator/emulator only; physical devices are unsupported.
- Launch does not build MetaMask, discover build outputs, initialize wallet state, or guarantee a particular screen.
- Treat the installed wallet as unknown persistent state. Never assume passwords, accounts, networks, balances, or credentials — obtain them from the user or an approved environment.

Platform deltas:

- **iOS**: reuses the installed app by default, but may accept an explicit `.app` bundle via `--app-bundle`. `--reinstall`, `--reset-app-data`, and `--allow-fox-code-mismatch` are destructive and guarded; `--reinstall` and `--reset-app-data` require `--app-bundle`.
- **Android**: always reuses the installed `io.metamask`. APK install/reinstall/reset options, `--app-bundle`, `--allow-fox-code-mismatch`, and `--extension-path` are rejected (there is no APK lifecycle). During a session, the emulator's animation scales are set to zero and restored on cleanup. Cleanup force-stops `io.metamask` but never stops, wipes, or deletes the emulator.

## Prerequisites

### iOS

```bash
brew tap facebook/fb && brew install idb-companion && pip3 install fb-idb
yarn mm:doctor
```

`yarn mm:doctor` is iOS-only. It prints a PASS/FAIL report for Xcode tools, `idb`, `idb_companion`, and a booted simulator, with install commands for anything missing, and exits non-zero when a prerequisite is absent. Run it before launching. MetaMask must already be installed on the target simulator (or supply `--app-bundle`).

```bash
xcrun simctl list devices
xcrun simctl boot <UDID>
```

### Android

```bash
adb version
adb devices -l
```

- `adb` (Android SDK Platform-Tools) must be on `PATH`.
- The target must be an online, authorized, fully booted `emulator-*`. Without `--device-id`, exactly one eligible emulator must exist.
- Exactly `io.metamask` must be installed for the emulator's current user, with `io.metamask/io.metamask.MainActivity` launchable.
- No `.device-session` override may exist in the current directory or worktree root (it selects Appium and is incompatible with the ADB backend).
- Build/install the app externally if needed; do not run `yarn start:android` as part of an active `mm` testing workflow.

## Required Workflow

### 1. Launch and select the platform

```bash
# iOS is the default
yarn mm launch
yarn mm launch --platform ios --device-id <UDID>

# Android must be explicit
yarn mm launch --platform android
yarn mm launch --platform android --device-id emulator-5554

# iOS: install a specific build before launching
yarn mm launch --app-bundle ios/build/MetaMask.app
```

- Omitted `--platform`, `--platform browser` (compatibility alias), and `--platform ios` all route to iOS. Only `--platform android` routes to Android.
- Use `--device-id`, never the stale `--device`.
- An active session produces `MM_SESSION_ALREADY_RUNNING`. Prefer `yarn mm cleanup` before relaunching; use `--force` only when replacing the session is intentional (it cleans up first, then launches).
- Metro attachment is **attach-only** — `mm` never spawns Metro. See [Metro and Runtime Inspection](#metro-and-runtime-inspection).

### 2. Reuse prior knowledge

```bash
yarn mm knowledge-search "<flow name>"
yarn mm knowledge-sessions
```

Reuse a known-good sequence when one exists; otherwise discover the flow and let the session record it.

### 3. Observe before acting

```bash
yarn mm describe-screen
```

Accessibility references (`e1`, `e2`, ...) are ephemeral. Refresh them after navigation, reloads, overlays, or major UI changes.

### 4. Interact

```bash
yarn mm click --testid unlock-submit
yarn mm type --testid unlock-password "<approved password>"
yarn mm wait-for --testid account-overview --timeout 15000
yarn mm get-text --testid balance-display

yarn mm click e5
yarn mm type e2 "text"
```

- `--testid` is **lowercase**. `--testId` is silently mis-parsed as a positional target and hits the wrong element.
- Positional a11y refs and `--testid` are the only targeting methods. `--selector` (CSS) and `--within` (scoped search) are parsed by the shared CLI but rejected by both mobile drivers.
- Matching is fuzzy and case-insensitive (iOS matches accessibility label/identifier; Android matches resource ID, content-description, or text — all by substring). Prefer exact, unique test IDs to disambiguate; there is no `--within` fallback on mobile.
- `mm type` clears the field first (iOS uses `cmd+a` → delete → type). To submit, tap the on-screen keyboard action or the form's submit control — there is no trailing-newline trick.

### 5. Verify and capture evidence

```bash
yarn mm describe-screen
yarn mm screenshot --name "after-action"
```

Verify the resulting state after any consequential action rather than trusting a successful click response. If the state is wrong, capture a debug screenshot, search knowledge, and retry from fresh refs.

### 6. Restore and clean up

```bash
yarn mm cleanup
yarn mm cleanup --shutdown   # iOS simulator shutdown option only
```

- Restore any temporary runtime/controller changes and uninstall monitoring hooks before cleanup.
- `--shutdown` is an iOS Simulator option. Use plain `yarn mm cleanup` for Android; it does not stop or wipe the emulator.

## Metro and Runtime Inspection

Metro attachment is available for development builds. The workflow is **attach-only** — start Metro separately, then launch with the port:

```bash
yarn watch:clean

yarn mm launch --platform ios --metro-port 8081
yarn mm launch --platform android --metro-port 8081

# Environment-variable form (the --metro-port flag wins when both are set)
MM_METRO_PORT=8081 yarn mm launch --platform android
```

- `mm` attaches to Metro; it never starts it. If Metro is unreachable on the given port, launch fails with `MM_INVALID_CONFIG`.
- Hermes/CDP requires a compatible development build; release/prod builds expose no Hermes inspector target.
- Node 20 requires `NODE_OPTIONS="--experimental-websocket"` for `mm cdp`; Node 22+ supports WebSockets natively.
- Use one Metro process and one selected simulator/emulator per worktree to avoid target ambiguity.
- Android reverse port mappings are session-owned and conflict-checked: the workflow verifies Metro `/status` (`packager-status:running`), reuses an identical mapping, fails on a conflicting one, and removes only its own mapping on cleanup. Never manually overwrite mappings or use `reverse --remove-all`.

```bash
yarn mm cdp Runtime.evaluate '{"expression":"JSON.stringify(globalThis.__DEV__)"}'
```

Prefer real controller methods over raw Redux mutation. Capture the original state, verify the mutation, and restore it before cleanup. Load `references/state-manipulation.md` for full CDP procedures.

## Batching

Use `run-steps` only for deterministic sequences after targets and transitions are understood. The argument must be a JSON object containing a `steps` array, not a bare array:

```bash
yarn mm run-steps '{"steps":[
  {"tool":"click","args":{"a11yRef":"e3"}},
  {"tool":"wait_for","args":{"testId":"home-screen","timeoutMs":10000}}
],"stopOnError":true}'
```

Use individual commands while exploring or debugging.

## Critical Mobile Limitations and Gotchas

- **Targeting**: fresh a11y refs or lowercase `--testid` only. Matching is fuzzy/case-insensitive; no CSS `--selector` or scoped `--within` on mobile.
- **Behavior**: `mm type` clears first; mutating commands may return compact observations — run `describe-screen` whenever a full fresh tree is needed.
- **Unavailable**: no `mm build`; no browser URL navigation, tab switching, notification pages, or clipboard APIs; `navigate-home`/`navigate-settings` are not implemented (navigate through visible UI); no E2E state initialization, fixtures, or contract seeding.
- **state**: never assume or persist balances, networks, or onboarding state.
- **credentials**: Try the e2e tests default password, and only ask the user if that one does not work: "correct horse battery staple"

See `references/cli-reference.md` for the full unsupported-command matrix.

## Error Recovery

First-response routing — load `references/error-recovery.md` for the complete inventory and detailed remediation.

| Failure class | First response |
| --- | --- |
| Stale target or interaction timeout (`MM_TARGET_NOT_FOUND`, `MM_WAIT_TIMEOUT`, `MM_CLICK_TIMEOUT`, `MM_TYPE_TIMEOUT`) | Run `describe-screen`, inspect blockers, retry with a fresh unique target; increase `--timeout` only if still transitioning |
| Existing/stale session (`MM_SESSION_ALREADY_RUNNING`, `MM_PORT_IN_USE`) | `yarn mm cleanup`; if daemon state is stale, `yarn mm stop --force` |
| iOS dependency/device/config (`MM_DEPENDENCIES_MISSING`, `MM_DEVICE_NOT_AVAILABLE`, `MM_INVALID_CONFIG`) | Run `yarn mm:doctor`; read the remediation text |
| Android readiness (`MM_ANDROID_DEPENDENCY_MISSING`, `MM_ANDROID_RUNNER_NOT_READY`, `MM_ANDROID_BACKEND_INTEGRITY`) | Run `adb devices -l`; verify package/activity; remove `.device-session` |
| Metro/Hermes failure (`MM_HERMES_NOT_AVAILABLE`, `MM_CDP_FAILED`) | Verify Metro `/status`, port, development build, target uniqueness, and `.mm-daemon.log` |
| Unknown launch failure (`MM_LAUNCH_FAILED`) | Capture the exact code/remediation, inspect `.mm-daemon.log`, then load `error-recovery.md` |

Launch errors use core `ErrorCode`s (not `MM_IOS_*`): `@metamask/client-mcp-core` collapses unknown consumer codes into `MM_LAUNCH_FAILED`, so iOS-specific detail is carried in the message and remediation.

## Reference Guides

Load on demand — not required for standard visual testing:

- **[references/cli-reference.md](references/cli-reference.md)** — full command tables, syntax rules, targeting details, batching schema, platform selection, and commands not available on mobile.
- **[references/error-recovery.md](references/error-recovery.md)** — complete error-code inventory and troubleshooting. Load after setup, launch, interaction, or daemon failures.
- **[references/state-manipulation.md](references/state-manipulation.md)** — advanced Metro-attached runtime state inspection and mutation via `mm cdp` (Hermes runtime).
- **[references/runtime-monitoring.md](references/runtime-monitoring.md)** — network/console capture and anomaly detection. Review and redact captured data before sharing or persisting it.

## References and Attribution

- **In-repo workflow doc**: `tests/llm-workflow/README.md` — daemon/session architecture, installed-app safety, canonical prerequisites, and current validation evidence.
- **Upstream packages**: `@metamask/client-mcp-core` (CLI + daemon) and `@metamask/device-mcp` (idb-based iOS and ADB/UIAutomator Android device backends).
