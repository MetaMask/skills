---
name: recipe-wallet-control
description: Control MetaMask Mobile debug builds with wallet-aware setup/unlock, route navigation, screenshots, UI interaction, Hermes/CDP state introspection, fixture handling, recovery, and recipe handoff. Use when an agent needs to validate mobile wallet behavior end-to-end or collect PR evidence on a live simulator/emulator.
maturity: experimental
---

# Recipe Wallet Control

**DEBUG BUILDS ONLY.** This skill imports throwaway fixture wallets and reads runtime wallet state. Use only local debug builds and test wallets, per ADR #0058's dev-only verification boundary. Never use production seed phrases, private keys, accounts, or balances.

`recipe-wallet-control` is a MetaMask Mobile agentic-control layer. It covers wallet semantics (`setup-wallet`, `unlock`, account/network/perps state) plus the practical controls needed to validate a real flow (`navigate`, `press`, `set-input`/`type`, `scroll`, `wait-for`, `go-back`, screenshots, guarded CDP/raw eval, recovery, and recipe handoff).

Evidence hygiene: save command logs/screenshots under `/tmp` or repo-local ignored evidence folders; never commit validation artifacts. Redact fixture secrets and avoid dumping full account arrays. Prefer counts, selected account, type/key summaries, and shape-only controller output unless the task explicitly needs a concrete address.

Layering:

1. `simulator-control` / device tools — generic device/browser adapter layer.
2. `recipe-wallet-control` — MetaMask Mobile-aware wallet, UI, Hermes/CDP, fixture, and evidence primitives.
3. `/recipe-cook` / recipes — compose these primitives into reusable per-PR validation flows.

Load the repo overlay for the checkout you are controlling:

- MetaMask Mobile: `repos/metamask-mobile.md`

Installed skills include this file plus the matching repo overlay. Source-repo references under `references/` are reviewer/deep-dive material; the overlays intentionally embed the essential commands and snippets so a fresh agent can start without reading a pile of external docs.

Extension note: full MetaMask Extension fixture/runtime injection is intentionally not carried here. Until that code moves into Extension itself, it belongs in `/recipe-cook` / recipe-runtime tooling where recipes can own browser launch, storage prefill, fixture injection, and reset semantics without overloading this mobile control skill.
