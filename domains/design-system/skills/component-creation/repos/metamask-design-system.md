---
repo: metamask-design-system
parent: component-creation
---

# MMDS monorepo commands

Run from the repository root.

```bash
# Scaffold (both platforms)
yarn create-component:react --name ComponentName --description "Brief description"
yarn create-component:react-native --name ComponentName --description "Brief description"

# Verify
yarn build
yarn test
yarn test --coverage
yarn lint
yarn build-storybook
```

Script options and README templates are in the repository's `docs/`
(`create-component.md`, `component-readme-examples/`).
