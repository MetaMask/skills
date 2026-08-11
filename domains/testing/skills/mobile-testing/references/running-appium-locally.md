# Running Appium smoke locally (agent playbook)

> **Audience:** agents validating Appium / Mobile E2E changes in `metamask-mobile`.
> **Source of truth:** `docs/testing/appium-smoke-testing.md` in the mobile repo.
> Do **not** copy long command recipes into skills — open that doc when details change.

This file is the **agent execution order** only: which build, which env overrides,
and what to check before claiming green. For artifact names, full `gh` download
steps, WDA prep, Android ABI / arm64 scheduled APK, session reuse, API-specs
exclusion, and troubleshooting tables, read the mobile doc.

## Hard rules

1. Use a **main-e2e release** binary (`HAS_TEST_OVERRIDES=true`) — never Detox
   debug / Expo Connect-to-Metro builds for Appium.
2. Prefer **iOS** Appium smoke on Mac (Apple Silicon). CI Android main-e2e APKs
   are x86_64; arm64 emulators need a local arm64 build or the scheduled
   `main-e2e-arm64-release.apk` artifact (see mobile doc).
3. Always set `IOS_APP_PATH` / `ANDROID_APK_PATH` when using CI artifacts so
   `.e2e.env` `PREBUILT_*` debug paths do not win.
4. Boot simulator → `scripts/e2e/prepare-ios-appium-runner.mjs` → run with
   `IOS_SIMULATOR_UDID` (exact commands in the mobile doc).
5. Run the **specific spec or tag** for the change — not the whole suite by
   default.
6. Do **not** start a local native main-e2e compile silently (~20–30+ min) —
   warn the user first. Prefer `gh run download` of CI artifacts.
7. Do not claim tests passed without command output.

## Agent execution order

1. Ensure `.e2e.env` exists (`cp .e2e.env.example .e2e.env` if needed) and deps
   are installed.
2. Resolve build: open `docs/testing/appium-smoke-testing.md` → **Required
   build** / **Download CI build**. Typical iOS path after download:
   `build/ci-main-e2e/MetaMask.app` (artifact `main-e2e-MetaMask.app`).
3. Prepare iOS runner and capture `IOS_SIMULATOR_UDID` (mobile doc → **Running
   locally → iOS**).
4. Lint / tsc touched files, then run:

   ```bash
   IOS_APP_PATH=build/ci-main-e2e/MetaMask.app \
   IOS_SIMULATOR_UDID="$IOS_SIMULATOR_UDID" \
   yarn appium-smoke:ios --grep <tag-or-title> \
     tests/smoke-appium/<feature>/<spec>.spec.ts
   ```

5. Read HTML/JUnit under `test-reports/appium-smoke-*` on failure.
6. Iterate: change → lint/tsc → targeted Appium run → fix.

Writing / migrating specs: [`appium-e2e.md`](appium-e2e.md). Remaining Detox
local runs only: [`detox/running-tests.md`](detox/running-tests.md) via
[`detox-to-appium.md`](detox-to-appium.md).

## Checklist before claiming green

- [ ] main-e2e release build (CI artifact or intentional local e2e build) — not debug
- [ ] `IOS_APP_PATH` (and `IOS_SIMULATOR_UDID`) set for iOS Appium
- [ ] Targeted `--grep` / spec path matching the PR change
- [ ] `yarn lint` / `yarn lint:tsc` clean on touched files
- [ ] Pass/fail taken from real command output
