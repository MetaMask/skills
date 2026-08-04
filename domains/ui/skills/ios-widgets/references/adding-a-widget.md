# Adding a home screen widget

A widget needs both a JS half (layout + registration + data) and a native half
(a Swift file in the WidgetKit extension target). Both halves are keyed on one
string: the widget's name.

Work through these in order. Steps 5 to 8 are the ones a JS-only change will
forget, and their absence shows up as "the widget never appears in the
gallery".

## 1. Design the props

A flat, JSON-serializable interface. Pre-formatted, pre-translated, pre-masked
— see **Designing props** in the skill body.

## 2. Layout and registration — `app/core/Widgets/widgets/MyWidget.ios.tsx`

```tsx
import { Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import type { WidgetEnvironment } from 'expo-widgets';

import { createMetaMaskWidget } from '../createMetaMaskWidget.ios';
import type { WithWidgetTheme } from '../types';

export interface MyWidgetProps {
  /** Already formatted and privacy-mode aware. Computed by WidgetUpdaterService. */
  valueDisplay: string;
  label: string;
}

function MyWidgetLayout(
  props: MyWidgetProps & WithWidgetTheme,
  environment: WidgetEnvironment,
) {
  'widget';

  const { valueDisplay, label, theme } = props;
  const activeTheme =
    environment.colorScheme === 'dark' ? theme.dark : theme.light;

  return (
    <VStack
      alignment="leading"
      spacing={activeTheme.spacing.xs}
      modifiers={[padding({ all: activeTheme.spacing.md })]}
    >
      <Text modifiers={[foregroundStyle(activeTheme.colors.textAlternative)]}>
        {label}
      </Text>
      <Text
        modifiers={[
          foregroundStyle(activeTheme.colors.textDefault),
          font({
            size: activeTheme.typography.amountDisplay.size,
            weight: activeTheme.typography.amountDisplay.weight,
          }),
        ]}
      >
        {valueDisplay}
      </Text>
    </VStack>
  );
}

export const MY_WIDGET_NAME = 'MyWidget';

export const MyWidget = createMetaMaskWidget<MyWidgetProps>(
  MY_WIDGET_NAME,
  MyWidgetLayout,
);
```

Keep the layout dumb: destructure, arrange, return. The `'widget'` directive
must be the first statement in the function body.

## 3. Fallback — `app/core/Widgets/widgets/MyWidget.tsx`

Duplicate `MyWidgetProps`, re-export the same name constant, and register a
no-op layout through the **extensionless** wrapper:

```tsx
import { createMetaMaskWidget } from '../createMetaMaskWidget';

export interface MyWidgetProps {
  valueDisplay: string;
  label: string;
}

export const MY_WIDGET_NAME = 'MyWidget';

export const MyWidget = createMetaMaskWidget<MyWidgetProps>(
  MY_WIDGET_NAME,
  () => undefined,
);
```

`.tsx`, not `.ts`, even with no JSX in it. See **Platform split** in the skill
body — a `.ts` fallback silently shadows the real widget on iOS.

## 4. Data — `app/core/Widgets/WidgetUpdaterService.ts`

Add one `private computeMyWidgetProps()` and one
`private pushMyWidgetUpdate()`, and call the push method from
`pushUpdates()`. Every selector read, formatter call, privacy-mode mask, and
`strings()` lookup belongs here — never in the widget file.

The service already debounces store changes (2s) and skips the native write
when the newly computed props are `JSON.stringify`-identical to the last push.
Do not push from anywhere else to work around that.

## 5. Swift file — `ios/ExpoWidgetsTarget/MyWidget.swift`

Copy `BalanceWidget.swift` and replace `name` (must exactly equal
`MY_WIDGET_NAME`), `configurationDisplayName`, `description`, and
`supportedFamilies`.

## 6. Bundle entry — `ios/ExpoWidgetsTarget/index.swift`

Add `MyWidget()` to the `WidgetBundle` body. WidgetKit caps one bundle at
**4 widgets**; a fifth needs a chained nested bundle (see the comments in that
file).

## 7. Declare it in `app.config.js`

Add an entry to the `expo-widgets` plugin's `widgets` array mirroring the
Swift file's `name`, `displayName`, `description`, `supportedFamilies`, and
`contentMarginsDisabled`.

This entry is **never evaluated** — the repo has a checked-in `ios/` directory,
so `expo prebuild` never runs and the config plugin never executes. It exists
as the canonical human-readable declaration, the same way `expo-font`'s
`fonts` array is declared beside a hand-committed `UIAppFonts` list. Keeping
it in sync matters because a future `expo prebuild` would regenerate
`ios/ExpoWidgetsTarget/` from it alone.

## 8. Xcode target membership

The new `.swift` file must be a **member of the `ExpoWidgetsTarget` target**,
not merely present on disk (Xcode → File Inspector → Target Membership).
`scripts/ios/setup-expo-widgets-target.rb` does not help: it early-returns
once the target exists.

## 9. Tests

See [`testing.md`](testing.md).

## 10. Verify in a simulator

Full rebuild (widget code lives in a separate native binary, so a Metro reload
is not enough), then long-press the home screen → **+** → search the widget's
display name. Check light and dark mode, and that it updates after the
underlying data changes in-app.

## No analytics step

Adoption is tracked automatically, keyed on the WidgetKit `kind` — which is
already `MY_WIDGET_NAME`. A new widget is measured the moment its Swift file
exists and a user places it. There is nothing to add.
