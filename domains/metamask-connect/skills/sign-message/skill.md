---
name: sign-message
description: Sign arbitrary messages with MetaMask in a dApp — EVM (personal_sign, eth_signTypedData_v4, plus the connectAndSign shortcut) and Solana (wallet-standard signMessage, via React wallet-adapter or vanilla browser). Use when adding message signing or wallet authentication such as Sign-In With Ethereum or nonce signing. Routes to per-chain references. For signing through the multichain client's invokeMethod, see the multichain-operations skill.
maturity: stable
---
# Sign Messages with MetaMask Connect

## When to use

Use this to **sign an arbitrary message** (authentication, Sign-In With Ethereum, nonce signing) with a directly-created EVM or Solana client. If you set up the **multichain** client (`createMultichainClient`), sign via `invokeMethod` instead — see the `multichain-operations` skill.

| Chain | Reference |
|-------|-----------|
| EVM (`personal_sign`, `eth_signTypedData_v4`, `connectAndSign`) | [`references/evm.md`](references/evm.md) |
| Solana (wallet-standard `signMessage`) | [`references/solana.md`](references/solana.md) |

Follow the `metamask-connect-conventions` skill for provider/error-handling guardrails.
