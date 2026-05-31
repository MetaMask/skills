---
name: recipe-wallet-control
description: Control MetaMask debug wallets through harness-backed wallet-aware setup/unlock, account selection, route navigation, screenshots, UI interaction, CDP/state introspection, fixture handling, recovery, and recipe handoff. Use when an agent needs to validate Mobile or Extension wallet behavior end-to-end or collect PR evidence on a live debug runtime.
maturity: experimental
---

# Recipe Wallet Control

**DEBUG BUILDS ONLY.** Use only local debug builds and throwaway test wallets. Never use production seed phrases, private keys, accounts, or balances.

`recipe-wallet-control` is a harness-backed MetaMask wallet-control layer. It covers manifest-backed Recipe v1 wallet semantics (`metamask.wallet.setup`, `metamask.wallet.ensure_unlocked`, `metamask.wallet.select_account`, `metamask.wallet.read_state`) plus practical UI controls (`ui.navigate`, `ui.press`, `ui.scroll`, `ui.wait_for`, `ui.screenshot`, guarded CDP inspection, recovery, and recipe handoff).

- Evidence hygiene: save logs/screenshots under `/tmp` or repo-local ignored folders; never commit artifacts. Redact fixture secrets; prefer counts and shape-only output over raw account arrays.

Stack: device tools → recipe-wallet-control → /recipe-cook recipes.

Load the repo overlay for the checkout you are controlling:

- MetaMask Mobile: `repos/metamask-mobile.md`
- MetaMask Extension: `repos/metamask-extension.md`
