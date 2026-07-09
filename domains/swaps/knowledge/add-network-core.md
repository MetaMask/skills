---
name: add-network-core
domain: swaps
description: Core controller SSOT for adding EVM or non-EVM networks to the Bridge and BridgeStatus controllers
---

# Add Swaps/Bridge Network To Core Controllers

## Use This Standard When

- A task adds a new EVM or non-EVM network to the Core Bridge or BridgeStatus controller packages.
- The request mentions bridge controller allowlists, chain IDs, native token metadata, CAIP formatters, quote transaction schemas, trade extraction, submit/status handling, or package contract changes.
- Client work in Extension or Mobile depends on new `@metamask/bridge-controller` or `@metamask/bridge-status-controller` behavior.

Core owns the shared package contract consumed by Extension and Mobile. Treat exported types, constants, controller state, messenger actions, events, and transaction payload formats as cross-client API changes.

## Classify The Network First

Before editing code, classify the network:

- EVM: uses EVM chain IDs and EVM transaction data (`TxData`) for approvals and trades.
- Non-EVM: uses a CAIP scope, network-specific account type, and a non-EVM transaction format signed through the appropriate account or snap path.
- Hybrid or unknown: stop and identify the bridge API transaction format, account model, signing path, and CAIP identifiers before implementation.

## Common Prerequisites

Confirm all are true before implementation:

- The bridge backend supports the network.
- Chain identifiers are known, including EVM decimal chain ID or non-EVM CAIP scope.
- Native token metadata is known, including symbol, decimals, token address convention, and icon availability.
- The target network has a clear signing path through existing account/keyring support.
- Extension and Mobile client support requirements are understood.
- Public package contract changes are planned for downstream consumers.

If any prerequisite is missing, stop and report the blocker instead of partially wiring the feature.

## Reference Implementations

Use these references before coding:

- Non-EVM Tron Core integration: `https://github.com/MetaMask/core/pull/6862`
- Existing non-EVM Solana, Bitcoin, and Tron handling in `packages/bridge-controller/` and `packages/bridge-status-controller/`
- Existing EVM chain entries in `packages/bridge-controller/src/constants/bridge.ts` and `packages/bridge-controller/src/constants/tokens.ts`

Review the closest EVM or non-EVM implementation in the target checkout and mirror existing naming, ordering, validation, and test style.

## Agent Execution Standard (SSOT)

For agent implementation or review tasks, follow this workflow exactly:

1. Confirm prerequisites and classify the network as EVM, non-EVM, or hybrid/unknown.
2. Review the closest existing Core implementation before editing.
3. Update `packages/bridge-controller` constants, token metadata, types, validators, trade utilities, CAIP formatters, and exports as needed.
4. Update `packages/bridge-status-controller` non-EVM detection, transaction submission, snap/client request construction, and status handling as needed.
5. Validate exported package contracts, generated messenger action types, and changelog requirements when public behavior changes.
6. Run targeted package tests and note any remaining client validation gaps.

## Core Implementation Checklist

### 1. Network Constants

Update `packages/bridge-controller/src/constants/bridge.ts` and related constants when the new network should be available to Bridge:

- Add the network to allowed chain ID lists.
- Keep ordering consistent with existing networks.
- Use hex `CHAIN_IDS` constants such as `CHAIN_IDS.MAINNET` or `'0x1'` for EVM allowlists.
- Use EIP-155 CAIP chain IDs such as `eip155:1` for feature flag ranking and CAIP-formatted asset IDs.
- Prefer CAIP scopes from `@metamask/keyring-api` for non-EVM networks.
- Prefer existing constants from the package before adding new local helpers.

Update native token metadata in `packages/bridge-controller/src/constants/tokens.ts` when the network needs package-level default token support:

- Symbol and display name
- Native token address convention
- Decimals
- Icon URL or icon lookup convention
- SLIP-44 mapping when applicable

### 2. Types And Validators

Update type and validator internals only where the bridge API introduces a shape that does not already exist:

- `packages/bridge-controller/src/types.ts`
  - Add network-specific trade data types.
  - Extend `QuoteResponse` generic defaults when the trade or approval type becomes part of the public package contract.
- `packages/bridge-controller/src/utils/validators.ts`
  - Extend quote response validation schemas for new trade or approval shapes.
- `packages/bridge-controller/src/validators/trade.ts`
  - Add type guards such as `is<Network>Trade` for custom non-EVM trade data.
  - Follow existing `isEvmTxData`, `isBitcoinTrade`, `isTronTrade`, and `isStellarTrade` patterns.

Keep type narrowing explicit through validators and type guards instead of broad casts.

EVM networks usually continue using existing `TxData` handling. Non-EVM networks often need a custom schema such as Bitcoin PSBT, Solana serialized transaction, or Tron `raw_data_hex`.

### 3. Trade Utilities

Update `packages/bridge-controller/src/utils/trade-utils.ts`:

- Update `extractTradeData` so the transaction data matches the signing path expected by the account or snap client.
- Keep network-specific extraction behind the matching `is<Network>Trade` type guard.
- Export new type guards or helpers from `packages/bridge-controller/src/index.ts` when clients or `bridge-status-controller` need them.

Do not access network-specific trade fields without first narrowing the trade shape.

### 4. CAIP Formatters

Update `packages/bridge-controller/src/utils/caip-formatters.ts` and nearby bridge utilities:

- Verify `formatChainIdToCaip` handles the network correctly. EVM inputs should use the existing hex/number to `eip155:<decimal>` path; non-EVM inputs may need explicit mapping from bridge API numeric IDs or aliases to a CAIP scope.
- Verify `formatChainIdToDec` handles the network correctly for supported inputs: number, hex, CAIP chain ID, or numeric string. Non-EVM CAIP scopes may need explicit mapping back to the bridge API numeric chain ID.
- Update `formatChainIdToHex` only for EVM-compatible numeric/CAIP inputs that need app-facing hex IDs.
- Update `formatAddressToAssetId` when asset ID construction differs from the existing EVM `erc20`, Solana `token`, or Tron `trc20` behavior.
- In `packages/bridge-controller/src/utils/bridge.ts`, add `is<Network>ChainId` helpers and update `isNonEvmChainId` for non-EVM networks that need shared detection.
- In `packages/bridge-controller/src/utils/bridge.ts`, update `getNativeAssetForChainId` when the network needs a native asset CAIP ID.
- For non-EVM networks, include testnet scopes only when the backend and clients need them.
- For EVM networks, prefer the existing EIP-155 and hex conversion paths unless the chain needs special handling.
- Verify the same identifiers are used across constants, request formatting, and client-facing exports.

### 5. Bridge Status Transaction Handling

Update BridgeStatus internals only where the submit/status path differs:

- `packages/bridge-status-controller/src/bridge-status-controller.ts`
  - Update `submitTx` when the new network changes submit behavior, approval sequencing, history metadata, or polling behavior.
  - Preserve existing EVM submit behavior for EVM networks.
- `packages/bridge-status-controller/src/strategy/index.ts`
  - In current strategy-based flows, update `validateParams` and the non-EVM branch in `executeSubmitStrategy` so the network routes to `submitNonEvmHandler`.
- `packages/bridge-status-controller/src/utils/snaps.ts`
  - Update `getClientRequest` when a non-EVM signing request needs network-specific scope, account ID, encoded transaction data, or options.
  - Keep request construction aligned with `extractTradeData`.
- `packages/bridge-status-controller/src/utils/bridge-status.ts` and `packages/bridge-status-controller/src/utils/history.ts`
  - Update only if non-EVM status or history behavior differs.

Ensure approval handling is included only when the network supports approvals.

Non-EVM transaction data must be converted to the exact format the signing path expects. For example, Tron raw transaction hex may need base64 encoding and request options derived from the raw contract type.

## EVM-Specific Handling

For EVM networks:

- Reuse existing `TxData` quote and approval types unless the backend introduces a new shape.
- Add chain constants, native token metadata, allowlists, and default token mappings as needed.
- Verify quote fee logic if the network has unusual fee semantics.
- Confirm approval flow behavior for token swaps and bridge transactions.
- Avoid adding non-EVM CAIP or snap-specific handling unless the network actually needs it.

## Non-EVM-Specific Handling

For non-EVM networks:

- Use the network scope from `@metamask/keyring-api`.
- Add SLIP-44 metadata when needed.
- Define custom transaction schemas only for real backend response shapes.
- Add type guards and extraction utilities for network-specific transaction data.
- Update CAIP conversion helpers.
- Update `isNonEvmChainId` style detection.
- Ensure the selected account has the correct snap/account metadata for signing.
- Pass network-specific request options to the signing path only when required.

## Gating And Rollout

Core package changes usually gate availability through exported allowlists and package versions. Coordinate with client rollouts:

- Extension and Mobile must consume a package version that includes the new network.
- LaunchDarkly/client flags still control user-facing rollout in the consuming repos.
- Public exports and behavior changes need changelog or release note handling according to Core repo conventions.

## Validation Checklist

Before finishing, verify:

- Constants and token metadata are present and exported where needed.
- CAIP formatting works both directions.
- Type guards correctly identify network-specific trades.
- Transaction data extraction returns the format expected by the signer.
- EVM approval/trade flows still use existing `TxData` handling.
- Non-EVM approval/trade flows work with and without approvals when applicable.
- Package exports are updated for new public helpers or types.
- Generated messenger action types are updated or checked when controller messenger contracts change.
- Downstream Extension and Mobile impact is explicitly called out.

## Test Guidance

Run targeted tests for the touched package areas:

- `yarn workspace @metamask/bridge-controller test`
- `yarn workspace @metamask/bridge-status-controller test`

Also run build/type or generated contract checks when relevant:

- `yarn workspace @metamask/bridge-controller build`
- `yarn workspace @metamask/bridge-status-controller build`
- Messenger action type checks when messenger actions or controller events change
- Changelog validation when public package behavior changes

If behavior changes, add or update tests in the closest package test suites.

## Required Agent Response Sections

When using this standard, return:

1. `Prerequisites Check`
2. `Network Classification`
3. `Implementation Checklist`
4. `Files Changed`
5. `Package Contract Impact`
6. `Gating Behavior Verified`
7. `Tests Run`
8. `Remaining Gaps`
