---
repo: metamask-design-system
parent: component-testing
---

# MMDS monorepo commands

```bash
yarn workspace @metamask/design-system-react test
yarn workspace @metamask/design-system-react test:verbose
yarn workspace @metamask/design-system-react-native test
yarn workspace @metamask/design-system-react-native test:verbose
yarn workspace @metamask/design-system-react-native test:clean
yarn test --coverage
```

Thresholds and setup are in each platform package's `jest.config.js` and
`jest.setup.js`. Shared MetaMask unit-testing guidance:
[contributor-docs unit testing](https://github.com/MetaMask/contributor-docs/blob/main/docs/testing/unit-testing.md).
