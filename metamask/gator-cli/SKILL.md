---
name: gator-cli
description: Use when you need to operate the @metamask/gator-cli to initialize profiles, upgrade EOA to EIP-7702, grant, redeem, and revoke ERC-7710 delegations, or inspect balances and delegations. Covers commands, required flags, allow types, redeem action types, configuration locations, and common usage flows.
metadata:
  openclaw:
    emoji: "🐊"
    homepage: "https://docs.metamask.io/smart-accounts-kit"
    requires:
      bins: ["gator"]
    install:
      - id: "node"
        kind: "node"
        package: "@metamask/gator-cli"
        bins: ["gator"]
        label: "Install gator CLI"
---

## Quick Reference

Use this skill to run the gator CLI from the repo and to choose the correct command/flags for delegation workflows.

## Grant Decision Flow

Follow these steps when building a `gator grant` command:

1. Identify what the user wants to delegate.

2. Check if the intent matches a **primary allow type**:
   - Token transfer with max amount → `erc20TransferAmount` or `nativeTokenTransferAmount`
   - Periodic token transfer → `erc20PeriodTransfer` or `nativeTokenPeriodTransfer`
   - Token streaming → `erc20Streaming` or `nativeTokenStreaming`
   - NFT transfer → `erc721Transfer`
   - Ownership transfer → `ownershipTransfer`
   - Function call restriction → `functionCall`

3. If a primary allow type matches:
   a. Start with `--allow <primaryType>` and its required flags (see Primary Allow Types table).
   b. Does the user need extra constraints (time limits, call limits, redeemer restrictions, etc.)?
   c. If yes → append `--allow <additionalType>` for each constraint (see Additional Allow Types table).
   d. If no → the command is complete.

4. If NO primary allow type matches the intent:
   - Compose the grant using only additional allow types.
   - Use one `--allow <type>` per constraint, each with its own flags.

## Installation

```sh
npm install -g @metamask/gator-cli
```

## CLI Overview

- Binary name: `gator`
- Default profile: `default`
- Config path: `~/.gator-cli/permissions.json` (or `~/.gator-cli/profiles/<profile-name>.json`)
- Delegations local cache: `~/.gator-cli/delegations/<profile-name>.json` when storage not configured

## Configuration Requirements

Edit the profile config after `gator init`:

```json
{
  "delegationStorage": {
    "apiKey": "your-api-key",
    "apiKeyId": "your-api-key-id"
  },
  "rpcUrl": "https://your-rpc-url.com"
}
```

- `delegationStorage` is optional; when missing, delegations are stored locally.
- `rpcUrl` is required for on-chain actions.

## Commands

### init

Generate a private key and save config. Errors if the profile already exists.

- `gator init [--chain <chain>] [--profile <profile-name>]`
- `--chain` values: `base` (default), `baseSepolia`, `sepolia`
- `--profile` default: `default`
- Prints: address, chain, and config file path.

### create

Upgrade an EOA to an EIP-7702 smart account. Uses the chain in your profile config.

- `gator create [--profile <profile-name>]`
- Requires the account to be funded with native token first.
- Prints: address, chain, and the upgrade transaction hash.

### show

Display the EOA address for a profile.

- `gator show [--profile <profile-name>]`

### status

Check config and on-chain account status.

- `gator status [--profile <profile-name>]`
- Prints: address, chain, config upgrade status, on-chain code presence, storage and RPC URL config.

### balance

Show native balance and optional ERC-20 balance.

- `gator balance [--tokenAddress <address>] [--profile <profile-name>]`
- If `--tokenAddress` is provided, prints ERC-20 balance and decimals-derived units.

### grant

Create, sign, and store a delegation with one or more allow types. Multiple `--allow` flags can be combined in a single grant to compose constraints.

- `gator grant --to <to-address> --allow <type> [type flags] [--allow <type> [type flags] ...] [--profile <profile-name>]`

Run `gator help grant` for the full list of flags.

For the full list of allow types with descriptions, required flags, and optional flags, see the [Allow Types Reference](./references/allow-types.md).


### redeem

Redeem a stored delegation using a specific action type.

- `gator redeem --from <from-address> --action <type> [action flags] [--profile <profile-name>]`

Supported action types: `erc20Transfer`, `erc721Transfer`, `nativeTransfer`, `functionCall`, `ownershipTransfer`, `raw`

Action-specific flags:

- `erc20Transfer`: `--tokenAddress`, `--to`, `--amount`
- `erc721Transfer`: `--tokenAddress`, `--to`, `--tokenId`
- `nativeTransfer`: `--to`, `--amount`
- `functionCall`: `--target`, `--function`, `--args`, `--value`
- `ownershipTransfer`: `--contractAddress`, `--to`
- `raw`: `--target`, `--callData`, `--value`

### revoke

Revoke a delegation on-chain. Revokes the first matching delegation.

- `gator revoke --to <to-address> [--profile <profile-name>]`

### inspect

Inspect delegations for your account.

- `gator inspect [--from <from-address>] [--to <to-address>] [--profile <profile-name>]`
- With no filters, prints both Given and Received.
- Printed fields: From, To, Authority, Caveats count, Signed flag.

## Redeem Flags per Action

| Action              | Required Flags                        |
| ------------------- | ------------------------------------- |
| `erc20Transfer`     | `--tokenAddress`, `--to`, `--amount`  |
| `erc721Transfer`    | `--tokenAddress`, `--to`, `--tokenId` |
| `nativeTransfer`    | `--to`, `--amount`                    |
| `functionCall`      | `--target`, `--function`, `--args`    |
| `ownershipTransfer` | `--contractAddress`, `--to`           |
| `raw`               | `--target`, `--callData`              |

## Example Flows

Initialize and upgrade:

```bash
gator init --profile <profile-name>
gator create --profile <profile-name>
```

Grant an ERC-20 transfer delegation (primary allow type only):

```bash
gator grant --profile <profile-name> --to <to-address> \
  --allow erc20TransferAmount --tokenAddress <token-address> --maxAmount 50
```

Grant with additional constraints (primary + additional allow types):

```bash
gator grant --profile <profile-name> --to <to-address> \
  --allow erc20TransferAmount --tokenAddress <token-address> --maxAmount 50 \
  --allow limitedCalls --limit 5
```

Time-bounded native transfer delegation:

```bash
gator grant --profile <profile-name> --to <to-address> \
  --allow nativeTokenTransferAmount --maxAmount 0.5 \
  --allow timestamp --afterTimestamp 1700000000 --beforeTimestamp 1800000000
```

Redeemer-restricted delegation:

```bash
gator grant --profile <profile-name> --to <to-address> \
  --allow nativeTokenTransferAmount --maxAmount 1 \
  --allow redeemer --redeemers 0xADDR1,0xADDR2
```

Restrict targets and methods (additional allow types only, no primary):

```bash
gator grant --profile <profile-name> --to <to-address> \
  --allow allowedTargets --allowedTargets 0xContract \
  --allow allowedMethods --allowedMethods "transfer(address,uint256)"
```

Custom caveat enforcer:

```bash
gator grant --profile <profile-name> --to <to-address> \
  --allow nativeTokenTransferAmount --maxAmount 1 \
  --allow custom --enforcerAddress 0xDeployed --enforcerTerms 0xEncoded
```

Redeem an ERC-20 transfer:

```bash
gator redeem --profile <profile-name> --from <from-address> --action erc20Transfer \
  --tokenAddress <token-address> --to <to-address> --amount 10
```

Redeem a native transfer:

```bash
gator redeem --profile <profile-name> --from <from-address> --action nativeTransfer \
  --to <to-address> --amount 0.5
```

Redeem in raw mode:

```bash
gator redeem --profile <profile-name> --from <from-address> --action raw \
  --target <contract-address> --callData 0xa9059cbb...
```

Inspect delegations:

```bash
gator inspect --profile <profile-name>
gator inspect --profile <profile-name> --from <from-address>
gator inspect --profile <profile-name> --to <to-address>
```

Revoke a delegation:

```bash
gator revoke --profile <profile-name> --to <to-address>
```

## Operational Notes

- **Private key security**: This is alpha version. Private keys are stored in plaintext JSON. Never use accounts with significant funds.
- Run `gator help <command>` for full flag details on any command.
- `--from` refers to the delegator address; `--to` refers to the delegate/recipient.
- `--allowedTargets` and `--redeemers` are comma-separated lists.
- `--allowedMethods` accepts comma-separated human-readable Solidity function signatures like `"approve(address,uint256)"`. Do **not** pass 4-byte selectors.
- `--function` (for `redeem --action functionCall`) accepts a human-readable Solidity function signature like `"approve(address,uint256)"`. The CLI derives the selector automatically.
- `--startDate` and `--startTime` accept unix timestamps in seconds. When omitted, they default to the current time.
- `--action` is required for `redeem` and must be one of: `erc20Transfer`, `erc721Transfer`, `nativeTransfer`, `functionCall`, `ownershipTransfer`, `raw`.
- Supported chains for `--chain` in `gator init`: `base` (default), `baseSepolia`, `sepolia`.
