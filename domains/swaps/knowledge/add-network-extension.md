---
name: add-network-extension
domain: swaps
description: Extension client SSOT for adding EVM or non-EVM networks to Swaps and Bridge
---

# Add Swaps/Bridge Network To Extension

## Use This Standard When

- A task adds a new EVM or non-EVM network to Extension Swaps or Bridge.
- The request mentions bridge chain allowlists, Extension bridge constants, source-chain visibility, account detection, destination account checks, address validation, send type resolution, token filtering, or LaunchDarkly rollout.
- Core controller support exists or is being added and Extension needs to expose the network.

## Classify The Network First

Before editing Extension code, classify the network:

- EVM: uses EIP-155 chain IDs, EVM accounts, EVM transaction data, and the normal EVM approval flow.
- Non-EVM: uses a CAIP scope, non-EVM account type, and any network-specific address or signing behavior.
- Hybrid or unknown: stop and confirm the Core package contract, account model, and bridge API behavior before wiring the client.

## Common Prerequisites

Confirm all are true before implementation:

- `@metamask/bridge-controller` supports the target network.
- `@metamask/bridge-status-controller` supports submit/status handling if Bridge submission changes.
- Base Extension network support exists for the target network.
- Token metadata, native token data, and icon behavior are known.
- LaunchDarkly rollout behavior is defined.
- Core package versions consumed by Extension include any required network constants or helpers.

For non-EVM networks, also confirm:

- Wallet snap or account support exists for the target network when required.
- Account type support exists in `@metamask/keyring-api`.
- Network-specific address validation rules are known.

If any prerequisite is missing, stop and report the blocker instead of partially wiring the feature.

## Reference Implementations

Review the closest references before coding:

- Tron Extension integration: `https://github.com/MetaMask/metamask-extension/pull/37683`
- Bitcoin Extension integration: `https://github.com/MetaMask/metamask-extension/pull/35597`
- EVM Robinhood Chain Extension integration: `https://github.com/MetaMask/metamask-extension/pull/44347`
- Existing EVM bridge chain entries in `shared/constants/bridge.ts`

Mirror existing naming, ordering, LaunchDarkly flag shape, and test style.

### Minimal EVM Path

Robinhood Chain PR #44347 demonstrates the standard EVM Extension path:

1. `package.json` and `yarn.lock` — consume the Core release containing the network
2. `shared/constants/bridge.ts` — EVM allowlist, hex and CAIP short-name entries, and common token pair
3. `ui/pages/bridge/utils/stablecoins.ts` — curated stablecoin asset IDs when the network needs stablecoin slippage
4. `ui/ducks/bridge/selectors.test.ts` — source/destination visibility coverage
5. `ui/hooks/bridge/useSmartSlippage.test.ts` — stablecoin slippage coverage when applicable

For a standard EVM network, selector logic, destination account handling, external address validation, send type handling, multichain asset selectors, and token filtering usually require no code changes. Verify them and edit only when the network has special behavior.

The `quote.ts` and `buildResults.ts` type-suppression removals in PR #44347 were dependency cleanup after the controller bump. The `metamask-controller.test.js` mocks and generated LavaMoat policy changes were incidental, not network onboarding steps.

## Agent Execution Standard (SSOT)

For agent implementation or review tasks, follow this workflow exactly:

1. Confirm prerequisites and classify the network as EVM, non-EVM, or hybrid/unknown.
2. Review the closest EVM or non-EVM Extension reference before making edits.
3. Bump `@metamask/bridge-controller` when Core package support lands in a new version.
4. Update bridge constants and token metadata in `shared/constants/bridge.ts`.
5. For a standard EVM network, update stablecoin/slippage behavior and tests when applicable, then verify existing selectors, account handling, address validation, send type handling, and token filtering without editing them unless special behavior is required.
6. Apply both rollout controls together: package/code gating and LaunchDarkly `bridge-config` targeting.
7. Validate hidden-state behavior, account compatibility, quote/submit behavior, and token filtering.
8. Run targeted tests for changed areas and note any remaining gaps.

## Common Extension Checklist

For a standard EVM network, destination account, address/send, multichain asset, and token-filtering sections are usually verification-only.

### 1. Bridge Constants

Update `shared/constants/bridge.ts`:

- `NETWORK_TO_SHORT_NETWORK_NAME_MAP`
- `BRIDGE_CHAINID_COMMON_TOKEN_PAIR`

For EVM networks:

- Add the network to `ALLOWED_EVM_BRIDGE_CHAIN_IDS` or the equivalent EVM-specific allowlist.
- Add both hex and CAIP network name map entries when the file stores both forms: `CHAIN_IDS.<NETWORK>` and `toEvmCaipChainId(CHAIN_IDS.<NETWORK>)`.
- Add the default native-to-token pair to `BRIDGE_CHAINID_COMMON_TOKEN_PAIR` when needed. Include `address`, `symbol`, `decimals`, `name`, and a CAIP `assetId` built with `toEvmCaipChainId` and `toChecksumHexAddress`.

For non-EVM networks, update `ALLOWED_MULTICHAIN_BRIDGE_CHAIN_IDS` and any explicit composed allowlist entry required by the file.

Do not directly edit composed `ALLOWED_BRIDGE_CHAIN_IDS` arrays for a standard EVM network when adding it to `ALLOWED_EVM_BRIDGE_CHAIN_IDS` already includes it.

Keep naming and ordering consistent with existing networks. Prefer constants and helpers from `@metamask/bridge-controller` when they exist.

### 2. Source-Chain Visibility

Verify, and only when needed update, bridge selectors and utilities:

- `ui/ducks/bridge/selectors.ts`
  - Ensure source-chain filtering includes the network only when all allowlist, rollout, and account requirements are satisfied.
  - Add account-presence selectors only when the network has account-specific visibility requirements.
  - Standard EVM networks usually require no selector logic changes when allowlists and `bridge-config` ranking already drive visibility.
- `ui/ducks/bridge/selectors.test.ts`
  - Add focused `getFromChains` and `getToChains` coverage proving an EVM network appears only when it is present in both chain ranking and the allowlist.
  - Update full-list length assertions and snapshots when the default destination list grows.
  - Account for short-name map labels differing from `bridge-config` display names.
- `ui/ducks/bridge/utils.ts`
  - Export `is<Network>ChainId` only if a shared helper does not already exist.
- `ui/ducks/bridge/asset-selectors.ts`
  - Verify multichain asset selection includes the correct scopes for non-EVM networks.

### 3. Destination Account Compatibility

Update destination account behavior when account compatibility differs by network:

- `ui/pages/bridge/prepare/components/destination-account-picker-modal.tsx`
- `ui/pages/bridge/prepare/components/destination-account-list-item.tsx`

The destination account picker must block incompatible account types and keep compatible accounts selectable.

### 4. Address Validation And Send Type

Update only when the network has standalone send or external recipient behavior:

- `ui/pages/bridge/hooks/useExternalAccountResolution.ts`
- `ui/pages/confirmations/hooks/send/useSendType.ts`
- `ui/selectors/multichain.ts`

Use network-specific validation for non-EVM addresses. EVM networks should reuse existing EVM address validation unless the feature requires special handling.

### 5. Token Filtering

Update token filtering when the network has non-tradeable assets or special asset restrictions:

- `ui/hooks/bridge/useTokensWithFiltering.ts`

Do not add local filtering if the bridge controller or backend already provides the correct tradability data.

### 6. Stablecoins, Slippage, And Fee Display

For EVM networks with curated stablecoin pairs, update:

- `ui/pages/bridge/utils/stablecoins.ts`
  - Add stablecoin asset IDs with `toAssetId(address, CHAIN_IDS.<NETWORK>)`.
- `ui/hooks/bridge/useSmartSlippage.test.ts`
  - Add coverage for stablecoin-pair slippage when the network should use the stablecoin slippage path.

Dependency cleanup, when applicable:

- In `ui/pages/bridge/utils/quote.ts` and `ui/pages/batch-sell/pages/review/utils/buildResults.ts`, remove stale `@ts-expect-error` comments only when the updated controller package exports the required fee types.
- Treat this as package-bump cleanup, not network-specific fee configuration.

## EVM-Specific Handling

For EVM networks:

- Add the EIP-155 chain ID to bridge allowlists and network name maps.
- Add or verify the native/default token metadata and common token pair in `shared/constants/bridge.ts`.
- Add curated EVM stablecoins to `ui/pages/bridge/utils/stablecoins.ts` when the network should use stablecoin slippage behavior.
- Verify source-chain visibility does not require non-EVM account detection.
- Reuse existing EVM account compatibility, EVM address validation, and EVM send type behavior.
- Verify approval behavior is supported by existing EVM quote/submit handling.
- Add EVM-specific token filtering only when the network has known non-tradeable assets or local metadata requirements.

Do not add snap, CAIP account scope, or non-EVM destination account logic for a normal EVM network.

## Non-EVM-Specific Handling

For non-EVM networks:

- Add the CAIP scope to multichain and bridge allowlists.
- Add `has<Network>Accounts` style detection only when the network should appear based on compatible accounts.
- Add destination account compatibility checks for the target account type.
- Add network-specific external address validation.
- Add send type handling if standalone send is supported.
- Add relevant testnet chain IDs to multichain detection only when the target feature requires them.
- Filter out non-tradeable resources when applicable.

Non-EVM networks must stay hidden unless both rollout gates are enabled and compatible accounts exist.

## Gating And Rollout

Apply both rollout controls together:

- Package/code gate through consumed controller constants, build flags, or local allowlists.
- LaunchDarkly targeting through `bridge-config`.
- Package version bump in `package.json` and lockfile when the network depends on a newer `@metamask/bridge-controller`.

Important behavior:

- LaunchDarkly enables granular environment targeting.
- Package/code gating prevents accidental exposure when the feature is not released globally.
- Do not rely on only one control.

Validate:

- The network is absent when the code/package gate is off.
- The network appears only in LaunchDarkly-targeted environments when the code/package gate is on.
- Source-chain list ordering and filtering match `bridge-config` expectations.

## Validation Checklist

Before finishing, verify:

- The network is absent when code/package support is unavailable or gated off.
- The network only appears in LaunchDarkly-targeted environments when support is available.
- The source-chain list includes the network only when account requirements are satisfied.
- The destination account picker blocks incompatible account types.
- External address validation enforces network-specific rules where applicable.
- The send confirmation path resolves to the correct send type when standalone send is in scope.
- Token or resource filtering excludes non-tradeable assets where applicable.
- Stablecoin/slippage behavior is correct for curated EVM stablecoin pairs.
- Bridge transaction details and activity surfaces display the correct short network name.

## Test Guidance

Run targeted tests for changed areas:

- Unit tests in `ui/ducks/bridge/selectors.test.ts` (and selector implementation only when its logic changes)
- Unit tests for `ui/ducks/bridge/utils.ts`
- Unit tests for `ui/hooks/bridge/useSmartSlippage.test.ts`
- Unit or integration tests for destination account picker changes
- Unit tests for `ui/pages/bridge/hooks/useExternalAccountResolution.ts`
- Unit tests for `ui/pages/confirmations/hooks/send/useSendType.ts`
- Unit tests for `ui/hooks/bridge/useTokensWithFiltering.ts`

If behavior changes, add or update tests in the closest existing test suites.

Do not copy unrelated test-infrastructure or generated policy changes from a reference PR. Limit authored test changes to Bridge/Swaps behavior affected by the network.

## Required Agent Response Sections

When using this standard, return:

1. `Prerequisites Check`
2. `Network Classification`
3. `Implementation Checklist`
4. `Files Changed`
5. `Gating Behavior Verified`
6. `Tests Run`
7. `Remaining Gaps`
