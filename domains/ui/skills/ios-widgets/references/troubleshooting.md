# Troubleshooting

Start from the symptom. Most of these are the two-process model asserting
itself, not a defect in the foundation.

## `ReferenceError` for some variable on device, but the editor was happy

You referenced something outside the layout function's own parameters — a
closure, an import, a module-scope constant. TypeScript resolves it against
the module; the JavaScriptCore sandbox never receives the module. Move the
value into props and compute it in the producer.

## The app crashes on Android after a change under `app/core/Widgets/`

You imported `expo-widgets` or `@expo/ui` from a file without an `.ios.`
extension, or used an explicit `.ios` suffix on a **value** import from a file
that is not itself iOS-only. Both put a throwing `requireNativeModule` call in
the Android bundle. See **Platform split** in the skill body.

## `createWidget` throws `The 2nd argument cannot be cast to type String` at startup

A split pair whose two halves have different extensions — a `.ios.tsx`
implementation with a `.ts` fallback. Metro resolves the `.ts` no-op first on
iOS and hands its `() => undefined` layout to the real native `createWidget`.
Rename the fallback to match the implementation's extension. Jest will not
catch this.

## The widget never appears in the simulator's widget gallery

Check, in order: the `.swift` file is a **member of the `ExpoWidgetsTarget`
target** (not just on disk), `index.swift` lists it in the `WidgetBundle`, and
you did a **full rebuild** — widget code lives in a separate native binary, so
a Metro reload changes nothing.

## The widget shows stale or blank data

- Confirm `WidgetUpdaterService.initialize()` actually ran. It is called once
  from `app/store/index.ts` after persisted state rehydrates, and it is a
  no-op unless `MM_WIDGETS_ENABLED === 'true'`.
- Confirm the App Group identifier matches **exactly** across
  `ios/MetaMask/Info.plist`'s `ExpoWidgetsAppGroupIdentifier`,
  `MetaMask.entitlements`, `MetaMaskDebug.entitlements`, and the extension's
  `Info.plist` + entitlements. A mismatch fails silently rather than erroring.
- Remember the ~2s debounce, plus WidgetKit's own daily refresh budget, which
  throttles renders regardless of how often the app pushes.

## Jest throws trying to `require` an `.ios.tsx` widget file

A `moduleNameMapper` entry is missing for an `@expo/ui` submodule you newly
imported. Add it beside the existing `@expo/ui/swift-ui` entries in
`jest.config.js` and create the stub in `app/__mocks__/@expo/ui/`.

## Two entries for the same widget in the gallery

A stale WidgetKit registration from before the extension target's identity
last changed — not a code defect. Verify with
`xcrun simctl spawn <udid> pluginkit -m -p com.apple.widgetkit-extension`,
which should show one entry for the extension's bundle id. Erase the simulator
(`xcrun simctl erase <udid>`), wipe DerivedData, and reinstall.

## `pod install` fails: `Unable to find a target named 'ExpoWidgetsTarget'`

The Xcode target is missing, most likely from a `project.pbxproj` merge or
rebase conflict resolved by taking one side wholesale. Run
`ruby scripts/ios/setup-expo-widgets-target.rb` (idempotent — safe even if you
are unsure), then rerun `pod install`.

## A Live Activity is frozen on the Lock Screen after a force-quit

Expected without cleanup: iOS keeps the activity alive but the JS handle to
end it does not survive the process. The owning service must call
`endLiveActivitiesFromPreviousLaunch()` once at start. If it already does and
the card persists, check that the service is reached at all under the current
platform and feature-flag gating.

## A Live Activity shows another feature's data

Something adopted `getInstances()[0]`. That array is app-wide across every
kind, and `update()` rewrites the instance's `name` from whichever factory the
handle came from. Each feature must own the handle returned by its own
`.start()`.
