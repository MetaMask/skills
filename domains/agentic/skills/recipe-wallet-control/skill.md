---
name: recipe-wallet-control
description: Control MetaMask debug wallets through harness-backed wallet-aware setup/unlock, account selection, route navigation, screenshots, UI interaction, CDP/state introspection, fixture handling, recovery, and recipe handoff. Use when an agent needs to validate Mobile or Extension wallet behavior end-to-end or collect PR evidence on a live debug runtime.
maturity: experimental
---

# Recipe Wallet Control

**DEBUG BUILDS ONLY.** This skill imports throwaway fixture wallets and reads runtime wallet state. Use only local debug builds and test wallets, per ADR #0058's dev-only verification boundary. Never use production seed phrases, private keys, accounts, or balances.

`recipe-wallet-control` is a harness-backed MetaMask wallet-control layer. It covers manifest-backed Recipe v1 wallet semantics (`metamask.wallet.setup`, `metamask.wallet.ensure_unlocked`, `metamask.wallet.select_account`, `metamask.wallet.read_state`) plus practical UI controls (`ui.navigate`, `ui.press`, `ui.scroll`, `ui.wait_for`, `ui.screenshot`, guarded CDP inspection, recovery, and recipe handoff).

Evidence hygiene: save command logs/screenshots under `/tmp` or repo-local ignored evidence folders; never commit validation artifacts. Redact fixture secrets and avoid dumping full account arrays. Prefer counts, selected account, type/key summaries, and shape-only controller output unless the task explicitly needs a concrete address.

Layering:

1. `simulator-control` / device tools — generic device/browser adapter layer.
2. `recipe-wallet-control` — MetaMask-aware wallet, UI, CDP/state, fixture, and evidence primitives.
3. `/recipe-cook` / recipes — compose these primitives into reusable per-PR validation flows.

Load the repo overlay for the checkout you are controlling:

- MetaMask Mobile: `repos/metamask-mobile.md`
- MetaMask Extension: `repos/metamask-extension.md`

Installed skills include this file plus the matching repo overlay. Source-repo references under `references/` are reviewer/deep-dive material; the overlays intentionally embed the essential commands and snippets so a fresh agent can start without reading a pile of external docs.
