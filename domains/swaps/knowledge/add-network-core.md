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
- EVM Robinhood Chain Core integration (minimal constants-only template): `https://github.com/MetaMask/core/pull/9459`
- Existing non-EVM Solana, Bitcoin, and Tron handling in `packages/bridge-controller/` and `packages/bridge-status-controller/`
- Existing EVM chain entries in `packages/bridge-controller/src/constants/chains.ts`, `packages/bridge-controller/src/constants/bridge.ts`, `packages/bridge-controller/src/constants/tokens.ts`, and `packages/bridge-controller/src/types.ts`

Review the closest EVM or non-EVM implementation in the target checkout and mirror existing naming, ordering, validation, and test style.

### Minimal EVM Path

For a standard EVM network whose backend returns existing `TxData` trade and approval shapes, Core onboarding is usually limited to:

1. `packages/bridge-controller/src/constants/chains.ts` — `CHAIN_IDS`, display name, and `NETWORK_TO_NAME_MAP`
2. `packages/bridge-controller/src/types.ts` — decimal `ChainId` enum entry
3. `packages/bridge-controller/src/constants/bridge.ts` — `ALLOWED_BRIDGE_CHAIN_IDS` and `DEFAULT_CHAIN_RANKING`
4. `packages/bridge-controller/src/constants/tokens.ts` — native currency symbol, network token object, and `SWAPS_CHAINID_DEFAULT_TOKEN_MAP`
5. `packages/bridge-controller/CHANGELOG.md` — an `Added` entry under `Unreleased`

Robinhood Chain PR #9459 changed only these five files. It did not update validators, trade utilities, CAIP formatters, exports, BridgeStatus, or tests. Skip the extended sections below unless the network introduces a new trade or approval shape, signing path, CAIP behavior, fee behavior, or public helper.

## Agent Execution Standard (SSOT)

For agent implementation or review tasks, follow this workflow exactly:

1. Confirm prerequisites and classify the network as EVM, non-EVM, or hybrid/unknown.
2. Review the closest existing Core implementation before editing.
3. For a standard EVM network, follow the Minimal EVM Path. Update validators, trade utilities, CAIP formatters, or exports only when the network introduces behavior that existing generic EVM handling does not cover.
4. Update `packages/bridge-status-controller` only when the network changes non-EVM detection, transaction submission, snap/client request construction, or status handling.
5. Add a changelog entry when allowlists or public behavior change. Re-check exports and generated messenger action types only when exported helpers, types, or controller messenger contracts change.
6. Run targeted package tests and note any remaining client validation gaps.

## Core Implementation Checklist

### 1. Network Constants

Update chain and bridge constants when the new network should be available to Bridge:

- `packages/bridge-controller/src/constants/chains.ts`
  - For EVM networks, add the hex chain ID to `CHAIN_IDS`, for example `ROBINHOOD: '0x1237'`.
  - For EVM networks, add the display name constant.
  - For EVM networks, add the `NETWORK_TO_NAME_MAP` entry.
  - Do not add non-EVM scopes here unless the file already has a matching local pattern; non-EVM allowlists use keyring scopes instead.
- `packages/bridge-controller/src/types.ts`
  - Add the bridge API numeric chain ID to the `ChainId` enum when controller code needs a numeric ID.
  - For EVM networks, the enum decimal value must equal the hex `CHAIN_IDS` value, for example `4663` equals `0x1237`.
  - For non-EVM networks, follow the Tron pattern with entries such as `TRON = 728126428`.
- `packages/bridge-controller/src/constants/bridge.ts`
  - Add the network to `ALLOWED_BRIDGE_CHAIN_IDS`.
  - For EVM networks, add the hex `CHAIN_IDS.<NETWORK>` constant to `ALLOWED_BRIDGE_CHAIN_IDS`.
  - For non-EVM networks, import and add the keyring scope, for example `TrxScope.Mainnet`.
  - Add the `DEFAULT_CHAIN_RANKING` entry using the correct CAIP chain ID format, for example `eip155:4663` for EVM or `tron:728126428` for Tron.
- Keep ordering consistent with existing networks.
- Keep EVM `CHAIN_IDS.*` entries grouped before non-EVM keyring scopes in `ALLOWED_BRIDGE_CHAIN_IDS`.
- Place new `DEFAULT_CHAIN_RANKING` entries alongside peer networks and use the canonical display name.
- Use hex `CHAIN_IDS` constants such as `CHAIN_IDS.MAINNET` or `'0x1'` for EVM allowlists.
- Use EIP-155 CAIP chain IDs such as `eip155:1` for feature flag ranking and CAIP-formatted asset IDs.
- Prefer CAIP scopes from `@metamask/keyring-api` for non-EVM networks.
- Prefer existing constants from the package before adding new local helpers.

Update native token metadata in `packages/bridge-controller/src/constants/tokens.ts` when the network needs package-level default token support:

- Add a network key to `CURRENCY_SYMBOLS`, with the native symbol as its value, for example `ROBINHOOD: 'ETH'`.
- Define `<NETWORK>_SWAPS_TOKEN_OBJECT`; for an ETH-native EVM chain, spread `ETH_SWAPS_TOKEN_OBJECT` instead of duplicating its fields.
- Map `[CHAIN_IDS.<NETWORK>]` to the network token object in `SWAPS_CHAINID_DEFAULT_TOKEN_MAP`.
- For non-EVM networks, follow the Tron pattern: add the native currency symbol such as `TRX`, define a token object such as `TRX_SWAPS_TOKEN_OBJECT`, map `[TrxScope.Mainnet]` in `SWAPS_CHAINID_DEFAULT_TOKEN_MAP`, and add the native asset entry in `SYMBOL_TO_SLIP44_MAP`, for example `TRX: 'slip44:195'`.
- For an ETH-native EVM network, inherit the native address convention, decimals, and icon fields from `ETH_SWAPS_TOKEN_OBJECT`; do not add a new SLIP-44 mapping.

### 2. Types And Validators (New Backend Shapes Only)

For a standard EVM network, only add the `ChainId` enum entry described above. Update the following internals only where the bridge API introduces a shape that does not already exist:

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
- Add chain constants in `constants/chains.ts`, the decimal `ChainId` enum entry in `types.ts`, bridge allowlist/ranking entries in `constants/bridge.ts`, and native/default token mappings in `constants/tokens.ts`.
- Verify quote fee logic if the network has unusual fee semantics.
- Confirm approval flow behavior for token swaps and bridge transactions.
- Do not update `bridge-status-controller` submit strategy code unless the new EVM network changes submit behavior beyond existing `TxData` handling.
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
- EVM allowlist additions in `@metamask/bridge-controller` should include a `packages/bridge-controller/CHANGELOG.md` entry.

## Validation Checklist

Before finishing, verify:

- Standard EVM constants and token metadata are present in the five Minimal EVM Path files.
- Existing EVM CAIP conversion and `TxData` handling cover the new chain without code changes.
- For non-EVM or custom trade shapes, type guards, `extractTradeData`, and CAIP formatters are updated and tested.
- BridgeStatus remains untouched for a standard EVM network and changes only when submit, status, or signing behavior differs.
- `CHANGELOG.md` includes an `Unreleased` entry when an allowlist changes.
- Package exports and generated messenger action types are checked only when their contracts change.
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

Constants-only EVM allowlist additions such as PR #9459 may require no new unit tests when existing generic EVM formatter and validator coverage applies. Still run the Bridge controller package tests to check for regressions.

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
