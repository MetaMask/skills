---
name: ios-widgets
description: >-
  Build and review iOS home screen widgets and Live Activities in MetaMask
  Mobile, on the expo-widgets + @expo/ui foundation in app/core/Widgets/ and
  ios/ExpoWidgetsTarget/. Use when adding, changing, or reviewing a widget, a
  Live Activity, a Dynamic Island or Lock Screen surface, WidgetKit/App Group
  wiring, WidgetUpdaterService data pushes, or widget theming; when a file
  carries a 'widget' directive or is one half of an .ios.tsx/.tsx
  platform-split pair; or when debugging a widget that renders stale or blank
  data, throws ReferenceError only on device, crashes the Android bundle at
  import time, or never appears in the simulator's widget gallery.
maturity: stable
---

# iOS widgets and Live Activities

A widget does not run in your app. It runs in a **separate iOS app extension
process** (`ExpoWidgetsTarget`), inside an embedded **JavaScriptCore** VM that
shares no memory, no imports, and no module state with the React Native
runtime. The only channel between the two is a serialized `props` object
written to a shared **App Group** container.

Every rule below follows from that one fact. Almost every widget bug is a
violation of it that TypeScript, ESLint, and Jest all accept.

## When to use

- Adding or changing a home screen widget, a Live Activity, a Lock Screen
  card, or a Dynamic Island presentation.
- Reviewing a diff that touches `app/core/Widgets/`, `ios/ExpoWidgetsTarget/`,
  a `'widget'`-directive function, or an `.ios.tsx`/`.tsx` pair.
- Debugging a widget that shows stale data, renders blank, throws
  `ReferenceError` on device only, or takes the Android app down at startup.

**Out of scope:** Android home screen widgets (no equivalent foundation
exists — `expo-widgets` is iOS-only), push-driven remote updates, and
interactive widget buttons.

## Hard rules

1. **No closures inside a `'widget'`-directive function.** `babel-preset-expo`
   replaces the whole function with a **string literal of its own source** at
   build time. Anything it references that is not one of its own parameters —
   an import, a module constant, a selector, `strings()`, `Logger`,
   `console.log` — is `undefined` in the sandbox. Only `@expo/ui/swift-ui`
   (and `/modifiers`) and plain JS are injected there.
2. **Every value the layout needs arrives as a prop**, already fetched,
   formatted, translated, and masked by the caller.
3. **Platform-split every file that imports `expo-widgets` or `@expo/ui`.**
   Their JS entry points call a *throwing* `requireNativeModule` /
   `requireNativeView` at import time, so merely importing one from the
   Android bundle crashes the app at startup.
4. **Both halves of a split pair must share the same file extension.** A
   `.ios.tsx` implementation needs a `.tsx` fallback, even when that fallback
   contains no JSX (see [Platform split](#platform-split) for why a `.ts`
   fallback silently wins on iOS).
5. **Pass both theme variants and resolve inside the layout** via
   `environment.colorScheme`. Resolving "the current theme" outside means the
   widget only tracks an OS appearance change on the *next* app-triggered
   push.
6. **Never adopt `getInstances()[0]`** for a Live Activity — that array is
   app-wide across every kind. See
   [`references/live-activities.md`](references/live-activities.md).

## Platform split

| File | Runs on | Contains |
| --- | --- | --- |
| `MyThing.ios.tsx` | iOS | Real implementation; may import `expo-widgets` / `@expo/ui` |
| `MyThing.tsx` | Everywhere else | No-op fallback with the same exported names and types |

- Import through the **extensionless** path (`from './MyThing'`). Metro picks
  the `.ios` variant on iOS and the fallback everywhere else; `tsc` resolves
  the fallback, and each platform file is still type-checked when `tsc` walks
  it directly.
- Duplicate small prop interfaces into the fallback rather than importing
  them from the `.ios` file.
- An explicit `./MyThing.ios` **value** import bypasses Metro's platform
  exclusion and ships the module to Android. It is only safe from a file that
  is itself `.ios`-only. `import type` is erased by Babel and is safe
  anywhere, but prefer the extensionless path for consistency.

Extension parity (rule 4) is what keeps Metro and Jest in agreement. Metro
loops `sourceExts` on the outside and platform on the inside, so for a
`.ios.tsx` + `.ts` pair it finds `MyThing.ts` **before** it ever tries
`MyThing.ios.tsx` — the no-op shadows the real implementation on iOS, and
`createWidget` then throws `The 2nd argument cannot be cast to type String` at
import time. Jest's resolver tries all platform variants first and does not
reproduce this, so the suite stays green while the app is broken at startup.

## Designing props

The props object is the entire API between the two processes. Make it flat,
JSON-serializable, and inert:

- **Pre-format and pre-translate.** Currency strings, percentages, dates, and
  labels arrive rendered — there is no `Intl` config, no formatter, and no
  i18n catalogue in the sandbox.
- **Pre-mask.** Privacy mode is applied by the producer. For a Live Activity,
  prefer suppressing the activity entirely over masking, because the Lock
  Screen is readable without unlocking the device.
- **Pass semantic flags, not resolved colors** (`isProfit: boolean`, not
  `color: '#1c8234'`), so the layout can still pick the right light/dark
  variant when the OS appearance changes without an app push.

## Theming

Widgets cannot use `useTailwind()`,
`@metamask/design-system-react-native`, or any NativeWind runtime — none of it
exists inside the sandbox. Use the serializable `WidgetTheme` snapshot
(colors, typography `{ size, weight }`, a 4px spacing scale) instead of
hand-rolling values.

Only **solid** design tokens belong in it: `@expo/ui` reads an 8-digit hex as
`#AARRGGBB` (SwiftUI's order) while `@metamask/design-tokens`' alpha tokens are
`#RRGGBBAA`, so an alpha token silently renders the wrong color. Prefer
`border.default` over `border.muted`, or convert explicitly.

Widgets always follow the **system** appearance, never MetaMask's in-app theme
override — `colorScheme` comes from WidgetKit and cannot see app state.

## Workflow

| Task | Open |
| --- | --- |
| Add or change a home screen widget | [`references/adding-a-widget.md`](references/adding-a-widget.md) |
| Add or change a Live Activity / Dynamic Island surface | [`references/live-activities.md`](references/live-activities.md) |
| Write or fix tests for either | [`references/testing.md`](references/testing.md) |
| A widget renders wrong, stale, or not at all | [`references/troubleshooting.md`](references/troubleshooting.md) |

Read the reference for the task at hand, not all four. A widget and a Live
Activity share every rule above and differ only in registration, layout shape,
and who drives the lifecycle.

## Review checklist

Reject a change that does any of these:

- References anything inside a `'widget'`-directive function other than its
  own parameters and `@expo/ui/swift-ui`(`/modifiers`).
- Imports `expo-widgets` or `@expo/ui/*` from a file without an `.ios.`
  extension.
- Uses an explicit `.ios`-suffixed **value** import from a file that is not
  itself `.ios`-only.
- Adds an `.ios.ts(x)` file without a plain fallback counterpart **using the
  same extension**.
- Passes one resolved theme instead of both variants, or resolves
  `colorScheme` outside the layout.
- Formats, translates, or masks data inside the layout instead of in the
  producer.
- Adopts an existing Live Activity instance from `getInstances()`.
