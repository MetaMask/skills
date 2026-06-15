---
name: send-transaction
description: Send transactions with MetaMask in a dApp — EVM (eth_sendTransaction with gas estimation and receipt polling, plus the connectWith shortcut) and Solana (React wallet-adapter sendTransaction or vanilla signAndSendTransaction). Use when submitting on-chain transactions. Routes to per-chain references. For sending through the multichain client's invokeMethod, see the multichain-operations skill.
maturity: stable
---
# Send Transactions with MetaMask Connect

## When to use

Use this to **submit an on-chain transaction** with a directly-created EVM or Solana client. If you set up the **multichain** client (`createMultichainClient`), send via `invokeMethod` instead — see the `multichain-operations` skill.

| Chain | Reference |
|-------|-----------|
| EVM (`eth_sendTransaction`, gas, receipts, `connectWith`) | [`references/evm.md`](references/evm.md) |
| Solana (`sendTransaction` / `signAndSendTransaction`) | [`references/solana.md`](references/solana.md) |

Follow the `metamask-connect-conventions` skill for provider/error-handling guardrails.
