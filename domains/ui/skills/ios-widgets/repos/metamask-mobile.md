---
repo: metamask-mobile
parent: ios-widgets
---

# MetaMask Mobile

This skill installs only for **metamask-mobile**. `expo-widgets` is iOS-only,
so nothing here has an Android counterpart.

## Canonical source of truth

`docs/widgets/README.md` is the long-form human guide — architecture,
rationale, possibilities, limitations. This skill is the condensed, actionable
version. When the two disagree, the repo wins; read the live code before
proposing a change.

## Where things live

| Path | What |
| --- | --- |
| `app/core/Widgets/` | All JS/TS foundation: theme bridge, `createMetaMask*` wrappers, `WidgetUpdaterService`, `reconcileLiveActivities` |
| `app/core/Widgets/widgets/BalanceWidget.ios.tsx` + `.tsx` | Reference widget — copy its shape |
| `app/core/Widgets/liveActivities/PerpsPnlLiveActivity.ios.tsx` + `.tsx` | Reference Live Activity |
| `app/components/UI/Perps/services/PerpsLiveActivityService.ts` | Reference lifecycle driver — the more instructive half; throttle-then-dedupe and privacy suppression both live here |
| `ios/ExpoWidgetsTarget/` | The WidgetKit app extension target (Swift) |
| `ios/MetaMask/NativeModules/RCTWidgetInfo/` | `WidgetCenter.getCurrentConfigurations` bridge, used for adoption analytics |
| `scripts/ios/setup-expo-widgets-target.rb` | Recreates the Xcode target; only needed after a `project.pbxproj` conflict |

## Feature flag

`MM_WIDGETS_ENABLED` gates `WidgetUpdaterService.initialize()` and every Live
Activity service. It defaults to `'false'` in `builds.yml`'s `_public_envs`
while the feature is in development, so every shipped build has widgets
receiving no data.

To work on widgets locally, set `MM_WIDGETS_ENABLED="true"` in `.js.env` and
**restart Metro** — the value is inlined at transform time by
`transform-inline-environment-variables`, not read at runtime.

## Adoption analytics are automatic

`initialize()` fire-and-forgets `trackWidgetAdoption()` once per launch,
reporting which widgets are actually **installed** rather than tapped — a
passive glanceable widget is looked at, and `expo-widgets` exposes no tap
signal for a non-interactive widget anyway. It is keyed on the WidgetKit
`kind`, which already equals each widget's exported name constant, so a new
widget is covered the moment its Swift file exists. **There is no analytics
step to add.**

## Repo-specific limitations

- **`MetaMask-Flask` ships without widgets.** `ExpoWidgetsTarget` is embedded
  only in the `MetaMask` scheme. Shipping on Flask needs a second parallel
  extension target with its own bundle id, entitlements, and provisioning —
  not a config change. Open an RFC first.
- **Device and IPA builds need Apple Developer portal work that does not
  exist yet** (App Group capability on the existing profiles, two new profiles
  for the extension's bundle id, `provisioningProfiles` entries in the export
  options plists, manual signing). See the provisioning section of
  `docs/widgets/README.md`. Simulator builds, `yarn start:ios`, and E2E are
  unaffected.
- **`expo prebuild` never runs here.** The repo has a checked-in `ios/`
  directory and `app.config.js` nests everything under `expo:`, which
  `@expo/config` reduces away before any plugin is seen. Every native change
  is hand-applied to `ios/`.
