---
repo: metamask-extension
parent: recipe-pr-review
---

# MetaMask Extension

For Extension PRs, recipe review should separate popup UI claims, full-screen UI claims, service worker/controller claims, and dapp interaction claims.

Prefer recipes for behavior that spans browser contexts, extension state, dapp permissions, network changes, transaction flows, or migration/runtime state. For reducers and selectors, ask for focused tests unless user-facing runtime proof is needed.
