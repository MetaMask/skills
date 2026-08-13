# Testing widgets and Live Activities

A `'widget'`-directive function becomes a **string literal** at build time,
and `babel.config.tests.js` uses the same preset — so the transform runs under
Jest too. Importing the module and calling the layout does not execute your
JSX; it returns a string. React Testing Library cannot help here.

Test each layer at the boundary where it is still real code.

## What to test where

| Layer | What is assertable |
| --- | --- |
| `WidgetTheme.ts` | Pure functions: color and typography mapping, spacing scale, font-weight fallback, singleton exports |
| `createMetaMaskWidget.ios.ts` / `createMetaMaskLiveActivity.ios.ts` | Delegation to `expo-widgets`' `createWidget` / `createLiveActivity` with the right `(name, layout)` |
| The plain `.ts` fallbacks | Every method is a safe no-op and never throws |
| A widget's own `*.ios.tsx` | Registration only: the name matches the Swift file, and the layout argument is now a `string` |
| `WidgetUpdaterService.ts` | All of the real logic: formatting, privacy masking, debounce, redundant-push skipping, cleanup |
| A Live Activity's lifecycle service | All of the real logic: start/update/end transitions, throttling, dedupe, flag and platform gating |

## The registration test

Small, but it is the regression check that the Babel transform actually ran —
if someone breaks the preset config, the layout stays a function and the app
ships a widget that cannot render:

```ts
expect(createWidget).toHaveBeenCalledWith('MyWidget', expect.any(String));
```

Assert the name matches the Swift file's `kind`, and that the returned object
exposes `updateSnapshot` / `reload`. Nothing about rendered UI is assertable
from this file.

## The logic test

This is where the coverage actually belongs. Mock `ReduxService.store`, the
selectors, and the widget module (`jest.mock('./widgets/MyWidget', ...)`),
then drive the captured `store.subscribe` listener with `jest.useFakeTimers()`
to assert debounce, skip, and cleanup behavior. `WidgetUpdaterService.test.ts`
is the full worked pattern.

For a Live Activity, the equivalent is the feature's lifecycle service: drive
its data source, then assert `.start()` / `.update()` / `.end()` calls and
that a duplicate payload produces no second write.

## Jest infrastructure

Native-module mocks are registered explicitly in `jest.config.js`'s
`moduleNameMapper` — this project does not rely on the auto-discovered root
`__mocks__/` convention:

- `app/__mocks__/expo-widgets.ts`
- `app/__mocks__/@expo/ui/swift-ui.ts`
- `app/__mocks__/@expo/ui/swift-ui-modifiers.ts`

They exist so the **import statements** at the top of `.ios.tsx` files resolve
without the real module's throwing `requireNativeModule`. The stubbed
components are never invoked, since the JSX never executes under Jest.

Importing an `@expo/ui` submodule that has no stub yet throws at require time.
Add the `moduleNameMapper` entry next to the existing ones and create the
matching stub in `app/__mocks__/@expo/ui/`.

## Testing the feature flag

`jest.config.js` defaults `MM_WIDGETS_ENABLED` to `'true'` so the enabled path
is the default under test. Because the value is inlined by
`transform-inline-environment-variables` at transform time, a test can only
toggle it at runtime if **both the module under test and its test file** are
in `babel.config.tests.js`'s inline-env `exclude` list. Add both when a new
service reads the flag and you want to cover the disabled no-op path.
