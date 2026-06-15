---
name: multichain-operations
description: Sign and send transactions and messages through the MetaMask Connect multichain client's invokeMethod — EVM (eth_sendTransaction, personal_sign, eth_signTypedData_v4) and Solana (signTransaction, signAndSendTransaction, signMessage). Use after createMultichainClient when performing operations across CAIP-2 scopes, including building Solana transactions with @solana/web3.js, base64 encoding, mainnet/devnet scope selection, RPC routing for read vs sign, and selective disconnect. Routes to per-ecosystem references.
maturity: stable
---
# Operations via the MetaMask Connect Multichain Client

## When to use

Use this when you created a **multichain** client (`createMultichainClient`, see the `setup-app` skill → `references/multichain.md`) and need to **sign or send** across CAIP-2 scopes with `invokeMethod`. For the single-chain `createEVMClient` / `createSolanaClient` paths, use the `sign-message` and `send-transaction` skills instead.

| Ecosystem | Reference |
|-----------|-----------|
| EVM scopes (`eth_sendTransaction`, `personal_sign`, `eth_signTypedData_v4`) | [`references/evm.md`](references/evm.md) |
| Solana scopes (`signTransaction`, `signAndSendTransaction`, `signMessage`) | [`references/solana.md`](references/solana.md) |

Follow the `metamask-connect-conventions` skill, especially the multichain session-lifecycle guardrails.
