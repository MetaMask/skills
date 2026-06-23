# Running E2E Tests Locally — MetaMask Mobile

> **Audience:** AI agents and engineers validating E2E changes in `metamask-mobile`.
> **Goal:** Run the same **main-e2e release** builds CI uses — not debug/Expo dev-launcher binaries.

## Test runners at a glance

| Runner | Spec location | Config | When to use |
| ------ | ------------- | ------ | ----------- |
| **Appium smoke** (Playwright) | `tests/smoke-appium/` | `tests/playwright.smoke-appium.config.ts` | Appium framework/POM changes, smoke parity with CI Appium jobs |
| **Detox smoke** | `tests/smoke/` | `.detoxrc.js` | Detox-only smoke specs, legacy local workflow |
| **Detox regression** | `tests/regression/` | `.detoxrc.js` | Full regression suites |

**Prefer iOS Appium smoke locally** when validating Appium-related PRs: no physical device, matches CI Appium smoke, and the main-e2e iOS `.app` runs on Apple Silicon simulators.

For writing new Detox specs, see the `e2e-test` skill (`references/running-tests.md`).

---

## Agent execution standard (Appium smoke on iOS)

Follow these steps **in order**. Do not skip the build check.

### Step 0 — Prerequisites

```bash
# From metamask-mobile repo root
cp .e2e.env.example .e2e.env   # if missing; fill MM_TEST_ACCOUNT_SRP etc.
yarn install
```

Ensure Xcode simulators are available (`xcrun simctl list devices`).

### Step 1 — Resolve the correct build

Appium smoke requires a **main-e2e release** build with `HAS_TEST_OVERRIDES=true` baked in at compile time. That activates `ReadOnlyNetworkStore` and fixture loading from `/state.json`.

| Build | Artifact name (CI) | Local path (after download) | Appium smoke? |
| ----- | ------------------ | --------------------------- | ------------- |
| **main-e2e iOS** (use this) | `main-e2e-MetaMask.app` | `build/ci-main-e2e/MetaMask.app` | ✅ Yes |
| **main-e2e Android** | `main-e2e-release.apk` | `build/ci-main-e2e/app-prod-release.apk` | ✅ Yes (see ABI note below) |
| Detox debug iOS | `Debug-iphonesimulator/MetaMask.app` | local Xcode output | ❌ Wrong runner/config |
| Detox debug Android (`yarn test:e2e:android:debug:build`) | `app-prod-debug.apk` | Expo **Development Build** — stops on Connect-to-Metro | ❌ No |
| `main-e2e-release-androidTest.apk` | instrumentation APK | Detox only | ❌ No |

**Do not** use `yarn test:e2e:ios:debug:build` or `yarn test:e2e:android:debug:build` for Appium smoke.

### Step 2 — Download CI build (preferred over local compile)

Download from a successful **`build` workflow** on `main` (or the PR branch if it produced artifacts). Use `gh`:

```bash
mkdir -p build/ci-main-e2e

# Find a recent successful build run on the target branch
gh run list --repo MetaMask/metamask-mobile --workflow build --branch main --limit 5

# Download iOS main-e2e app (replace RUN_ID)
gh run download RUN_ID --repo MetaMask/metamask-mobile \
  -n main-e2e-MetaMask.app -D build/ci-main-e2e

# Optional: Android release APK (same run)
gh run download RUN_ID --repo MetaMask/metamask-mobile \
  -n main-e2e-release.apk -D build/ci-main-e2e
mv -f build/ci-main-e2e/main-e2e-release.apk build/ci-main-e2e/app-prod-release.apk
```

**iOS artifact layout:** `gh run download` may extract loose files instead of a `.app` bundle. Reassemble if needed:

```bash
mkdir -p build/ci-main-e2e/MetaMask.app
# Move Info.plist, MetaMask binary, Frameworks/, etc. into MetaMask.app/
chmod +x build/ci-main-e2e/MetaMask.app/MetaMask
```

**Restore execute permissions** (CI does this automatically):

```bash
chmod +x build/ci-main-e2e/MetaMask.app/MetaMask
find build/ci-main-e2e/MetaMask.app/Frameworks -type f \( -name '*.dylib' -o -path '*.framework/*' \) -exec chmod +x {} \; 2>/dev/null || true
```

Verify before running:

```bash
test -x build/ci-main-e2e/MetaMask.app/MetaMask && echo "✅ iOS build ready" || echo "❌ iOS build missing or not executable"
```

### Step 3 — Override `.e2e.env` prebuilt paths

`tests/playwright.smoke-appium.config.ts` resolves the app path in this order:

1. `IOS_APP_PATH` / `ANDROID_APK_PATH` (explicit — **agents should set these**)
2. `PREBUILT_IOS_APP_PATH` / `PREBUILT_ANDROID_APK_PATH` from `.e2e.env`
3. Default: `build/ci-main-e2e/MetaMask.app` / `build/ci-main-e2e/app-prod-release.apk`

`.e2e.env` often points `PREBUILT_*` at **debug** builds. Always pass `IOS_APP_PATH` when using CI artifacts so debug paths do not win.

### Step 4 — Boot simulator and prepare runner (iOS)

CI runs `node scripts/e2e/prepare-ios-appium-runner.mjs` before tests. Locally:

```bash
# Boot iPhone 16 Pro (or your chosen sim)
xcrun simctl boot "iPhone 16 Pro" 2>/dev/null || true
open -a Simulator

# Prepare WDA + install app (exports UDID to use below)
IOS_APP_PATH=build/ci-main-e2e/MetaMask.app \
IOS_SIMULATOR_NAME="iPhone 16 Pro" \
node scripts/e2e/prepare-ios-appium-runner.mjs

# Capture booted UDID
export IOS_SIMULATOR_UDID=$(xcrun simctl list devices booted -j | node -e "
  const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
  const booted=Object.values(d.devices).flat().find(x=>x.state==='Booted');
  console.log(booted?.udid||'');
")
echo "IOS_SIMULATOR_UDID=$IOS_SIMULATOR_UDID"
```

First run may take several minutes while WebDriverAgent builds.

### Step 5 — Run Appium smoke tests

```bash
# Full iOS smoke suite
IOS_APP_PATH=build/ci-main-e2e/MetaMask.app \
IOS_SIMULATOR_UDID="$IOS_SIMULATOR_UDID" \
yarn appium-smoke:ios

# Single spec
IOS_APP_PATH=build/ci-main-e2e/MetaMask.app \
IOS_SIMULATOR_UDID="$IOS_SIMULATOR_UDID" \
yarn appium-smoke:ios --grep "Secret Recovery Phrase Reveal" \
  tests/smoke-appium/accounts/reveal-secret-recovery-phrase.spec.ts

# Filter by smoke tag (matches describe title via tags.js)
IOS_APP_PATH=build/ci-main-e2e/MetaMask.app \
IOS_SIMULATOR_UDID="$IOS_SIMULATOR_UDID" \
yarn appium-smoke:ios --grep SmokePerps
```

Package scripts (from `package.json`):

```bash
yarn appium-smoke:ios      # --project ios-smoke
yarn appium-smoke:android  # --project android-smoke
```

### Step 6 — Lint before/after code changes

```bash
yarn lint tests/smoke-appium/<path> tests/page-objects/<path> --fix
yarn lint:tsc
```

### Step 7 — Iterate

```
Change code → lint/tsc → run targeted Appium spec → read HTML report → fix → repeat
```

Reports: `test-reports/appium-smoke-report/` (HTML), `test-reports/appium-smoke-junit.xml`.

---

## Android Appium smoke (local caveats)

```bash
IOS_APP_PATH=...  # not needed
ANDROID_APK_PATH=build/ci-main-e2e/app-prod-release.apk \
ANDROID_AVD_NAME=Pixel_5_Pro_API_34 \
yarn appium-smoke:android --grep SmokeAccounts
```

**ABI mismatch on Apple Silicon Macs:** CI Android main-e2e APKs are built for **x86_64** emulators. arm64-v8a local emulators fail with `INSTALL_FAILED_NO_MATCHING_ABIS`. Options:

1. **Use iOS** for local Appium validation (recommended on Mac).
2. Build locally: `BUILD_CONFIG_NAME=main-e2e HAS_TEST_OVERRIDES=true METAMASK_ENVIRONMENT=e2e yarn build:android:main:e2e` (produces arm64-compatible APK).
3. Use an x86_64 AVD only on Intel hosts or CI runners.

---

## Building main-e2e locally (when CI artifact unavailable)

Local compile is slower (~20–30+ min) but produces the correct build type:

```bash
# iOS simulator release e2e
HAS_TEST_OVERRIDES=true METAMASK_ENVIRONMENT=e2e \
  CONFIGURATION=Release yarn build:ios:main:e2e
# Output: ios/build/Build/Products/Release-iphonesimulator/MetaMask.app

# Android release e2e (arm64 on Mac)
BUILD_CONFIG_NAME=main-e2e HAS_TEST_OVERRIDES=true METAMASK_ENVIRONMENT=e2e \
  yarn build:android:main:e2e
# Output: android/app/build/outputs/apk/prod/release/app-prod-release.apk
```

Then set `IOS_APP_PATH` or `ANDROID_APK_PATH` to those paths.

**Warn the user** before starting a local native build — do not kick off long builds silently.

---

## Detox local runs (smoke / regression)

Detox uses **debug** simulator/emulator builds from `.detoxrc.js` / `.e2e.env` `PREBUILT_*` paths.

```bash
# Verify debug build exists
ls ios/build/Build/Products/Debug-iphonesimulator/MetaMask.app 2>/dev/null \
  || echo "Run: yarn test:e2e:ios:debug:build"

# Run one Detox spec (iOS)
IS_TEST='true' NODE_OPTIONS='--experimental-vm-modules' \
  detox test -c ios.sim.main \
  --testPathPattern="tests/smoke/perps/perps-position-stop-loss.spec.ts"
```

See `e2e-test` skill → `references/running-tests.md` for full Detox commands and debugging.

---

## Common failures

| Failure | Likely cause | Fix |
| ------- | ------------ | --- |
| Expo dev launcher / Connect to Metro | Debug APK used for Appium | Use `main-e2e-release.apk` or CI artifact |
| `INSTALL_FAILED_NO_MATCHING_ABIS` (Android) | CI x86_64 APK on arm64 emulator | Use iOS locally or build arm64 main-e2e |
| `IOS_APP_PATH does not exist` | Artifact not downloaded or wrong bundle layout | Re-download; ensure `MetaMask.app/` directory |
| WDA / `ECONNREFUSED 127.0.0.1:8100` | WDA not ready | Run `prepare-ios-appium-runner.mjs`; retry (framework has terminate retry) |
| Fixture/state not loading | Build without `HAS_TEST_OVERRIDES` | Use main-e2e release build only |
| Wrong app launched | `.e2e.env` `PREBUILT_*` overrides defaults | Set `IOS_APP_PATH` explicitly |

---

## Agent checklist (before claiming tests pass)

- [ ] Used **main-e2e** release build (CI download or local e2e build) — not debug
- [ ] Set `IOS_APP_PATH` (and `IOS_SIMULATOR_UDID` after boot) for iOS Appium runs
- [ ] Ran the **specific spec or tag** relevant to the PR change
- [ ] `yarn lint` / `yarn lint:tsc` clean on touched files
- [ ] Captured pass/fail from command output (do not assume green without running)
