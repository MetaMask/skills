---
repo: metamask-mobile
parent: recipe-pr-review
---

# MetaMask Mobile

For Mobile PRs, recipe review should pay special attention to simulator state, wallet fixture setup, feature flags, navigation paths, selected account, selected network, permissions, and flaky async UI states.

Prefer recipes for flows that cross navigation, wallet state, network state, transaction state, or controller/UI boundaries. For simple pure functions, ask for focused tests instead.
