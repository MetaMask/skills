---
name: setup-app
description: Scaffold a dApp that integrates MetaMask via the MetaMask Connect SDK — EVM, Solana, or both (multichain) — across vanilla browser JS/TS, React, and React Native, or through wagmi. Use when starting a new MetaMask integration or wiring connect/disconnect and provider setup. Routes to per-stack references covering createEVMClient, createSolanaClient, createMultichainClient, and the wagmi metaMask() connector, including EIP-1193 provider events, chain switching with chainConfiguration, Solana wallet-standard, React Native polyfills, and metro config.
maturity: stable
---
# Set Up a MetaMask Connect dApp

## When to use

Use this when you are **starting or wiring up** a dApp's MetaMask integration: choosing a Connect SDK package, creating the client, and getting connect/disconnect + the provider working. For signing, sending transactions, or migrating, see the `sign-message`, `send-transaction`, `multichain-operations`, and `migrate` skills.

## 1. Choose your client

| You need | Package | Then read |
|----------|---------|-----------|
| EVM only | `@metamask/connect-evm` (`createEVMClient`) | an `evm-*` reference below |
| Solana only | `@metamask/connect-solana` (`createSolanaClient`) | a `solana-*` reference below |
| EVM **and** Solana in one session | `@metamask/connect-multichain` (`createMultichainClient`) | `references/multichain.md` |
| You already use wagmi | wagmi `metaMask()` connector | `references/wagmi.md` |

## 2. Read the reference for your stack

| Building | Reference |
|----------|-----------|
| EVM dApp — vanilla browser JS/TS | [`references/evm-browser.md`](references/evm-browser.md) |
| EVM dApp — React | [`references/evm-react.md`](references/evm-react.md) |
| EVM dApp — React Native | [`references/evm-react-native.md`](references/evm-react-native.md) |
| Solana dApp — vanilla browser | [`references/solana-browser.md`](references/solana-browser.md) |
| Solana dApp — React | [`references/solana-react.md`](references/solana-react.md) |
| Solana dApp — React Native | [`references/solana-react-native.md`](references/solana-react-native.md) |
| EVM + Solana (multichain) | [`references/multichain.md`](references/multichain.md) |
| wagmi app | [`references/wagmi.md`](references/wagmi.md) |
| wagmi + the connect-evm connector | [`references/wagmi-connector.md`](references/wagmi-connector.md) |

Always apply the `metamask-connect-conventions` skill (hex chain IDs, singleton behavior, EIP-1193 events, Solana constraints, React Native polyfills) alongside whichever reference you follow.
