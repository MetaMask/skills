# Adding a Live Activity

A Live Activity is the Lock Screen and Dynamic Island counterpart of a home
screen widget. Every rule in the skill body applies unchanged: the `'widget'`
directive and its no-closures consequence, the `.ios.tsx` + `.tsx` pair, both
theme variants, pre-formatted props.

Three things differ, and they are the whole delta.

## 1. No native work at all

No `.swift` file, no `index.swift` entry, no Xcode target membership, no
`app.config.js` entry. `expo-widgets`' generic `WidgetLiveActivity()` renderer
is already in the bundle and `NSSupportsLiveActivities` is already set.
`createLiveActivity(name, layout)` writes the stringified layout into the
shared App Group container at **import time**, and the extension reads it back
by `name` at render time.

A new Live Activity is a pure-JS change and ships over Metro/OTA like any
other JS. No rebuild is needed to see it in a simulator that already has the
extension installed — reloading JS is enough, because registration happens at
import.

## 2. The layout returns an object, not a JSX tree

A widget layout returns one view. A Live Activity layout returns a
`LiveActivityLayout` whose keys are the presentation regions iOS asks for:

| Key | Where it appears |
| --- | --- |
| `banner` | Lock Screen and Notification Center |
| `bannerSmall` | CarPlay / watchOS (falls back to `banner`) |
| `compactLeading` | Collapsed Dynamic Island, left of the camera |
| `compactTrailing` | Collapsed Dynamic Island, right of the camera |
| `minimal` | Dynamic Island when another app shares it |
| `expandedLeading` / `expandedTrailing` / `expandedCenter` / `expandedBottom` | Long-pressed Dynamic Island |

The second parameter is a `LiveActivityEnvironment`, not a
`WidgetEnvironment` — same `colorScheme`, no `widgetFamily`. `expo-widgets`
does not re-export the type from its package root, so import it from
`../createMetaMaskLiveActivity.ios`, which derives and re-exports it.

```tsx
import { Text } from '@expo/ui/swift-ui';
import { foregroundStyle } from '@expo/ui/swift-ui/modifiers';

import {
  createMetaMaskLiveActivity,
  type LiveActivityEnvironment,
} from '../createMetaMaskLiveActivity.ios';
import type { WithWidgetTheme } from '../types';

export interface MyActivityProps {
  valueDisplay: string;
  /** Semantic, not a resolved color — the layout still has to pick light/dark. */
  isProfit: boolean;
}

function MyActivityLayout(
  props: MyActivityProps & WithWidgetTheme,
  environment: LiveActivityEnvironment,
) {
  'widget';

  const { valueDisplay, isProfit, theme } = props;
  const activeTheme =
    environment.colorScheme === 'dark' ? theme.dark : theme.light;
  const valueColor = isProfit
    ? activeTheme.colors.success
    : activeTheme.colors.error;

  const value = (
    <Text modifiers={[foregroundStyle(valueColor)]}>{valueDisplay}</Text>
  );

  return {
    banner: value,
    compactLeading: value,
    compactTrailing: value,
    minimal: value,
  };
}

export const MY_ACTIVITY_NAME = 'MyActivity';

export const MyActivity = createMetaMaskLiveActivity<MyActivityProps>(
  MY_ACTIVITY_NAME,
  MyActivityLayout,
);
```

The plain `MyActivity.tsx` fallback mirrors this through
`../createMetaMaskLiveActivity` with a `() => undefined` layout, same as a
widget's fallback.

## 3. The lifecycle is feature-owned

`WidgetUpdaterService` exists to fan one debounced Redux snapshot out to
widgets. A Live Activity is a state machine — start on open, update while
open, end on close — and its data is often not in Redux at all. So the owning
feature drives it, from its own service.

That service must:

- Gate on `Platform.OS === 'ios'` and `process.env.MM_WIDGETS_ENABLED === 'true'`.
- Call `endLiveActivitiesFromPreviousLaunch()` once when it starts (see
  [Orphaned activities](#orphaned-activities) below).
- **Throttle, then dedupe.** ActivityKit budgets update frequency, and a price
  feed ticks far faster than a Lock Screen card is worth redrawing. Throttle
  the source subscriptions, then skip the write entirely when the newly
  computed props are `JSON.stringify`-identical to the last push — the same
  pattern `WidgetUpdaterService` uses.
- End with `.end('immediate')`.

A Live Activity can only be **started** while the app is foregrounded.

## Orphaned activities

`expo-widgets` renders every Live Activity through a single shared
`ActivityAttributes` type, discriminating kinds only by a `name` string inside
the content state. Two consequences:

- **`getInstances()` on any factory returns every live instance app-wide**,
  regardless of which factory started it, and `update()` rewrites that `name`
  from the factory the handle came from. Never adopt `getInstances()[0]` — you
  may silently repurpose another feature's activity.
- iOS keeps a Live Activity alive after its host app is terminated, but the JS
  handle needed to end it does not survive. `reconcileLiveActivities.ts`
  therefore ends **everything**, once per process, at launch — before any
  feature has started an activity of its own. It is guarded so a second caller
  cannot end the first caller's freshly started activity.

## Privacy mode

Suppress the activity outright rather than masking the numbers. A Lock Screen
is readable without unlocking the device. This is a deliberate difference from
a home screen widget, which masks instead.

## Checklist

1. Design the props — flat, pre-formatted, semantic flags over resolved
   colors.
2. `app/core/Widgets/liveActivities/MyActivity.ios.tsx` — props, `'widget'`
   layout returning a `LiveActivityLayout`, `createMetaMaskLiveActivity(...)`.
3. `app/core/Widgets/liveActivities/MyActivity.tsx` — no-op fallback, `.tsx`
   extension.
4. A feature-owned lifecycle service: `.start()` / `.update()` /
   `.end('immediate')`, throttled and deduped, gated on platform and flag,
   calling `endLiveActivitiesFromPreviousLaunch()` once.
5. Tests — see [`testing.md`](testing.md).
6. Verify in a simulator. No rebuild needed if the extension is already
   installed.
