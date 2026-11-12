---
repo: metamask-design-system
parent: content-guidelines
---

# MetaMask Content Design Guidelines — Design System

Shared rules are in the content-guidelines skill. This overlay is the MMDS
monorepo only: which strings the rules cover there. If the two seem to
disagree, follow the shared skill.

## Where the rules apply

User-facing sample copy in:

- Stories and story args in both platform packages.
- Component `.constants.ts` defaults, including default `loadingText`, alt,
  and accessibility strings.
- README examples (`README.mdx` for React, `README.md` for React Native).
- Create-component script templates.
- Tests that assert those strings. Update them when the string changes.

## Where they do not apply

Storybook meta `title` and story `name` (sidebar labels), TypeScript
identifiers, JSDoc that describes an API, `CHANGELOG.md`, and historical
examples in `MIGRATION.md`.

## Component-specific copy

Prop-level copy guidance (titles, descriptions, button labels) lives in each
component's README. Read it before writing or reviewing copy for that
component. Where it disagrees with the shared skill, follow the shared skill
and fix the README.
