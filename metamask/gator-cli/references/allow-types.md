# Allow Types Reference

This reference lists all allow types available for the `gator grant --allow` flag. See the [Caveats reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/) for the full Smart Accounts Kit documentation.

## Primary Allow Types

High-level types for common delegation patterns. Use these when the user's intent directly maps to one.

| Allow Type | Description | Required Flags | Optional Flags |
|---|---|---|---|
| `erc20TransferAmount` | Limit the total amount of an ERC-20 token the delegate can transfer. | `--tokenAddress`, `--maxAmount` | — |
| `erc20PeriodTransfer` | Allow ERC-20 transfers up to a limit per recurring time period. Unused allowance does not carry over. | `--tokenAddress`, `--periodAmount`, `--periodDuration` | `--startDate` |
| `erc20Streaming` | Linear streaming limit for ERC-20 tokens. Releases an initial amount at start, then accrues linearly up to a max. | `--tokenAddress`, `--amountPerSecond`, `--initialAmount`, `--maxAmount` | `--startTime` |
| `erc721Transfer` | Restrict execution to only allow transfer of a specific ERC-721 token ID. | `--tokenAddress`, `--tokenId` | — |
| `nativeTokenTransferAmount` | Enforce a maximum allowance of native currency (e.g. ETH) the delegate can transfer. | `--maxAmount` | — |
| `nativeTokenPeriodTransfer` | Allow native token transfers up to a limit per recurring time period. Unused allowance does not carry over. | `--periodAmount`, `--periodDuration` | `--startDate` |
| `nativeTokenStreaming` | Linear streaming limit for native tokens. Releases an initial amount at start, then accrues linearly up to a max. | `--amountPerSecond`, `--initialAmount`, `--maxAmount` | `--startTime` |
| `functionCall` | Restrict which contract addresses and methods the delegate can call. | `--allowedTargets`, `--allowedMethods` | `--maxValue` (adds a `valueLte` constraint) |
| `ownershipTransfer` | Restrict execution to only allow `transferOwnership` on a specific contract. | `--contractAddress` | — |

Notes:
- `--startDate` and `--startTime` default to the current timestamp (unix seconds) when omitted.
- `--maxValue` on `functionCall` adds a `valueLte` constraint to the delegation.

## Additional Allow Types

Granular constraint types that can be layered on top of a primary allow type or composed standalone.

| Allow Type | Description | Required Flags | Optional Flags |
|---|---|---|---|
| `limitedCalls` | Limit the number of times the delegate can redeem the delegation. | `--limit` | — |
| `timestamp` | Restrict the delegation to a time window. Set either threshold to `0` to leave that side unbounded. | — | `--afterTimestamp`, `--beforeTimestamp` (both default to `0`) |
| `blockNumber` | Restrict the delegation to a block number range. Set either threshold to `0` to leave that side unbounded. | — | `--afterBlock`, `--beforeBlock` (both default to `0`) |
| `redeemer` | Limit which addresses can redeem the delegation. Delegator accounts with delegation support can bypass this by re-delegating. | `--redeemers` (comma-separated) | — |
| `nonce` | Attach a nonce to enable bulk revocation by incrementing the nonce on-chain. | `--nonce` (hex) | — |
| `id` | Assign a shared ID across multiple delegations. Once one is redeemed, the others with the same ID are revoked. | `--caveatId` | — |
| `valueLte` | Limit the native token value that can be sent per execution. | `--maxValue` | — |
| `allowedTargets` | Restrict which contract addresses the delegate can call. | `--allowedTargets` (comma-separated) | — |
| `allowedMethods` | Restrict which methods the delegate can call. Accepts function signatures or 4-byte selectors. | `--allowedMethods` (comma-separated) | — |
| `allowedCalldata` | Enforce that calldata at a specific byte index matches an expected value. Useful for validating static function parameters. | `--calldataStartIndex`, `--calldataValue` | — |
| `argsEqualityCheck` | Ensure the args provided when redeeming match the specified terms exactly. | `--argsCheck` (hex) | — |
| `exactCalldata` | Verify that the entire transaction calldata matches the expected value exactly. | `--exactCalldata` (hex) | — |
| `exactExecution` | Verify that the execution matches an exact target, value, and calldata. | `--execTarget` | `--execValue` (default `0`), `--execCalldata` (default `0x`) |
| `nativeTokenPayment` | Require payment in native token (e.g. ETH) to use the delegation. | `--paymentRecipient`, `--paymentAmount` | — |
| `nativeBalanceChange` | Ensure the recipient's native token balance changes by at least (increase) or at most (decrease) a specified amount. | `--nativeBalanceRecipient`, `--nativeBalanceAmount`, `--nativeBalanceChangeType` | — |
| `erc20BalanceChange` | Ensure the recipient's ERC-20 balance changes within allowed bounds. | `--erc20BalanceToken`, `--erc20BalanceRecipient`, `--erc20BalanceAmount`, `--erc20BalanceChangeType` | — |
| `erc721BalanceChange` | Ensure the recipient's ERC-721 balance changes within allowed bounds. | `--erc721BalanceToken`, `--erc721BalanceRecipient`, `--erc721BalanceAmount`, `--erc721BalanceChangeType` | — |
| `erc1155BalanceChange` | Ensure the recipient's ERC-1155 token balance changes within allowed bounds. | `--erc1155BalanceToken`, `--erc1155BalanceRecipient`, `--erc1155BalanceTokenId`, `--erc1155BalanceAmount`, `--erc1155BalanceChangeType` | — |
| `deployed` | Ensure a contract is deployed at the specified address; deploys it if not. | `--deployAddress`, `--deploySalt`, `--deployBytecode` | — |
| `custom` | Use an arbitrary caveat enforcer contract with custom encoded terms. | `--enforcerAddress`, `--enforcerTerms` | — |
