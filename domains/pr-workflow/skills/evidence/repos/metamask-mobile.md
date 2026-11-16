---
repo: metamask-mobile
parent: evidence
---

## MetaMask Mobile

On a `MetaMask/metamask-mobile` PR this section decides which lanes apply and how each one is captured. Where it and the extension-written text above disagree on a mechanism, this section wins. The Claim Card, the bar, the verdicts and the publication rules are unchanged.

Most lanes close without a device, as Jest probes of the real module at both arms. What does not carry over is anything that drives a running app: the AEP harness, Chrome DevTools and the browser runtime have no mobile equivalent off a device. Verify script names against the mobile `package.json` before running one; they drift.

### Setting up a run

1. **One worktree per arm, never the local checkout.** Mobile merges through the merge queue into single-parent squash commits on `main`. For a merged PR the head arm is the squash commit and the base arm is its first parent. For an open PR, non-negotiable 7 applies as written.
2. **Install at each arm's own commit.** Node from `.nvmrc`, Yarn from `packageManager`; `yarn install --immutable`, then `yarn setup:github-ci --node` (CI's setup: copies `.js.env` from the example and applies `patches/` with `patch-package`). Reusing another checkout's `node_modules` is valid only when the two `yarn.lock` files are identical. Against a different lock, simple tests still pass and an Engine probe fails on a stale package, so a reused install can produce a red that belongs to the install, not the PR. An install takes about 5 minutes and 4.4 GB; the first Jest run in a fresh tree is the slow one (empty transform cache), so run a lane's test files in one invocation.
3. **Pick the Jest config by layer.** A test run under the wrong config gets different mock rules and still exits green.

   | Layer | Files | Config | Mock rules |
   |---|---|---|---|
   | Unit | `app/**/*.test.ts(x)` | `jest.config.js` (`yarn test:unit` excludes the other two layers) | any |
   | Component-view | `*.view.test.tsx` | `jest.config.view.js` | only Engine and the native modules listed in `app/util/test/testSetupView.js` |
   | Integration | `*.integration.test.ts` | `jest.config.integration.js` | per `tests/integration/AGENTS.md` |

   Layer placement and test-writing guidance: `mobile-testing` → `references/{unit,component-view,integration,layers,appium-e2e}.md`. The `unit-testing`, `component-view-test`, `integration-test` and `e2e-test` mobile files only point there.
4. **Run both platform arms.** Component-view tests run iOS and Android through `describeForPlatforms` / `itForPlatforms` (`tests/component-view/platform.ts`) when `TEST_OS` is unset. CI's `test:view:ci` and `test:integration:ci` set `TEST_OS=ios`, so CI never runs the Android arm. Leave `TEST_OS` unset, and never cite CI as covering Android.
5. **Booting the real Engine in a probe.** The global Jest setup mocks Engine. A probe that calls the real `Engine.init` copies the mock preamble from `app/core/Engine/Engine.test.ts` (device info, netinfo, backup vault, store, settings selectors, remote feature flag controller), adds `jest.unmock('./Engine')`, and runs with `--forceExit`, since a real Engine leaves open handles and Jest does not exit. Two failures belong to the probe or the install, not the PR: `reading 'basicFunctionalityEnabled'` in `app/selectors/settings.ts` means the preamble is missing; an undefined `state` from `wallet.getInstance(...)` means the install does not match the commit. A probe of one controller package needs none of this: construct it with a `Messenger` and assert on its state.

### What a Jest verdict cannot see

Every verdict that rests on a Jest run (unit, component-view, integration, a probe, Reassure) states its runtime in one line, in the comment:

> Jest on Node V8, not Hermes; no lockdown; native modules stubbed (`app/__mocks__/`); build-time env flags read at runtime.

Each is a place where a Jest green differs from what ships:

| Limit | Where it comes from | A claim on the far side goes to |
|---|---|---|
| Node V8, not Hermes | `jest.config.js` `testEnvironment: 'jest-environment-node'` | H11 static half (`hermesc` compile); runtime on a device |
| No lockdown, so intrinsics are not frozen | the lockdown prelude is injected by Metro, which Jest does not use | H11, F8 |
| Native modules stubbed | modules resolve to `app/__mocks__/` | H6 static half; runtime on a device |
| Build-time env flags read at runtime | `babel.config.tests.js` drops `transform-inline-environment-variables`, which the app build inlines | H9 and D5: the Metro bundle built with the variant's env |

When the claim depends on a limit, the Jest result does not reach it: say which limit in the reviewer's terms and route to the lane in the right column.

### Lanes that need a device

A device is an iOS Simulator (a macOS host, driven by `idb`), an Android emulator (needs KVM), or a device farm. A lane, or a lane's device half, run without one ends **⚠️ inconclusive** and names itself: *"H4, device half (real suspension): not run, no device."* The Linux half's verdict stands for the claim it tested and never stands in for the device half. A device-only lane is not replaced by the nearest Linux mechanism; a component-view render proves a tree, not pixels.

### The catalog's 41 lanes on mobile

| Lane | On mobile | Without a device |
|---|---|---|
| A1 visual_validation | No AEP for mobile. Before/after screenshots come from the `mm` CLI (B1). A component-view render assertion proves the tree, not pixels | device only |
| A2 perf_validation | Component-view test with `nock` mocks counting requests (`tests/component-view/api-mocking/`), or an integration test; module inclusion via D2 | yes |
| A3 AEP byproducts | does not apply | — |
| B1 `mm` CLI visual | `@metamask/client-mcp-core` + `@metamask/device-mcp` on the iOS Simulator via `idb`: prod builds only, the installed app, no URL navigation, targets by `--testid` or accessibility ref (`yarn mm:doctor`, `tests/llm-workflow/`) | device only |
| B2 E2E trace + video | Appium through Playwright (`tests/smoke-appium/`, `tests/playwright.smoke-appium.config.ts`, `tests/playwright.system-emulator.config.ts`) | device only |
| B3 falsifying test | as written, at the layer `mobile-testing` assigns, with that layer's config | yes |
| B4 component visual | Storybook (`.rnstorybook/`) renders only in the app; on Linux a component-view test or a snapshot of the rendered tree | tree yes; pixels device |
| B5 accessibility | no axe on React Native; assert `accessibilityLabel` / `accessibilityRole` / `accessibilityState` in a component-view test; `mm describe-screen` returns the iOS tree | props yes; tree device |
| B6 flaky rerun | `yarn jest <path> --runInBand` N times, and `--randomize`; Appium retries on a device | Jest yes |
| B7 interleaving | as written; the mobile interleavings are AppState transitions (H4) and a deep link against unlock (H2) | yes |
| C1 startup / custom traces | spans come from `trace()` and `TraceName` (`app/util/trace.ts`) and reach Sentry; read the main-branch trend across the merge (E1 perf-PR promotion); a local reading needs a device with tracing on | trend yes; local device |
| C2 web vitals | does not apply (no `web-vitals`); nearest are screen-load traces (C1) and frame rate (C6) | — |
| C3 long task / TBT | does not apply (no long-task observer under Hermes); JS-thread stalls are a device frame-rate reading (C6) | — |
| C4 render & selector | `reselect` `.recomputations()` in Jest; render counts from Reassure (`*.perf-test.tsx`, `yarn test:reassure:baseline` / `:branch`) or a React Profiler probe. The React Compiler is enabled per directory (`babel.config.js` via `scripts/react-compiler`), so confirm the file under test is compiled in the probe | yes |
| C5 benchmark A/B | journey timings are Appium `TimerHelper` tests on devices (`tests/performance/`); render-time A/B is Reassure | Reassure yes; journeys device |
| C6 profiling | React Native DevTools or `mm cdp` through Metro's Hermes inspector, dev builds only; Instruments; Android Studio profiler | device only |
| C7 memory over a flow | Hermes heap snapshots via React Native DevTools; native memory via Instruments or the Android profiler | device only |
| C8 same-window capture | Simulator window beside the DevTools console, recorded as one region on macOS | device only |
| C9 retention path | as written; common mobile holders are `AppState.addEventListener` and messenger subscriptions | yes |
| D1 bundle size | JS: `yarn gen-bundle:ios` (Metro runs on Linux) against the `ci/ios-js-bundle-size` status at the merge base, as CI does. APK/IPA size needs a native build | JS yes; binary build host |
| D2 chunk membership | Metro emits one bundle, no chunks. The question is whether a module is in the bundle and whether it evaluates at startup: `inlineRequires` in `metro.config.js` defers evaluation, and a barrel import defeats it. Check with the source map | yes |
| D3 supply chain | no LavaMoat runtime policy. The surface is `lavamoat.allowScripts` in `package.json`, `@lavamoat/git-safe-dependencies`, `yarn npm audit`, `patches/` and `.yarn/patches/` (React Native itself is patched), and autolinked native dependencies (`ios/Podfile.lock`, Gradle) | yes |
| D4 permissions diff | `git diff` of Android permissions and intent filters (`android/app/src/main/AndroidManifest.xml`), iOS usage strings (`ios/MetaMask/Info.plist`, `MetaMask-Flask-Info.plist`), entitlements and associated domains (`ios/MetaMask/MetaMask.entitlements`) | yes |
| D5 build variants | variants in `builds.yml`; behavior gated by build-time env (`process.env.MM_*`, `METAMASK_BUILD_TYPE`). Linux half: the Metro bundle built with each variant's env. Native half: `./scripts/build.sh <ios\|android> <main\|flask> <env>` | bundle yes; native build host |
| D6 substitution A/B | as written (`yarn lint:tsc`, 12 GB heap). Two mobile targets: a Jest mock in `app/__mocks__/` against the real native or SDK API, and `route.params` against `app/core/NavigationService/types.ts` | yes |
| D7 build duration | Metro bundle time on Linux; Xcode and Gradle times on a native build host | Metro yes; native build host |
| E1 Sentry links | projects `metamask-mobile` (production traffic is `environment:production`) and `test-metamask-mobile`. Read the production `tracesSampleRate` in `app/util/sentry/utils.ts` and scale span counts by it; production samples a small fraction, dev and E2E builds sample everything | yes |
| E2 Tempo traces | does not apply: client spans are Sentry-only | — |
| E3 event shape | as written: a Jest probe of `beforeSend`, `beforeSendTransaction`, `beforeSendSpan` and `excludeEvents` in `app/util/sentry/` | yes |
| F1 state migration | redux-persist, not the extension migrator: run `app/store/migrations/NNN.test.ts`, old state in and new state out. The stored version is the count of migrations minus one (`app/store/migrations/index.ts`), so a skipped or duplicated number changes it. Rehydration is H3 | yes |
| F2 vault round-trip | JS round-trip of `app/core/Encryptor/` and `app/core/Vault.ts` in Jest, where native crypto is mocked; keychain and biometrics (`app/core/SecureKeychain.ts`) are H13 | JS yes; keychain device |
| F3 tx simulation | same core controllers; the confirmation UI (`app/components/Views/confirmations/`) asserted in component-view tests with API mocks | yes |
| F4 provider / dapp | three surfaces: the in-app browser WebView (`app/core/BackgroundBridge/`, `app/core/EntryScriptWeb3.js`), MetaMask Connect (`app/core/SDKConnect/`, `app/core/SDKConnectV2/`) and WalletConnect (`app/core/WalletConnect/`). RPC middleware runs in Jest; injection and cross-app connect need a device | middleware yes; connect device |
| F5 flag matrix | component-view fixture with `remoteFeatureFlags` set per state; production defaults in `tests/feature-flags/feature-flag-registry.ts`, checked against the live endpoint by `yarn feature-flags:sync:check`. The absent-flag and version-gate states are H8 | yes |
| F6 snaps | third-party snaps are flask- or test-only (`app/constants/snaps.ts`); middleware and bridge in Jest (`app/core/Snaps/`); execution needs the app | Jest yes; execution device |
| F7 i18n | no `verify-locales` equivalent: `locales/i18n.test.js` only checks keys against `supportedTranslations`. Resolve each `strings('…')` key in the diff against `locales/languages/en.json` | yes |
| F8 lockdown | `@lavamoat/react-native-lockdown`, injected by Metro's `lockdownSerializer` in every build, with polyfills ordered before `hardenIntrinsics()`; no scuttling or Snow. Static half: the lockdown prelude before module 0 in the Metro bundle. Runtime half: `mm cdp` `Runtime.evaluate` `Object.isFrozen(Object.prototype)` on a dev build | static yes; runtime device |
| G3 automated reviewer | as written | yes |
| G4 manual repro | as written (the mobile `pr-manual-testing` file uses Gherkin scenarios); executing the steps needs a device | writing yes; executing device |
| G5 test-fork run | mobile gating differs from the extension's: `get_requirements.outputs.skip_everything` gates jobs, and test-only PRs reuse `main`'s native builds by fingerprint. Confirm on the fork that the edited workflow actually ran before citing it | yes |
| G6 job duration | as written; build reuse is the falsifier (test-only PRs reuse `main`'s native builds) | yes |

**E2E selection is per PR.** CI picks E2E specs per PR (`smart-e2e-selection`), so "CI ran E2E" can mean a subset. The G1 mutation check names the spec that ran.

### Mobile-only lanes, H1–H13

Match every changed path against each lane's **Routes** line; a path that matches several lanes runs each. Four lanes apply a catalog rule that is not specific to mobile; for those, the rule is the catalog's and only the mobile mechanism is here.

#### H1. Navigation stack and params
- **Claim:** catalog B7, navigation and redirect changes: every navigator that can fire in the window, unchanged code included. Mobile adds that every `navigate` / `reset` / `replace` reaches a registered route with the params the destination's type expects.
- **Mechanism:** the mobile navigators are the deep-link handler, post-unlock resume, the onboarding gate, `ControllersGate`, a notification tap (H12) and the persisted last route. Drive each with component-view `renderScreenWithRoutes` (`tests/component-view/render.tsx`) and assert the landing route; D6 substitution of call-site params against `app/core/NavigationService/types.ts`.
- **Routes:** `app/components/Nav/**`, `app/constants/navigation/**`, `app/core/NavigationService/**`, `app/reducers/navigation/**`, `app/actions/navigation/**`; any diff adding `navigation.navigate` / `reset` or reading `route.params` / `useRoute(`.
- **Device:** no.

#### H2. Deep-link routing
- **Claim:** each URL form (custom scheme, universal or app link, Branch, Android intent) lands on the intended handler and screen when the app is cold, warm, locked and not onboarded.
- **Mechanism:** a Jest probe of the handlers with a URL table at both arms; component-view for the landing screen; a D4 diff of intent filters and associated domains. Deep link against unlock is a B7 interleaving.
- **Routes:** `app/core/DeeplinkManager/**`, `app/constants/deeplinks.ts`, `app/core/PostUnlockResume/**`, `app/core/AppStateEventListener.ts`, `app/core/Braze/BrazeDeeplinks.ts`, `react-native-branch` bumps, `android/app/src/main/AndroidManifest.xml`, `ios/MetaMask/MetaMask.entitlements`.
- **Device:** JS half no. OS dispatch (`adb shell am start -d`, `xcrun simctl openurl`) yes.

#### H3. Persisted-state rehydration and storage
- **Claim:** state stored by the previous release migrates and rehydrates to the new shape: session fields reset on read (`persistUserTransform` in `app/store/persistConfig/index.ts` resets `userLoggedIn`, so an upgrade cannot come up unlocked), per-controller files from `createPersistController` are neither lost nor stale, and the AsyncStorage-to-filesystem fallback holds.
- **Mechanism:** a Jest probe: a persisted fixture taken at the base arm, `migrate` at the head arm, then rehydrate through the transforms; assert version, shape and session fields. F1 covers the migration alone.
- **Routes:** `app/store/persistConfig/**`, `app/store/migrations/**`, `app/store/index.ts`, `app/core/EngineService/**`, `app/util/storage/**`, any new reducer key.
- **Device:** no.

#### H4. Background, foreground and lock
- **Claim:** catalog B7, test the opposite ordering. Mobile adds the sequences: iOS `active → inactive → background → active` and Android `active → background → active`, under which auto-lock, the privacy cover, websocket reconnect and a pending deep link resolve as intended. `AppLockService` treats iOS `inactive` differently from `background` (`app/core/AppLock/AppLockService.ts`).
- **Mechanism:** a Jest probe with a mocked AppState emitter and fake timers (the B7 engine), one sequence per platform, each in both orders.
- **Routes:** `app/core/AppLock/**`, `app/core/AppStateEventListener.ts`, `app/core/AppStateWebSocketManager.ts`, `app/core/PostUnlockResume/**`, `app/core/Authentication/**`, `ios/MetaMask/NativeModules/PrivacyCover/**`, `android/app/src/main/java/io/metamask/nativeModules/PrivacyCoverModule.kt`, any diff adding `AppState.addEventListener`.
- **Device:** JS half no. Real suspension (paused timers, a killed JS context) yes.

#### H5. iOS/Android split
- **Claim:** a change behind `Platform.OS`, `Platform.select`, `Device.isIos()` or a `.ios.` / `.android.` file behaves as intended on both platforms.
- **Mechanism:** component-view `describeForPlatforms` with `TEST_OS` unset (setup step 4).
- **Routes:** any diff adding or changing a platform branch; `*.ios.*` and `*.android.*` files; `app/util/device/**`.
- **Device:** JS half no. Keyboard, safe-area and gesture rendering yes.

#### H6. Native module contract
- **Claim:** JS calls to a native module match the exported method name, arity and return type on both platforms, and the Jest mock agrees with the native code.
- **Mechanism:** static: JS call sites (`app/core/NativeModules.ts`) against the `@ReactMethod` / `RCT_EXPORT_METHOD` exports; D6 substitution of the mock's type against the native signature; the patch diff.
- **Routes:** `android/app/src/main/java/io/metamask/nativeModules/**`, `ios/MetaMask/NativeModules/**`, `app/core/NativeModules.ts`, `app/__mocks__/**`, `patches/**`, `.yarn/patches/**`, `ios/Podfile.lock`, Gradle files, bumps of packages that ship native code.
- **Device:** static half no. Runtime yes.

#### H7. Engine init order
- **Claim:** each controller initializes after every controller it depends on (the order of `initFunctions` is the init order), its default state is in `app/util/test/initial-background-state.json`, its `stateChange` event is in `BACKGROUND_STATE_CHANGE_EVENT_NAMES` (`app/core/Engine/constants.ts`), and the UI waits for readiness.
- **Mechanism:** `yarn jest app/core/Engine/Engine.test.ts -t 'matches initial state fixture'`, plus a falsifier probe that moves the init ahead of its dependency or drops the event name and must fail. A probe that boots the real Engine follows setup step 5.
- **Routes:** `app/core/Engine/Engine.ts`, `app/core/Engine/controllers/**`, `app/core/Engine/messengers/**`, `app/core/Engine/types.ts`, `app/core/Engine/constants.ts`, `app/core/Engine/wallet-init/**`, `app/util/test/initial-background-state.json`, `app/components/Nav/ControllersGate/**`, `app/core/EngineService/**`.
- **Device:** no.

#### H8. Flag absent and version gate
- **Claim:** behavior when the remote flag is missing (the fetch failed, or Basic Functionality is off and the flag cannot be read) and on both sides of a `minimumVersion` gate.
- **Mechanism:** component-view fixtures for three states: the production value from `tests/feature-flags/feature-flag-registry.ts`, absent, and below the version gate. F5's on/off pair is the comparison.
- **Routes:** `app/selectors/featureFlagController/**`, `app/core/Engine/controllers/remote-feature-flag-controller/**`, `tests/feature-flags/feature-flag-registry.ts`, `app/multichain-*/remote-feature-flag.ts`, any diff adding `selectRemoteFeatureFlags`.
- **Device:** no.

#### H9. OTA and build-time flags
- **Claim:** a JS-only change shipped as an OTA update calls no native code missing from the installed runtime (the runtime version follows the native version, `ota.config.js`), and build-time env flags behave per variant.
- **Mechanism:** the Expo fingerprint at both arms (`yarn fingerprint:generate`, config `fingerprint.config.js`): an unchanged fingerprint alongside new native API use is the finding. Build flags: the Metro bundle built with each `builds.yml` variant's env, because Jest does not inline env.
- **Routes:** `ota.config.js`, `app/constants/ota.ts`, `fingerprint.config.js`, `app/components/hooks/useOTAUpdates.ts`, `app/components/UI/OTAUpdatesModal/**`, `builds.yml`, `app.config.js`, `babel.config.js`, files reading `process.env.METAMASK_BUILD_TYPE` or `MM_*`.
- **Device:** no.

#### H10. Sentry span volume
- **Claim:** catalog E1, *size a volume concern before reporting it*; a PR that adds span instrumentation also goes to `/sentry-quota`. Mobile adds that spans parent correctly.
- **Mechanism:** count `trace()` calls per user action in a Jest probe (`app/util/trace.ts`); take traffic from `metamask-mobile` in Sentry and scale it by the production sample rate (E1 row above), since a Sentry count is a sample. `beforeSendSpan` in `app/util/sentry/utils.ts` drops fetch spans without an active parent, so a span created outside a parent may never arrive.
- **Routes:** `app/util/trace.ts`, `app/util/sentry/**`, `app/core/Performance/**`, any diff adding `trace({`, `startSpan` or `startInactiveSpan`.
- **Device:** no.

#### H11. Hermes and hardened-intrinsics parity
- **Claim:** new code runs under Hermes with lockdown's frozen intrinsics, which no Jest run shows.
- **Mechanism:** static: the Metro bundle compiled with `hermesc` (the `hermes-compiler` package ships a Linux binary) for syntax and feature support; search the diff for writes to built-in prototypes and for polyfills loaded after `hardenIntrinsics()`.
- **Routes:** `polyfills/**`, `shim.js`, `index.js`, `metro.config.js`, `metro.transform.js`, `babel.config.js`, `patches/@lavamoat+react-native-lockdown*`, React Native or Hermes bumps.
- **Device:** static half no. Runtime yes.

#### H12. Push notification tap routing
- **Claim:** catalog D3, a package that registers its own listeners: trace who handles the event after the bump. Mobile adds the app states: a notification tapped while the app is killed, backgrounded or foregrounded opens its screen and fires its analytics event.
- **Mechanism:** a Jest probe of the handlers with payload fixtures per state. The packages that register their own handlers are `@react-native-firebase/messaging`, `@notifee/react-native` and `@braze/react-native-sdk`.
- **Routes:** `app/core/NotificationManager.js`, `app/core/NotificationsManager*`, `app/core/Braze/**`, `app/util/notifications/**`, `ios/MetaMask/NativeModules/BrazePush/**`, `BrazePushModule.kt` and `NotificationModule.kt` under `android/app/src/main/java/io/metamask/nativeModules/`, `firebase.json`, bumps of the three packages above.
- **Device:** JS half no. OS delivery yes.

#### H13. Device hardware and OS services
- **Claim:** biometric unlock, keychain storage, Ledger over BLE, the QR camera and screenshot prevention behave on real hardware.
- **Mechanism:** a device. Jest sees only the `app/__mocks__/` stubs, so a Jest result here is not evidence for the claim.
- **Routes:** `app/core/SecureKeychain.ts`, `app/core/Ledger/**`, `app/core/HardwareWallet/**`, `app/core/HardwareWallets/**`, `app/core/QrKeyring/**`, `app/core/PreventScreenshot.js`, `app/core/ScreenOrientation/**`.
- **Device:** yes. Without one the lane is ⚠️ inconclusive.

### Builds, flags and telemetry

- **Flask is a runtime gate, not a code fence.** Flask behavior is gated by `process.env.METAMASK_BUILD_TYPE`; there are no `ONLY_INCLUDE_IF` fences in `app/`. A claim about a build flag needs the Metro bundle built with that variant's env (H9, D5).
- **A Sentry count is a sample.** Scale it by the production sample rate before comparing it with a budget or with product analytics (E1 row). Flask production traffic is too small for an E1 before/after on a flask-only change.
