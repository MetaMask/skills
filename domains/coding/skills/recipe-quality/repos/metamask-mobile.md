---
repo: metamask-mobile
parent: recipe-quality
---

# MetaMask Mobile Review Notes

Check these Mobile-specific risks:

- Is the simulator/device, platform, build type, and app state stated?
- Is the wallet unlocked through a fixture or documented primitive?
- Are account, balance, network, permissions, and feature flags deterministic?
- Does the recipe use existing page objects, test ids, fixtures, and state evaluators where available?
- Does each screenshot happen after `wait_for`, route assertion, or `eval_ref`?
- Does teardown prevent balances, pending transactions, selected network, permissions, or onboarding state from leaking into the next run?
- If `/recipe-wallet-control` appears, is it just the implementation layer for named wallet actions?

Fail Mobile recipes that prove a visible flow only through runtime state while skipping the user path.
