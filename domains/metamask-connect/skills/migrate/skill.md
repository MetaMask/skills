---
name: migrate
description: Migrate an existing MetaMask integration to the MetaMask Connect SDK — from @metamask/sdk to @metamask/connect-evm / -multichain / -solana with step-by-step package, API, and config changes, or a wagmi app to the new connect-evm metaMask() connector. Routes to per-path references.
maturity: stable
---
# Migrate to the MetaMask Connect SDK

## When to use

Use this when **moving an existing app** onto the MetaMask Connect SDK.

| Migrating from | Reference |
|----------------|-----------|
| `@metamask/sdk` → `@metamask/connect-*` | [`references/from-sdk.md`](references/from-sdk.md) |
| wagmi app → the new `@metamask/connect-evm` connector | [`references/wagmi-connector.md`](references/wagmi-connector.md) |

After migrating, follow the `metamask-connect-conventions` skill to catch behavior differences (singleton behavior, event payloads, hex chain IDs).
