---
repo: metamask-mobile
parent: ui-development
---


# MetaMask Mobile React Native UI Development Guidelines

## Core Principle

Always prioritize @metamask/design-system-react-native components and Tailwind CSS patterns over custom implementations.

## Component Hierarchy (STRICT ORDER)

### The Rule: Check Design System First
**Before writing any new component or choosing what to use, ask: "Does @metamask/design-system-react-native have this?"**

1. **FIRST**: Use `@metamask/design-system-react-native` components
   - **Availability is dynamic**: read the installed package export index before deciding a component is unavailable.
   - **Rule**: If the installed package exports the component, you MUST use it.
   - **Layout & typography**: Box/BoxRow/BoxColumn, Text, SensitiveText, TextButton.
   - **Buttons**: Button/ButtonBase/ButtonIcon/ButtonSemantic/ButtonFilter/ButtonHero, MainActionButton, FilterButton/FilterButtonGroup.
   - **Bottom sheets**: BottomSheet, BottomSheetDialog, BottomSheetHeader, BottomSheetFooter, BottomSheetOverlay.
   - **Headers & titles**: HeaderBase, HeaderRoot, HeaderSearch, HeaderStandard, HeaderStandardAnimated, HeaderSubpage, TitleAlert, TitleHub, TitleStandard, TitleSubpage, SectionHeader, SectionDivider.
   - **Form & controls**: Input, TextField, TextFieldSearch, TextArea, Label, HelpText, Checkbox, RadioButton, Switch, Slider, SegmentedControl, SelectButton.
   - **Lists & selection**: ListItem, ListItemSelect, ListItemMultiSelect, ActionListItem, KeyValueRow, KeyValueColumn, KeyValueSelect.
   - **Data display**: Card, Content, Tag, Avatar variants, Badge variants, AvatarGroup, BadgeWrapper. (`Skeleton` is exported too, but see the Skeleton exception under tier 2.)
   - **Feedback**: BannerAlert/BannerBase, Toast/Toaster/toast, IconAlert, TabEmptyState, Icon.

2. **SECOND**: Use `app/component-library` ONLY if design system lacks it
   - **Navigation & tabs**: `components-temp/Tabs/*`, `components-temp/TabBar`, `components/Navigation/TabBar`, `TabBarItem`, `TradeTabBarItem`
   - **Modal & sheet wrappers**: `components/Modals/ModalConfirmation`, `ModalMandatory`, `components/Sheet/SheetHeader`, `components/Overlay`
   - **Pickers & cells**: `PickerAccount`, `PickerBase`, `PickerNetwork`, `components/Cells/Cell`, `components-temp/CellSelectWithMenu`, `components-temp/ListItemMultiSelectButton`, `components/List/ListItemColumn`
   - **Account & multichain UI**: `components-temp/Accounts/*`, `components-temp/MultichainAccounts/*`
   - **Other MetaMask-specific components**: `components/Accordions/Accordion`, `components/Select/SelectValue`, `components/Tags/TagUrl`, `components-temp/TagColored`, `components-temp/Price/*`, `components-temp/StepperCard`, `components-temp/Loader`, `components-temp/Pressable`, `components-temp/ConditionalScrollView`, `components-temp/HeaderCompactStandard`, `components-temp/Buttons/ButtonPill`, `ButtonToggle`
   - **Rule**: These are MetaMask-specific implementations not (yet) in the design system
   - **Do NOT reach here for a component the design system already exports.** Most `app/component-library` duplicates are marked `@deprecated` and point straight back at `@metamask/design-system-react-native`: Text, Tag, Label, HelpText, TextField, TextFieldSearch, Input, Card, Checkbox, RadioButton, SelectButton, Toast, Icon, HeaderBase/HeaderRoot/HeaderSearch, the Button family (including ButtonLink/ButtonPrimary/ButtonSecondary), Avatar\*, Badge\*, BadgeWrapper, the Banner family, the BottomSheet family, ListItem/ListItemSelect/ListItemMultiSelect, SensitiveText, ActionListItem, KeyValueRow, SectionHeader, TitleStandard/TitleSubpage, MainActionButton, TabEmptyState, ButtonFilter, ButtonHero, and ButtonSemantic.
   - **Exception — Skeleton.** Import `Skeleton` from `app/component-library/components-temp/Skeleton`, not from the package. That wrapper renders the design system `Skeleton` with `autoPlay` disabled whenever Jest or test overrides are active; importing the package version directly leaves the animation running in tests. (The deprecated `components/Skeleton` points at this wrapper, not at the package.)
   - **Important**: component-library components should themselves use design system primitives internally

3. **THIRD**: Feature-specific components
   - **Use for**: Complex, domain-specific UI that combines multiple design system/component-library components
   - **Examples**: `BridgeInputSelector`, `StakeInputView`, `NFTDetailsModal`
   - **Rule**: Must be built using Box, Text, and other design system primitives - NO raw View/Text or StyleSheet
   - **Reuse**: Search for existing feature components before building new ones to avoid duplication

4. **LAST RESORT**: Custom components with StyleSheet
   - **Only when**: Highly specialized one-off needs with no design system equivalent AND no component-library equivalent
   - **Requires**: Strong justification why design system primitives can't be composed

### Decision Tree
```
Need a component?
  ├─ Does the installed @metamask/design-system-react-native package export it?
  │  └─ YES → Use @metamask/design-system-react-native [STOP]
  │
  ├─ Is it Tabs, a Modal/Sheet wrapper, Picker*, Cell*, Accordion, TagUrl, an
  │  Account/Multichain component, or another component genuinely not exported by
  │  @metamask/design-system-react-native?
  │  └─ YES → Use app/component-library [STOP]
  │     (NOT Text, Tag, Label, TextField, Card, Toast, Banner*, BottomSheet*, or the
  │      Button/Avatar/Badge families — the design system exports all of them and the
  │      component-library copies are @deprecated)
  │     (Skeleton is the one inversion: import it from
  │      app/component-library/components-temp/Skeleton, which disables autoPlay in tests)
  │
  ├─ Is it feature-specific UI (e.g., BridgeInputSelector, StakeInputView)?
  │  ├─ Does it already exist? (search codebase for similar components)
  │  │  ├─ YES → Reuse existing component [STOP]
  │  │  └─ NO → Build new component using design system primitives [STOP]
  │  └─
  │
  └─ Can I compose it from Box + Text + other primitives?
     ├─ YES → Compose from design system [STOP]
     └─ NO → Consider if custom implementation is truly necessary
```

### Why This Hierarchy Matters
- **Consistency**: Design system ensures consistent look, feel, and behavior
- **Maintenance**: Centralized updates benefit all consumers
- **Accessibility**: Design system components include a11y best practices
- **Performance**: Optimized implementations tested at scale
- **Type Safety**: Full TypeScript support with JSDoc documentation

## Required Availability Check

Before choosing `app/component-library` or building custom UI, inspect the consumer repo's installed package. Do not rely on this skill's examples as a complete component list.

1. Check `node_modules/@metamask/design-system-react-native/dist/components/index.d.cts` for exported components and enums.
2. If the package uses a different build layout, inspect `node_modules/@metamask/design-system-react-native/dist/components/index.d.ts` or `node_modules/@metamask/design-system-react-native/src/components/index.ts`.
3. Read the matching component type file before writing usage, for example `dist/components/<Component>/<Component>.types.d.cts`.
4. If `node_modules` is unavailable, check `package.json`/lockfile for the installed package version and inspect the package source only as a fallback.

This lookup costs a few file reads, but it prevents stale skill guidance from overriding the version actually installed in Mobile. The package version is the source of truth.

## Required Imports for React Native

```tsx
// ALWAYS prefer these imports
import { useTailwind } from '@metamask/design-system-twrnc-preset';
import {
  Box,
  Text,
  Button,
  ButtonBase,
  ButtonFilter,
  ButtonHero,
  ButtonIcon,
  ButtonSemantic,
  BottomSheet,
  BottomSheetDialog,
  BottomSheetHeader,
  BottomSheetFooter,
  BottomSheetOverlay,
  ButtonsAlignment,
  HeaderBase,
  HeaderRoot,
  HeaderSearch,
  HeaderStandard,
  HeaderSubpage,
  Icon,
  IconAlert,
  MainActionButton,
  TabEmptyState,
  TextVariant,
  FontWeight,
  ButtonBaseSize,
  TitleHub,
  TitleStandard,
  TitleSubpage,
  BoxFlexDirection,
  BoxAlignItems,
  BoxJustifyContent,
  // Form & controls
  Input,
  TextField,
  TextFieldSearch,
  TextArea,
  Label,
  HelpText,
  HelpTextSeverity,
  Checkbox,
  RadioButton,
  Switch,
  Slider,
  SegmentedControl,
  SelectButton,
  // Lists & selection
  ListItem,
  ListItemSelect,
  ListItemMultiSelect,
  ActionListItem,
  KeyValueRow,
  KeyValueColumn,
  KeyValueSelect,
  // Data display
  Card,
  Content,
  Tag,
  TagSeverity,
  SensitiveText,
  // Feedback
  BannerAlert,
  BannerAlertSeverity,
  BannerBase,
  Toast,
  Toaster,
  toast,
  // Structure
  SectionHeader,
  SectionDivider,
  FilterButton,
  FilterButtonGroup,
  // ... other design system components
} from '@metamask/design-system-react-native';

// Exception: Skeleton comes from the repo wrapper, not the package —
// the wrapper disables `autoPlay` when running under Jest.
import Skeleton from 'app/component-library/components-temp/Skeleton';
```

## Component Documentation Access

### Type Definitions & JSDoc Comments
All @metamask/design-system-react-native components have comprehensive TypeScript definitions with JSDoc comments:

- **Box**: `/node_modules/@metamask/design-system-react-native/dist/components/Box/Box.types.d.cts`
- **Text**: `/node_modules/@metamask/design-system-react-native/dist/components/Text/Text.types.d.cts`
- **Button**: `/node_modules/@metamask/design-system-react-native/dist/components/Button/Button.types.d.cts`
- **BottomSheet**: `/node_modules/@metamask/design-system-react-native/dist/components/BottomSheet/BottomSheet.types.d.cts`
- **BottomSheetDialog**: `/node_modules/@metamask/design-system-react-native/dist/components/BottomSheetDialog/BottomSheetDialog.types.d.cts`
- **BottomSheetHeader**: `/node_modules/@metamask/design-system-react-native/dist/components/BottomSheetHeader/BottomSheetHeader.types.d.cts`
- **BottomSheetFooter**: `/node_modules/@metamask/design-system-react-native/dist/components/BottomSheetFooter/BottomSheetFooter.types.d.cts`
- **HeaderBase**: `/node_modules/@metamask/design-system-react-native/dist/components/HeaderBase/HeaderBase.types.d.cts`
- **HeaderSearch**: `/node_modules/@metamask/design-system-react-native/dist/components/HeaderSearch/HeaderSearch.types.d.cts`
- **HeaderStandard**: `/node_modules/@metamask/design-system-react-native/dist/components/HeaderStandard/HeaderStandard.types.d.cts`
- **Form components**: `/node_modules/@metamask/design-system-react-native/dist/components/{TextField,TextFieldSearch,TextArea,Label,HelpText,Input}/*.types.d.cts`
- **Lists**: `/node_modules/@metamask/design-system-react-native/dist/components/{ListItem,ListItemSelect,ListItemMultiSelect,ActionListItem,KeyValueRow}/*.types.d.cts`
- **Feedback**: `/node_modules/@metamask/design-system-react-native/dist/components/{BannerAlert,BannerBase,Toast,Tag}/*.types.d.cts`

**Cross-platform props live in a shared package.** Many React Native components
declare only `twClassName` locally and inherit the rest from
`@metamask/design-system-shared`. If a `.types.d.cts` file looks suspiciously
short (`Text.types.d.cts` is 12 lines), read the shared type instead:
`/node_modules/@metamask/design-system-shared/dist/types/<Component>/<Component>.types.d.cts`.
That is where `TextVariant`, `TextColor`, `BannerAlertSeverity`, `TagSeverity`,
and the other shared enums are actually defined.

When unsure about component APIs:
1. Read the `.types.d.cts` files for complete prop documentation
2. Reference `app/component-library/components/design-system.stories.tsx` for usage examples
3. Check GitHub source: https://github.com/MetaMask/metamask-design-system/tree/main/packages/design-system-react-native/src/components

### Box Component Quick Reference
- **Spacing**: Use `gap`, `padding*`, `margin*` props with values 0-12 (maps to 0px-48px)
- **Flexbox**: Use `flexDirection`, `alignItems`, `justifyContent` enum props
- **Colors**: Use `backgroundColor` and `borderColor` with semantic tokens
- **Tailwind**: Use `twClassName` for utilities not covered by props

## Styling Rules (ENFORCE STRICTLY)

### ✅ ALWAYS DO:

- Use `const tw = useTailwind();` hook instead of importing twrnc directly
- Use `Box` component instead of `View`
- Use `Text` component with variants instead of raw Text with styles
- Use `twClassName` prop for static styles
- Use `tw.style()` function for interactive/dynamic styles
- Use design system color tokens: `bg-default`, `text-primary`, `border-muted`
- Use component props first: `variant`, `color`, `size`, etc.

### ❌ NEVER SUGGEST:

- `import tw from 'twrnc'` (use useTailwind hook instead)
- `StyleSheet.create()` (use Tailwind classes)
- Raw `View` or `Text` components (use Box/Text from design system)
- Arbitrary color values like `bg-[#3B82F6]` or `text-[#000000]`
- Inline style objects unless for dynamic values
- Mixing multiple styling approaches unnecessarily

## Code Pattern Templates

### Basic Container:

```tsx
const MyComponent = () => {
  const tw = useTailwind();

  return (
    <Box twClassName="w-full bg-default p-4">
      <Text variant={TextVariant.HeadingMd}>Title</Text>
    </Box>
  );
};
```

### Flex Layout:

```tsx
<Box
  flexDirection={BoxFlexDirection.Row}
  alignItems={BoxAlignItems.Center}
  justifyContent={BoxJustifyContent.Between}
  twClassName="gap-3"
>
```

### Interactive Element:

```tsx
<ButtonBase
  twClassName="h-20 flex-1 rounded-lg bg-muted px-0 py-4"
  style={({ pressed }) =>
    tw.style(
      'w-full flex-row items-center justify-center',
      pressed && 'bg-pressed',
    )
  }
>
  <Text fontWeight={FontWeight.Medium}>Button Text</Text>
</ButtonBase>
```

### Pressable with Tailwind:

```tsx
<Pressable
  style={({ pressed }) =>
    tw.style(
      'w-full flex-row items-center justify-between px-4 py-2',
      pressed && 'bg-pressed',
    )
  }
>
```

### Bottom Sheet:

```tsx
import {
  BottomSheet,
  BottomSheetFooter,
  BottomSheetHeader,
  ButtonsAlignment,
} from '@metamask/design-system-react-native';

<BottomSheet ref={sheetRef} goBack={navigation.goBack}>
  {/* Start/end accessories are managed internally, so the back and close
      buttons can only be reached through `backButtonProps`/`closeButtonProps` —
      that is where `accessibilityLabel` and `testID` have to go. */}
  <BottomSheetHeader
    onClose={handleClose}
    closeButtonProps={{ accessibilityLabel: strings('navigation.close') }}
  >
    Title
  </BottomSheetHeader>
  <Box twClassName="px-4 py-3">
    <Text variant={TextVariant.BodyMd}>Content</Text>
  </Box>
  <BottomSheetFooter
    buttonsAlignment={ButtonsAlignment.Horizontal}
    primaryButtonProps={{ children: 'Confirm', onPress: handleConfirm }}
    secondaryButtonProps={{ children: 'Cancel', onPress: handleClose }}
  />
</BottomSheet>
```

## Box Component Best Practices

### Prefer Props Over twClassName for Layout
✅ **DO** - Use typed props for type safety and consistency:
```tsx
<Box
  flexDirection={BoxFlexDirection.Row}
  alignItems={BoxAlignItems.Center}
  justifyContent={BoxJustifyContent.Between}
  gap={3}
  padding={4}
  margin={2}
>
```

❌ **DON'T** - Use twClassName for properties that have dedicated props:
```tsx
<Box twClassName="flex-row items-center justify-between gap-3 p-4 m-2">
```

### When to Use twClassName
Use `twClassName` for:
- Width and height: `w-full`, `h-20`, `w-[337px]`
- Complex positioning: `absolute`, `relative`, `top-0`, `left-0`
- Borders (partial): `rounded-lg`, `border-t`
- Shadows and opacity: `shadow-lg`, `opacity-50`
- Utilities not covered by props: `overflow-hidden`, `z-10`

### Spacing System
- Use numeric props (0-12) for spacing: `padding={4}` = 16px
- Each unit = 4px (so 12 = 48px max)
- For custom spacing beyond 48px, use twClassName: `twClassName="p-20"`

### Color Tokens
Always use semantic color tokens:
```tsx
// ✅ Semantic tokens
<Box backgroundColor={BoxBackgroundColor.BackgroundDefault}>
<Box backgroundColor={BoxBackgroundColor.PrimaryDefault}>
<Box backgroundColor={BoxBackgroundColor.ErrorMuted}>

// ❌ Arbitrary colors
<Box twClassName="bg-[#3B82F6]">
<Box style={{ backgroundColor: '#FF0000' }}>
```

## Component Conversion Guide

| DON'T Use                            | USE Instead                            |
| ------------------------------------ | -------------------------------------- |
| `<View>`                             | `<Box>`                                |
| `<Text style={...}>`                 | `<Text variant={TextVariant.BodyMd}>`  |
| `app/component-library` BottomSheets | `@metamask/design-system-react-native` BottomSheet components |
| `app/component-library` Text / SensitiveText | `@metamask/design-system-react-native` equivalents (note the `TextVariant`/`TextColor` renames) |
| `app/component-library` Banner / BannerAlert / BannerBase | `@metamask/design-system-react-native` BannerAlert / BannerBase (`Error` severity → `Danger`) |
| `app/component-library` Tag          | `@metamask/design-system-react-native` Tag (`label` prop → `children`) |
| `app/component-library` Form components (TextField, TextFieldSearch, Input, Label, HelpText) | `@metamask/design-system-react-native` equivalents |
| `app/component-library` Card / Checkbox / RadioButton / SelectButton / Toast | `@metamask/design-system-react-native` equivalents |
| `app/component-library` Button, Avatar, Badge, Icon, HeaderBase families | `@metamask/design-system-react-native` equivalents |
| `app/component-library` ListItem / ListItemSelect / ListItemMultiSelect | `@metamask/design-system-react-native` equivalents |
| `app/component-library/components/Skeleton` | `app/component-library/components-temp/Skeleton` (the Jest-safe wrapper, **not** the package) |
| `StyleSheet.create()`                | `twClassName="..."`                    |
| `style={{ backgroundColor: 'red' }}` | `twClassName="bg-error-default"`       |
| `flexDirection: 'row'`               | `flexDirection={BoxFlexDirection.Row}` |
| Manual padding/margin                | `twClassName="p-4 m-2"`                |

## Platform-Specific Gotchas

### ScrollView Inside BottomSheet
When using a `ScrollView` inside a `BottomSheet`, you **MUST** import `ScrollView` from `react-native-gesture-handler`, not from `react-native`. The standard React Native `ScrollView` will not scroll on Android within a gesture-handler-managed `BottomSheet`.

```tsx
// ✅ CORRECT - works on both iOS and Android
import { ScrollView } from 'react-native-gesture-handler';

// ❌ WRONG - will not scroll on Android inside BottomSheet
import { ScrollView } from 'react-native';
```

## Legacy Code Migration Guidelines

### Identifying Legacy Patterns
🚫 **Anti-patterns to refactor when encountered:**
- Files using `StyleSheet.create()`
- Separate `.styles.ts` or `.styles.tsx` files
- Raw `View` components instead of `Box`
- Raw `Text` components with custom styles instead of design system `Text` with variants
- Inline style objects for static styles

### Migration Priority
1. **High Priority**: Components being actively modified
2. **Medium Priority**: Frequently used shared components in `app/component-library`
3. **Low Priority**: Stable legacy components with no active development

### Migration Steps
1. Replace `View` → `Box` from design system
2. Replace `Text` → `Text` with appropriate `TextVariant`
3. Replace migrated component-library imports with design system exports when available
4. Convert `StyleSheet.create()` styles → `twClassName` props or `tw.style()`
5. Convert arbitrary colors → design system color tokens
6. Delete `.styles.ts` files after migration
7. Test thoroughly - layout can shift during migration

### A Matching Name Is Not a Drop-In Swap

The same identifier exported from both places usually has a different API — the
deprecation notices themselves say "The API may have changed — compare props
before migrating." Read the shared types before rewriting call sites, and expect
snapshot churn. Known differences:

- **`TextVariant` members and values both differ.** Legacy is
  `TextVariant.BodyMD` resolving to `'sBodyMD'`; the design system is
  `TextVariant.BodyMd` resolving to `'body-md'`. A find-and-replace that only
  fixes the import will type-check in some cases and still render the wrong style.
- **`TextColor` members are renamed, not just recased.** Legacy
  `TextColor.Default`/`Muted`/`Error` become `TextColor.TextDefault`/`TextMuted`/
  `ErrorDefault`.
- **`BannerAlertSeverity.Error` no longer exists.** Legacy severities are
  `Info`/`Success`/`Warning`/`Error` (values `'Info'`…); the design system uses
  `Neutral`/`Info`/`Success`/`Warning`/`Danger` (values `'neutral'`…). Migrating an
  error banner means `Error` → `Danger`, so this swap is **not** a pure rename.
- **`Tag` swaps `label` for `children`.** Legacy `Tag` takes a `label` string;
  the design system `Tag` renders `children` and adds `severity`,
  `startAccessory`, and `endAccessory`.
- **`BannerAlert` prefers props over nested children.** `BannerBase` exposes
  `title`, `description`, `actionButtonLabel`, `actionButtonLayout`, and
  `startAccessory`; reach for those before nesting a `Text` child.
- **Header accessories are internal.** `BottomSheetHeader` omits
  `startAccessory`/`endAccessory` entirely — pass `accessibilityLabel` and
  `testID` through `backButtonProps`/`closeButtonProps` instead.
- **Enums are const objects, not TS enums.** Design system variants, severities,
  and Box props are all declared as `const` objects with a derived union type
  (`export type TextVariant = (typeof TextVariant)[keyof typeof TextVariant]`),
  whereas the legacy equivalents are real TypeScript `enum`s. They cannot be used
  in positions that require an `enum` — a mapped type such as
  `{ [key in BannerAlertSeverity]: IconName }` still works, but `enum`-only
  reflection does not.

### Example Migration

**Before:**
```tsx
import { View, Text, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
});

<View style={styles.container}>
  <Text style={styles.title}>Title</Text>
</View>
```

**After:**
```tsx
import { useTailwind } from '@metamask/design-system-twrnc-preset';
import { Box, Text, TextVariant, BoxFlexDirection, BoxAlignItems, FontWeight } from '@metamask/design-system-react-native';

const tw = useTailwind();

<Box
  flexDirection={BoxFlexDirection.Row}
  alignItems={BoxAlignItems.Center}
  twClassName="p-4 bg-default"
>
  <Text variant={TextVariant.BodyMd} fontWeight={FontWeight.Medium}>
    Title
  </Text>
</Box>
```

## Error Prevention & Code Review Checklist

### Before Committing Code, Verify:
- [ ] No `import tw from 'twrnc'` (must use `useTailwind()` hook)
- [ ] No raw `View` components (use `Box`)
- [ ] No raw `Text` without variants (use `Text` with `TextVariant`)
- [ ] No component-library BottomSheet imports when design system exports cover the use case
- [ ] No imports of `@deprecated` component-library duplicates (Text, Tag, Label, Form components, Card, Checkbox, RadioButton, SelectButton, Toast, Banner\*, Button\*, Avatar\*, Badge\*, ListItem\*, Icon, HeaderBase\*)
- [ ] `Skeleton` imported from `app/component-library/components-temp/Skeleton`, not from the package
- [ ] Enum members updated, not just import paths (`TextVariant.BodyMD` → `BodyMd`, `TextColor.Default` → `TextDefault`, `BannerAlertSeverity.Error` → `Danger`)
- [ ] No `StyleSheet.create()` (use `twClassName` or `tw.style()`)
- [ ] No arbitrary color values (use design system tokens)
- [ ] No separate `.styles.ts` files for new components
- [ ] Component props used before `twClassName` for layout
- [ ] Interactive styles use `tw.style()` with state functions
- [ ] `ScrollView` inside `BottomSheet` imported from `react-native-gesture-handler` (not `react-native`)

### When You See These Patterns, IMMEDIATELY Suggest Alternatives:
- Any `import tw from 'twrnc'` → `import { useTailwind } from '@metamask/design-system-twrnc-preset'`
- Any `View` component → `Box` from design system
- Any `app/component-library/components/BottomSheets/*` import → equivalent `@metamask/design-system-react-native` BottomSheet export
- Any import of a component-library path carrying an `@deprecated` marker (`Texts/Text`, `Tags/Tag`, `Form/*`, `Cards/Card`, `Checkbox`, `RadioButton`, `Select/SelectButton`, `Toast`, `Banners/*`, `Buttons/*`, `Avatars/*`, `Badges/*`, `List/ListItem*`, `Icons/Icon`, `HeaderBase`, `components-temp/{ActionListItem,KeyValueRow,SectionHeader,Title*,MainActionButton,TabEmptyState,ButtonFilter,ButtonHero,ButtonSemantic,HeaderRoot,HeaderSearch}`) → equivalent `@metamask/design-system-react-native` export, adjusting enum members and props per "A Matching Name Is Not a Drop-In Swap"
- Any `app/component-library/components/Skeleton` import → `app/component-library/components-temp/Skeleton`
- Any `StyleSheet` usage → Tailwind classes
- Any arbitrary color values → Design system tokens
- Any manual flex properties → Box component props + twClassName

### AI Agent Guidelines
When suggesting code changes:
1. ALWAYS read component type definitions first for accurate API usage
2. ALWAYS check `design-system.stories.tsx` for real-world patterns
3. ALWAYS search for existing feature-specific components before building new ones (use Glob/Grep to find similar components in feature directories)
4. REJECT any suggestions that violate the hierarchy
5. SUGGEST migrations when encountering legacy patterns
6. EXPLAIN why design system approach is preferred

## Design System Priority

Before suggesting any UI solution:

1. Check if `@metamask/design-system-react-native` has the component
2. Use component's built-in props (variant, color, size)
3. Add layout/spacing with `twClassName`
4. Add interactions with `tw.style()`
5. Only suggest component-library or custom components if design system lacks it

## Reference Examples

Always reference the patterns from `app/component-library/components/design-system.stories.tsx` for proper usage examples.

## Enforcement

- REJECT any code suggestions that use StyleSheet.create()
- REJECT raw View/Text usage when Box/Text components exist
- REQUIRE useTailwind hook for all Tailwind usage
- REQUIRE design system components as first choice
- ENFORCE design token usage over arbitrary values

@app/component-library/components/design-system.stories.tsx
