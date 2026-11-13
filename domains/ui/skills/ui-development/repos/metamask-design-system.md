---
repo: metamask-design-system
parent: ui-development
---

# MetaMask Design System overlay

Styling mechanics for work inside the MMDS monorepo: components, stories, and
the Storybook apps. The base above holds the foundations (tokens, typography,
deprecation, accessibility floor) and applies here too. Component types and
architecture are in the `design-system` skills
([index](https://github.com/MetaMask/skills/blob/main/domains/design-system/knowledge/mmds-sources.md)).

## Sources in this repository

- The packages on your branch are the source. Where the base says "installed
  types in `node_modules`", read the workspace package source instead. To see
  what a consumer has, read the README and types on GitHub at the package's
  release tag.
- The hosted manifests track `main`; build Storybook locally to get the
  manifest for your branch (`component-documentation` overlay).

## Component first

- Compose from MMDS components (`Box`, `Text`, `Button`, and the rest of
  the package) over raw `div`, `span`, `p`, or `View`.
- Prefer a component prop over `className` or `twClassName`. Use the class
  prop only when no equivalent prop exists (`flex-1`, hover and pressed
  states, media queries).
- Set type with `Text`, never with text-size classes.
- Read prop names and const objects from `Box` and `Text` types rather than
  guessing them.

## React web

- `className` for preset classes. Never mix an inline `style` with classes
  for the same concern.
- Interactive states with preset state classes on the element (for example
  through `Box`'s `asChild` on a native `button`).
- Web accessibility and element mechanics are the same as in the
  [Extension overlay](https://github.com/MetaMask/skills/blob/main/domains/ui/skills/ui-development/repos/metamask-extension.md).

## React Native

- `useTailwind()` from `@metamask/design-system-twrnc-preset`, `twClassName`,
  and `tw.style()` for conditionals follow the
  [Mobile overlay](https://github.com/MetaMask/skills/blob/main/domains/ui/skills/ui-development/repos/metamask-mobile.md),
  including never importing `twrnc` directly.
- Never store class strings in variables (`const classes = '...'`, then
  ``tw`${classes}` ``). It breaks Tailwind IntelliSense and linting. Pass
  literals to `tw.style()`.
- When a component applies its own classes and also accepts `style`, put its
  classes and the caller's `style` in an array, and forward `twClassName` as a
  prop rather than merging it into `style`:

```tsx
<Inner
  style={[tw.style('<own classes>'), style]}
  twClassName={twClassName}
/>
```

## Tailwind content scanning

Token-identity const values live in the shared package and must be scanned
by the consumer's Tailwind config. The rule and its consequences are in
`component-architecture` (Const values in shared). Never add a safelist.

## Verify

`yarn lint` validates classes; `yarn lint:fix` fixes class order. Run from
the repository root.

## MMDS checklist

- [ ] MMDS components over raw elements; props over class props.
- [ ] No class strings in variables; no inline style mixed with classes.
- [ ] React Native: `useTailwind()` from the preset; style arrays forward
      `twClassName` as a prop.
- [ ] `yarn lint` passes.
