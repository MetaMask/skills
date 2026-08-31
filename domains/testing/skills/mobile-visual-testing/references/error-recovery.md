# Error Recovery and Troubleshooting for Mobile (iOS and Android)

## Contents

- [On Failure](#on-failure)
- [Error Codes](#error-codes)
- [Common Failures and Solutions](#common-failures-and-solutions)
- [Safe App Resolution](#safe-app-resolution)
- [Daemon Issues](#daemon-issues)
- [Metro and Hermes Failures](#metro-and-hermes-failures)

## On Failure

If launch or the mobile toolchain is the problem (not an in-app screen issue), troubleshoot based on your platform.

### iOS

Run the environment doctor:

```bash
yarn mm:doctor
```

It is explicitly iOS-only. It prints a PASS/FAIL report for Xcode, `idb`, `idb_companion`, and a booted simulator, with install commands for anything missing. This is the fastest way to resolve `MM_DEPENDENCIES_MISSING` and `MM_DEVICE_NOT_AVAILABLE`.

### Android

1. Run `adb devices -l` to check your emulator status.
2. For automatic selection, confirm exactly one online authorized emulator exists. For explicit selection, confirm your targeted serial is online and authorized.
3. Ensure `io.metamask` is installed and the MainActivity is launchable.
4. Verify there is no `.device-session` override file in your current directory or worktree root.

For in-app failures on either platform:

1. Run `yarn mm describe-screen`.
2. Identify the current screen and visible blockers. If the screen is unknown, capture a screenshot.
3. Query prior successful runs:

   ```bash
   yarn mm knowledge-search "<flow name>"
   yarn mm knowledge-sessions
   yarn mm knowledge-last
   ```

4. Capture evidence with `yarn mm screenshot --name "debug"`.
5. Retry only after obtaining fresh accessibility references.

## Error Codes

### Interaction Errors

| Code | Meaning and recovery |
| --- | --- |
| `MM_TARGET_NOT_FOUND` | The element is not visible or the reference is stale. Run `yarn mm describe-screen` and target again. |
| `MM_WAIT_TIMEOUT` | The element did not appear before the deadline. Verify the screen and increase `--timeout` if the app is still transitioning. |
| `MM_CLICK_FAILED` | The element was found but could not be clicked. Check for overlays, alerts, or disabled state. |
| `MM_CLICK_TIMEOUT` | The click stalled and may have completed. Describe the screen before retrying. |
| `MM_TYPE_FAILED` | The target may not be editable. Verify the selected element and keyboard state. |
| `MM_TYPE_TIMEOUT` | Input stalled. Describe the screen, obtain a fresh target, and retry. |
| `MM_GETTEXT_FAILED` | The target detached or does not expose text. Re-describe and re-target. |
| `MM_GETTEXT_TIMEOUT` | Text retrieval exceeded the deadline. Retry with a fresh target or larger `--timeout`. |
| `MM_PAGE_CLOSED` | The target closed during the action. This can be expected for transitions. Inspect the current state. |
| `MM_BATCH_TIMEOUT` | `run-steps` exceeded `batchTimeoutMs`. Reduce the batch size or increase its deadline. |

### Session and Launch Errors

| Code | Meaning and recovery |
| --- | --- |
| `MM_SESSION_ALREADY_RUNNING` | A session or launch already exists. Run `yarn mm cleanup`, then launch again. |
| `MM_NO_ACTIVE_SESSION` | No app session exists. Run `yarn mm launch`. |
| `MM_LAUNCH_FAILED` | Launch failed. `@metamask/client-mcp-core` collapses unknown consumer codes into this; iOS-specific detail is carried in the message and remediation. Inspect the simulator/emulator, installed app, and `.mm-daemon.log`. |
| `MM_DEPENDENCIES_MISSING` | Xcode command-line tools or `idb` are missing. Run `yarn mm:doctor`, then `brew tap facebook/fb && brew install idb-companion && pip3 install fb-idb`. |
| `MM_DEVICE_NOT_AVAILABLE` | No simulator is booted, the given UDID does not exist, or `simctl` failed. Run `xcrun simctl list devices` and boot one; verify MetaMask is installed. |
| `MM_INVALID_CONFIG` | The launch options are unusable: no app and no `--app-bundle`, a destructive flag without `--app-bundle`, a `fox_code` mismatch, an unreachable Metro port, or an E2E-only option in this prod-only workflow. Read the remediation text and reuse the installed app or install a matching build. |
| `MM_ANDROID_DEPENDENCY_MISSING` | `adb` is not on your `PATH`. Install Android SDK Platform-Tools and verify with `adb version`. |
| `MM_ANDROID_RUNNER_NOT_READY` | Automatic selection requires exactly one online authorized emulator. Explicit selection requires the named serial to be online and authorized. Both require a completed boot, the installed package, and launcher activity. |
| `MM_ANDROID_BACKEND_INTEGRITY` | ADB backend could not be created because of conflicts. Remove `.device-session` from the current directory or worktree root and retry. |
| `MM_PORT_IN_USE` | The daemon port is already bound by stale state. Run `yarn mm stop --force`, then launch again. |
| `MM_INVALID_INPUT` | A command or flag value is malformed. Correct it before retrying. |

### Discovery and Capture Errors

| Code | Meaning and recovery |
| --- | --- |
| `MM_DISCOVERY_FAILED` | A `describe-screen` or accessibility snapshot failed. Wait for transitions to settle, capture a screenshot, and verify the app has not crashed, then retry. |
| `MM_SCREENSHOT_FAILED` | The screen capture failed. Verify the simulator or emulator is booted and the session is active. |

### Hermes and Platform Errors

`cdp` and `hermes-targets` run against the Hermes runtime through Metro. The mobile workflow surfaces a small set of codes here. Do not expect granular per-phase Hermes codes.

| Code | Meaning and recovery |
| --- | --- |
| `MM_HERMES_NOT_AVAILABLE` | `hermes-targets` was run on a session with no mobile driver, or Metro is not attached. Launch with `MM_METRO_PORT` set and retry. |
| `MM_HERMES_FAILED` | Hermes target discovery failed. Verify Metro is running, the app is a development build, and one simulator or emulator and one Metro process per worktree. |
| `MM_CDP_BLOCKED` | The requested `cdp` method is blocked as destructive. Use a safe inspection method instead. |
| `MM_CDP_FAILED` | `cdp` execution failed or timed out. On Node 20 confirm `--experimental-websocket` was set at launch; inspect Metro and `.mm-daemon.log`. |
| `MM_TOOL_NOT_SUPPORTED_ON_PLATFORM` | The command is browser-only (or a mobile-only command was run without a mobile session). Use visible mobile UI interactions instead. |

## Common Failures and Solutions

| Symptom | Likely cause | Safe solution |
| --- | --- | --- |
| Previous session blocks launch | Session was not cleaned up | Run `yarn mm cleanup`, then `yarn mm launch` |
| No active session | The app has not been launched through the daemon | Run `yarn mm launch` with correct platform flag |
| Launch cannot locate MetaMask on iOS | MetaMask is not installed on the selected simulator | Install the intended app build on that simulator, then launch again |
| Launch cannot locate MetaMask on Android | `io.metamask` is not installed on the emulator | Build and install the app on that emulator externally using `yarn setup` and `yarn start:android`. Do not use installation commands inside the `mm` workflow. |
| Simulator is unavailable | No booted simulator or incorrect UDID | Check `xcrun simctl list devices`, boot the device, and use `--device-id <UDID>` |
| Android emulator is offline or unauthorized | Emulator is stuck or needs confirmation | Run `adb devices -l` to check authorization. Confirm authorization on-screen, restart the emulator externally to restore the online device state, or select a different online authorized emulator. |
| Android emulator is missing or multiple exist | Zero or multiple emulators are running | For automatic selection, keep exactly one eligible emulator online and authorized. Otherwise, explicitly target an eligible serial via `--device-id <serial>`. |
| App identity mismatch on iOS | Installed and expected builds have different `fox_code` values | Reuse the existing installed app or install a matching build outside the `mm` workflow |
| `idb` not installed on iOS | Missing iOS Debug Bridge dependency (`MM_DEPENDENCIES_MISSING`) | Run `yarn mm:doctor`, then install via Homebrew and pip3 |
| Empty or failed screen snapshot | Splash screen, animation, app transition, or crash | Wait briefly, describe again, and capture a screenshot |
| Stale accessibility references | Screen changed after the references were generated | Run `yarn mm describe-screen` and use fresh references |
| Interaction timeout | Animation, overlay, or stale/ambiguous target | Re-`describe-screen`, target by a unique test ID or fresh accessibility ref. Do not use `--within` or `--selector` on mobile. Increase `--timeout` only when appropriate |
| `--testId` times out | Incorrect capitalization | Use `--testid` in lowercase |
| Daemon address already in use | Stale daemon state (`MM_PORT_IN_USE`) | Run `yarn mm stop --force`, then `yarn mm launch` |
| After code changes, daemon is stale | Code/skill updates require a clean state | Run `yarn mm stop --force`, then relaunch without wiping state |

## Safe App Resolution

The mobile workflow preserves the installed app and its wallet state by default. Android has no APK lifecycle.

1. Prefer launching the already-installed app.
2. If replacing it, build and install a matching app outside of the `mm` workflow (such as through standard repository setup scripts). Do not recommend `yarn start:android` as part of the `mm` workflow; it should only be run externally when setting up the environment.

## Daemon Issues

If the CLI hangs or returns connection errors:

1. Check status: `yarn mm status`.
2. Stop stale state: `yarn mm stop --force`.
3. Inspect `.mm-daemon.log`.
4. Restart with `yarn mm launch` (with platform flag if needed).

The daemon shuts down after 30 minutes of inactivity. Its state is stored in `.mm-server` at the project root, isolated per worktree.

## Metro and Hermes Failures

If Metro attachment or Hermes inspection fails:

1. Start Metro with `yarn watch:clean`.
2. Verify its status endpoint, normally `http://localhost:8081/status`. The workflow verifies the exact Metro `/status` response (expecting the canonical body `packager-status:running`) before any ADB reverse mapping.
3. Ensure the port passed via `--metro-port` (or `MM_METRO_PORT`; the flag wins) matches the running Metro process.
4. Confirm the installed app is a compatible development build and belongs to the selected simulator or emulator.
5. Use one Metro process and one active simulator or emulator per worktree to avoid target ambiguity.
6. Inspect `.mm-daemon.log` for attachment and target-selection details.
7. Restart safely:

   ```bash
   yarn mm cleanup

   # iOS
   yarn mm launch --platform ios --metro-port 8081

   # Android
   yarn mm launch --platform android --metro-port 8081
   ```

On Node 20, launch the daemon with `NODE_OPTIONS="--experimental-websocket"` when Hermes WebSocket support is required. Node 22 and later provide WebSocket support directly.
