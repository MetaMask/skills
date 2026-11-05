---
repo: metamask-mobile
parent: ui-development
---

# MetaMask Mobile overlay

Platform rules for React Native UI in `metamask-mobile`. The base above covers
sources, component choice, foundations, typography, migration, and the shared
accessibility rules.

## Packages and paths

- Components and enums: `@metamask/design-system-react-native`. Do not import
  enums from `@metamask/design-system-shared`, and never import MMDS through a
  repository-relative path.
- Tailwind: `@metamask/design-system-twrnc-preset`, through `useTailwind()`.
- Inventory and deprecations: the
  [React Native components manifest](https://metamask.github.io/metamask-design-system/react-native/manifests/components.json),
  confirmed against `node_modules/@metamask/design-system-react-native/dist/components/index.d.cts`.
- README: `packages/design-system-react-native/src/components/<Component>/README.md`
  at the tag `@metamask/design-system-react-native@<installed version>`.
- Legacy component library: `app/component-library/` (being migrated to MMDS).
  `components-temp/` holds MetaMask-specific components such as `Tabs`.
- Product UI: `app/components/`. Real MMDS usage:
  `app/component-library/components/design-system.stories.tsx`.
- Marketing-moment headlines: `app/components/UI/MarketingMomentTitle`.

Do not apply React web guidance (`className`, HTML tags, `aria-*` props) to
Mobile.

## Styling surface

- Use `const tw = useTailwind();`. Never `import tw from 'twrnc'`.
- Use MMDS `Box` instead of `View` and MMDS `Text` instead of React Native
  `Text`.
- Prefer typed props (`flexDirection`, `alignItems`, `gap`, `padding*`,
  `margin*`, `backgroundColor`) over `twClassName` for layout. Use
  `twClassName` for everything else: size, position, radius, opacity,
  `flex-1`. `Box` has no `borderRadius` prop; use `twClassName="rounded-xl"`.
- No `StyleSheet.create()` and no new `.styles.ts` files. Inline style objects
  only for truly dynamic values.
- When you change a component that uses `useStyles` with a `*.styles.ts`
  file, move its styles to typed `Box` props or `twClassName`, then delete the
  styles file and the `useStyles` call.
- Pressed state: `ButtonBase` takes a function in `twClassName`; its `style`
  prop is a plain style, so a `style={({ pressed }) => ...}` function does not
  type-check. For a custom `Pressable`, use `tw.style()` in its style function.

```tsx
<ButtonBase
  onPress={onPress}
  twClassName={(pressed) => `w-full ${pressed ? 'bg-pressed' : 'bg-default'}`}
>
  {label}
</ButtonBase>

<Pressable
  style={({ pressed }) => tw.style('w-full flex-row', pressed && 'bg-pressed')}
/>
```

- Interactive list rows use MMDS `ListItem` with `isInteractive`, which
  applies the pressed background itself; do not add `bg-pressed` again. Keep
  the row's own horizontal padding; do not add an outer pad that
  double-indents it.

## Sheets

- Use the MMDS `BottomSheet`, `BottomSheetHeader`, and `BottomSheetFooter`. The
  sheet already sets its surface token; override it only when the design puts
  the sheet on another surface.
- A `ScrollView` inside a `BottomSheet` must come from
  `react-native-gesture-handler`. The React Native `ScrollView` does not scroll
  inside the sheet on Android.
- Use the full sheet composition (overlay, container, header, footer, safe
  areas, drag, keyboard, accessibility). In nested sheet flows, keep the
  container stable, move content directionally, use back for the child and
  close for the whole flow, and avoid two systems fighting over height or drag.
- Mobile mounts one `<Toaster />` in `app/components/Nav/App/ToasterOverlay`.
  Call `toast()`; do not render another `Toaster`.

## Mobile accessibility mechanics

- Custom pressables set `accessibilityRole`, `accessibilityState` (`disabled`,
  `selected`, `checked`, `busy`, `expanded`), and an `accessibilityLabel` or
  `accessibilityHint` when visible text is not enough. Prefer MMDS controls over
  a `View` with `onPress`.
- Headings (`HeadingLg/Md/Sm`, `PageHeading`, `SectionHeading`, `Display*`) pass
  `accessibilityRole="header"`; MMDS `Text` defaults to `"text"`. A tappable
  heading is a button.
- Tabs use `accessibilityRole="tab"` with `accessibilityState={{ selected }}`.
- Announce async errors and status with
  `AccessibilityInfo.announceForAccessibility` (iOS VoiceOver ignores
  `accessibilityLiveRegion`), and give inline error text
  `accessibilityRole="alert"`.
- Touch targets are about 44×44 (minimum 24×24). Use `hitSlop` or padding when
  the visible control is smaller.
- Support Dynamic Type: no fixed-height text boxes or absolute layouts that
  clip or overlap as text grows.
- Wire skeletons and other motion to `useReducedMotion()` so they stop when
  Reduce Motion is on.

## Incremental migration paths

Mobile's legacy library has no single barrel. Each component is a default
export from its own folder under `app/component-library/components/` (for
example `Texts/Text`, `Buttons/Button`, `Icons/Icon`), and there is no legacy
`Box`. Apply the base `Legacy*` rule to the default export and to clashing
named enums. `ButtonVariants` (legacy) and `ButtonVariant` (MMDS) do not clash,
so do not alias them. Adjust the `../` depth to the file.

```tsx
import { Text, TextVariant } from '@metamask/design-system-react-native';
import LegacyText, {
  TextVariant as LegacyTextVariant,
} from '../../../component-library/components/Texts/Text';
```

Prop mapping from legacy to MMDS components:
[React Native `MIGRATION.md`](https://github.com/MetaMask/metamask-design-system/blob/main/packages/design-system-react-native/MIGRATION.md).

## Mobile checklist

- [ ] `useTailwind()`; no `twrnc` import, `StyleSheet.create()`, or new
      `.styles.ts`.
- [ ] MMDS `Box` and `Text` instead of `View` and React Native `Text`.
- [ ] Pressed styles via `ButtonBase twClassName={(pressed) => ...}` or
      `Pressable` + `tw.style()`.
- [ ] `ScrollView` inside a `BottomSheet` comes from
      `react-native-gesture-handler`.
- [ ] Controls, headings, and tabs expose roles and state; errors are
      announced; touch targets are large enough.
