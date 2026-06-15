---
name: metamask-connect
description: Build dApps that integrate MetaMask via the MetaMask Connect SDK — EVM (@metamask/connect-evm), Solana (@metamask/connect-solana), and multichain (@metamask/connect-multichain), plus the wagmi metaMask() connector. Covers client setup across browser/React/React Native, connecting, signing messages, sending transactions, multichain invokeMethod across CAIP-2 scopes, migrating from @metamask/sdk, and troubleshooting connection/polyfill issues.
---

# MetaMask Connect SDK

## When to use

- You want to set up a dApp's MetaMask integration — EVM, Solana, or both (multichain) — in vanilla browser JS/TS, React, or React Native
- You want to connect/disconnect, manage the provider and session state, or switch chains
- You want to sign messages (`personal_sign`, `eth_signTypedData_v4`, Solana `signMessage`) — e.g. Sign-In With Ethereum or nonce auth
- You want to send transactions (`eth_sendTransaction`, Solana `sendTransaction` / `signAndSendTransaction`)
- You want to operate across chains through the multichain client's `invokeMethod`
- You want to use or migrate to the wagmi `metaMask()` connector
- You want to migrate an existing `@metamask/sdk` integration to the Connect SDK
- You need to diagnose connection failures, React Native polyfill errors, or QR/deeplink issues

## Installation

Pick the client for your integration:

| You need | Package | Factory |
|----------|---------|---------|
| EVM only | `@metamask/connect-evm` | `createEVMClient` |
| Solana only | `@metamask/connect-solana` | `createSolanaClient` |
| EVM **and** Solana in one session | `@metamask/connect-multichain` | `createMultichainClient` |
| You already use wagmi | wagmi `metaMask()` connector (needs `@metamask/connect-evm` as a peer) | — |

## Always-on conventions

Before writing or reviewing **any** MetaMask Connect code, read [references/conventions.md](references/conventions.md) — hex chain IDs, `supportedNetworks` validation, EIP-1193 provider events, multichain session lifecycle, Solana constraints, React Native polyfills, and testing patterns. Apply it alongside every workflow below.

## Set up (choose your stack)

| Building | Workflow |
|----------|----------|
| EVM dApp — vanilla browser JS/TS | [workflows/setup-evm-browser.md](workflows/setup-evm-browser.md) |
| EVM dApp — React | [workflows/setup-evm-react.md](workflows/setup-evm-react.md) |
| EVM dApp — React Native | [workflows/setup-evm-react-native.md](workflows/setup-evm-react-native.md) |
| Solana dApp — vanilla browser | [workflows/setup-solana-browser.md](workflows/setup-solana-browser.md) |
| Solana dApp — React | [workflows/setup-solana-react.md](workflows/setup-solana-react.md) |
| Solana dApp — React Native | [workflows/setup-solana-react-native.md](workflows/setup-solana-react-native.md) |
| EVM + Solana (multichain) | [workflows/setup-multichain.md](workflows/setup-multichain.md) |
| wagmi app | [workflows/setup-wagmi.md](workflows/setup-wagmi.md) |
| wagmi + the connect-evm connector | [workflows/setup-wagmi-connector.md](workflows/setup-wagmi-connector.md) |

## Sign & send (single-chain clients)

Use these with a directly-created EVM or Solana client. If you set up the **multichain** client, sign/send via `invokeMethod` instead — see the multichain workflows below.

| Task | Workflow |
|------|----------|
| Sign — EVM (`personal_sign`, `eth_signTypedData_v4`, `connectAndSign`) | [workflows/sign-evm-message.md](workflows/sign-evm-message.md) |
| Sign — Solana (wallet-standard `signMessage`) | [workflows/sign-solana-message.md](workflows/sign-solana-message.md) |
| Send — EVM (`eth_sendTransaction`, gas, receipts, `connectWith`) | [workflows/send-evm-transaction.md](workflows/send-evm-transaction.md) |
| Send — Solana (`sendTransaction` / `signAndSendTransaction`) | [workflows/send-solana-transaction.md](workflows/send-solana-transaction.md) |

## Multichain operations (`invokeMethod` across CAIP-2 scopes)

Use these after `createMultichainClient` to sign or send across CAIP-2 scopes.

| Ecosystem | Workflow |
|-----------|----------|
| EVM scopes (`eth_sendTransaction`, `personal_sign`, `eth_signTypedData_v4`) | [workflows/multichain-evm-operations.md](workflows/multichain-evm-operations.md) |
| Solana scopes (`signTransaction`, `signAndSendTransaction`, `signMessage`) | [workflows/multichain-solana-operations.md](workflows/multichain-solana-operations.md) |

## Migrate

| Migrating from | Workflow |
|----------------|----------|
| `@metamask/sdk` → `@metamask/connect-*` | [workflows/migrate-from-sdk.md](workflows/migrate-from-sdk.md) |
| wagmi app → the new `@metamask/connect-evm` connector | [workflows/migrate-wagmi-connector.md](workflows/migrate-wagmi-connector.md) |

## Troubleshooting

When a connection hangs/fails, a React Native app crashes on a missing polyfill, QR codes or deeplinks don't work, the Solana wallet adapter doesn't detect MetaMask, or a session is lost after reload — see [references/troubleshooting.md](references/troubleshooting.md) for a symptom → cause → fix index and a diagnostic checklist.

## Important notes

These are the highest-value guardrails; [references/conventions.md](references/conventions.md) has the full, source-verified set.

- EVM chain IDs are **hex strings** (`'0x1'`, not `1` or `'1'`); CAIP-2 scopes use **decimal** (`eip155:1`).
- Every chain the dApp touches must be in `api.supportedNetworks` with a reachable RPC URL — the check runs in the provider's `request()` path, not in `connect()`.
- The multichain core is a **singleton** — create clients once at startup, never inside a React render.
- Handle EIP-1193 code `4001` (user rejected) and `-32002` (extension request pending) in `catch` blocks; multichain `invokeMethod` errors arrive wrapped in `RPCInvokeMethodErr` (original code on `rpcCode`).
- React Native needs polyfills (a `window` shim always; `Event`/`CustomEvent` only when also using wagmi; `react-native-get-random-values` as the first import) plus metro `extraNodeModules` shims (`stream` → `readable-stream`, the rest → empty stubs).

## Resources

- NPM: `@metamask/connect-evm`, `@metamask/connect-solana`, `@metamask/connect-multichain`
- Source plugin: https://github.com/MetaMask/metamask-connect-cursor-plugin
- Provenance: generated from that plugin's `skills/` and always-on `rules/`, source-verified against the published `@metamask/connect-*` packages.
