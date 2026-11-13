---
repo: metamask-design-system
parent: component-migration
---

# MMDS monorepo

- Consumer repositories: [metamask-extension](https://github.com/MetaMask/metamask-extension)
  (React, `@metamask/design-system-react`) and
  [metamask-mobile](https://github.com/MetaMask/metamask-mobile) (React Native,
  `@metamask/design-system-react-native`). Search each repo for the existing
  component; do not assume a folder.
- Migration guides: `MIGRATION.md` in each platform package. The two-phase
  strategy is in `docs/component-migration-strategy.md`.
- Verify from the repository root:

```bash
yarn build && yarn test && yarn lint
yarn test --coverage
yarn build-storybook
```
