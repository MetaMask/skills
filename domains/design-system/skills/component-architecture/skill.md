---
name: component-architecture
description: >-
  Foundation architecture for MetaMask Design System (MMDS) components:
  const objects instead of enums (ADR-0003), shared types in
  @metamask/design-system-shared re-exported by the React and React Native
  packages (ADR-0004), component-scoped prop const names, the shared vs
  platform prop split, export and import rules, and cross-platform
  consistency. Use when adding or changing a component's types, props,
  const objects, or exports in the MMDS monorepo, or when reviewing that
  work. Other design-system skills build on this one.
maturity: stable
---

# MMDS component architecture

The architectural contract every MMDS component follows. `component-creation`,
`component-migration`, `component-documentation`, `component-testing`, and
`figma-code-connect` build on it and do not restate it.

Lookup order and skill ownership: `knowledge/mmds-sources.md` (source:
[`../../knowledge/mmds-sources.md`](../../knowledge/mmds-sources.md)).

## When to use

- Adding or changing props, const objects, or types on an MMDS component.
- Deciding whether something belongs in the shared package or a platform
  package.
- Reviewing an MMDS PR for type layering, exports, or imports.

Out of scope: product UI in Extension or Mobile (use `ui-development`), and
step-by-step scaffolding (use `component-creation`).

## Workflow

1. Find a golden path: search the shared package for a component that
   already has a `<ComponentName>PropsShared` type and const objects, and
   whose platform `index.ts` files export them from shared. Mirror it.
2. Put the change in the right layer (below).
3. Run the checklist at the end on your diff.

## Const objects, not enums (ADR-0003)

Use a const object with a derived string union type. Never a TypeScript
`enum`.

```ts
export const ComponentNameVariant = {
  ValueA: 'value-a',
  ValueB: 'value-b',
} as const;
export type ComponentNameVariant =
  (typeof ComponentNameVariant)[keyof typeof ComponentNameVariant];
```

Plain string union props (`size="md"`) need a published team decision and a
coordinated migration first. Until then, ship const objects.

## Component-scoped prop const objects

Every public prop that takes a fixed set of values exposes a const named
`ComponentName` + the prop name in PascalCase. Use the full prop name, not
an abbreviation: a prop `endArrowDirection` gets
`ComponentNameEndArrowDirection`. Consumers import the const for the component
they render, never a base scale or a sibling component's const.

- When the values match an existing base scale in shared, alias it and type
  the shared prop with the alias:

  ```ts
  /** ComponentName size options (ADR-0003). Alias keeps values in sync. */
  export const ComponentNameSize = BaseScaleSize;
  export type ComponentNameSize = BaseScaleSize;

  export type ComponentNamePropsShared = {
    size?: ComponentNameSize;
  };
  ```

- A base scale is valid inside the base implementation and its variants.
  Public shared props, stories, READMEs, and Code Connect use the scoped name.
- A platform type may extend a base component's props, but the component
  still exports its own scoped consts.
- Some shipped consts do not follow this convention. Do not copy them; a
  rename waits for a breaking release.

## Shared types, platform extensions (ADR-0004)

```text
@metamask/design-system-shared        (source of truth)
  ├── @metamask/design-system-react         (re-export + extend)
  └── @metamask/design-system-react-native  (re-export + extend)
```

```ts
// Shared: const objects + `Shared`-suffixed props, using `type`, not `interface`.
export type ComponentNamePropsShared = { variant?: ComponentNameVariant };

// React: extend the host element and add `className`.
export type ComponentNameProps = ComponentProps<'div'> &
  ComponentNamePropsShared & { className?: string };

// React Native: extend `ViewProps` or `PressableProps` and add `twClassName`.
export type ComponentNameProps = ComponentNamePropsShared &
  PressableProps & { twClassName?: string };
```

| Concern | Layer |
| --- | --- |
| Visual variants, sizes, states (`isDisabled`, `isLoading`) | Shared |
| Structure (`children`, `label`, `description`) | Shared |
| Event handlers (`onClick` / `onPress`) | Platform, from the host base type |
| Styling props (`className` / `twClassName`) | Platform |
| Host base types (`ComponentProps<'div'>`, `ViewProps`) | Platform |

- No unified handlers (`onAction`) and no styling props in shared.
- A const that only one platform needs (a behavior the other platform has no
  equivalent for) stays in that platform package beside the component. Export
  it from the component barrel if it is public. Promote it to shared only when
  both platforms need the same contract.
- When a component forwards remaining props to its element, name the
  catch-all `...props` (not `...rest`) and spread `{...props}`.

## Const values in shared

If the class string is identical on both platforms, the value lives in shared
and is used directly. If the platforms need different class strings, shared
holds an abstract value and each platform maps it.

| Kind | Value is | Used as |
| --- | --- | --- |
| Token identity (color, background, border) | The preset class string itself | `className={value}` / `twClassName={value}` |
| Semantic (font weight, font style, font family, text variant) | An abstract identifier | Mapped in each platform's `<ComponentName>.constants.ts` |

Do not turn const values into inline `style={{}}`; preset classes are the
styling approach on both platforms.

Token-identity values are class strings that Tailwind must find. Tailwind
does not merge a preset's `content` globs into the consumer's config, so
consumers add the shared package's built output to their own `content` globs.
New token-identity consts are picked up by any consumer that already scans it.
Do not rely on the preset's `content`, and do not add a safelist.

## Exports and imports

- Export a value and its same-named type with an inline `type` keyword in
  one statement. Separate `export {}` and `export type {}` lines for the same
  name cause "Duplicate identifier".
- A component's `index.ts` exports its const objects directly from
  `@metamask/design-system-shared`. That is the only export location.
- A platform `.types.ts` imports the shared props type and does not re-export
  const objects. A duplicate export creates uncovered code and fails the
  coverage threshold.
- A platform `src/types/index.ts` does not re-export shared types.
- Import shared consts and types from `@metamask/design-system-shared` (their
  owner), never through a sibling component's index. Importing through a
  sibling implies a dependency that does not exist and invites import cycles.

| You need | Import from |
| --- | --- |
| A shared const or type | `@metamask/design-system-shared` |
| A sibling component, or its platform props type | `'../ComponentName'` |
| A sibling's platform mapping constants | `'../ComponentName/ComponentName.constants'` |

## Optional slots

Optional slots (accessories, labels, end nodes) are usually strings or
elements. Render them with plain React: `{slot}`, `condition && <Subtree />`,
or a ternary. Do not add shared `ReactNode` guard helpers, and do not write
`x && x`. Choose the left side of `&&` deliberately if a numeric `0` could
appear. How to test slots: `component-testing`.

## Checklist

- [ ] Const objects, not enums.
- [ ] Every public prop union has a component-scoped const; shared props use
      the scoped type, not a base scale or a sibling's const.
- [ ] Shared types live in `@metamask/design-system-shared` as
      `<ComponentName>PropsShared`, declared with `type`.
- [ ] No styling props and no unified event handlers in shared.
- [ ] React extends the host element and adds `className`; React Native
      extends `ViewProps` or `PressableProps` and adds `twClassName`.
- [ ] Component `index.ts` exports consts directly from shared; `.types.ts`
      and `src/types/index.ts` do not re-export them.
- [ ] Shared consts are imported from shared, not through a sibling.
- [ ] Same shared props, const names, and values on both platforms; platform
      differences only in the extension layer.
