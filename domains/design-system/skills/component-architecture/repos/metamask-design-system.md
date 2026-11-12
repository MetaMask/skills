---
repo: metamask-design-system
parent: component-architecture
---

# MMDS monorepo

- Shared types live in `@metamask/design-system-shared` under
  `src/types/<ComponentName>/`, and are exported from that package's
  `src/index.ts` with the inline `type` keyword.
- Platform packages: `@metamask/design-system-react` and
  `@metamask/design-system-react-native`, one folder per component under
  `src/components/<ComponentName>/`.
- Import packages by name, never by relative path across packages.
- Run every command from the repository root (`yarn build`, `yarn test`,
  `yarn lint`, or `yarn workspace <package> run <script>`). Never `cd` into a
  package.
