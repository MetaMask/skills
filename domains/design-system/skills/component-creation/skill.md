---
name: component-creation
description: >-
  Step-by-step creation of a new MetaMask Design System (MMDS) component in
  both React and React Native: scaffold with the repo scripts, replace the
  non-compliant template with shared types, Box and Text composition, and
  design tokens, then add stories, tests, README, and verify build and
  coverage. Use when asked to create, add, scaffold, or build a new MMDS
  component, or when component-migration reaches its creation step.
maturity: stable
---

# Create an MMDS component

How to build a new component in the MMDS monorepo. The type rules are in
`component-architecture`; this skill sequences them.

Lookup order: `knowledge/mmds-sources.md` (source:
[`../../knowledge/mmds-sources.md`](../../knowledge/mmds-sources.md)).

## When to use

- A new component with no Extension or Mobile predecessor.
- The creation step of `component-migration`.

Out of scope: moving an existing component to shared types
(`component-migration`), and Mobile app-level components
(`component-scaffold` in `metamask-mobile`).

## Workflow

### 1. Check that it does not exist

Work through the lookup order: the manifests and Storybook docs, the Design
Brain when Notion is available, READMEs, and the monorepo source. Do not
create a component whose job an existing one already does.

### 2. Scaffold both platforms with the scripts

Always use the create-component scripts (see the repository overlay). Never
create the files by hand. Create the component on both platforms.

The generated templates are not ADR-compliant. Transform them in the steps
below.

### 3. Shared types

Follow `component-architecture`: const objects, component-scoped prop
consts (alias a base scale when the values match), a
`<ComponentName>PropsShared` type declared with `type`, platform-independent
props only, exported from the shared package index with the inline `type`
keyword.

### 4. Platform types and exports

- `<ComponentName>.types.ts` imports the shared props type and extends it.
  It does not re-export const objects.
  - React: `ComponentProps<'element'>` plus `className?: string` and
    `style?: React.CSSProperties`.
  - React Native: `ViewProps` or `PressableProps` plus `twClassName?: string`.
- `index.ts` is the only place const objects are exported, directly from
  `@metamask/design-system-shared`.
- Import order: shared before platform, type imports before values.

```ts
// index.ts
export {
  ComponentNameVariant,
  ComponentNameSize,
} from '@metamask/design-system-shared';
export { ComponentName } from './ComponentName';
export type { ComponentNameProps } from './ComponentName.types';
```

### 5. Implementation

- Replace template `div` / `span` / `View` / `Text` with `Box` and `Text`.
  Use `Button` rather than building button chrome.
- Style with component props and design tokens first (see `ui-development`,
  `metamask-design-system` overlay, for library styling mechanics). Use the
  const objects the installed types expose; read them from `Box` and `Text`
  types rather than guessing member names.
- Forward refs with `forwardRef` and set `displayName`.

```tsx
export const ComponentName = forwardRef<RefType, ComponentNameProps>(
  ({ children, ...props }, ref) => (
    <Box ref={ref} {...props}>
      <Text>{children}</Text>
    </Box>
  ),
);
ComponentName.displayName = 'ComponentName';
```

### 6. Stories, tests, README, Code Connect

- Stories and README: `component-documentation`. React uses `README.mdx`,
  React Native uses `README.md`.
- Tests: `component-testing`.
- Code Connect, when a Figma component exists: `figma-code-connect`.

### 7. Verify

Build, test, lint, and build Storybook from the repository root (commands in
the overlay). Coverage thresholds are 100%; a duplicate const export from
`.types.ts` is the usual cause of a miss.

## Checklist

- [ ] Scaffolded with the scripts, on both platforms.
- [ ] `component-architecture` checklist passes.
- [ ] Template elements replaced with `Box` and `Text`; tokens, not raw values.
- [ ] `forwardRef` and `displayName`.
- [ ] Stories, tests, and README on both platforms; same sections and story
      names on both.
- [ ] Build, tests (100% coverage), lint, and Storybook build pass.
