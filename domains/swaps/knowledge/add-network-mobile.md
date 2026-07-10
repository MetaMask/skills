---
name: add-network-mobile
domain: swaps
description: Mobile client SSOT for adding EVM or non-EVM networks to Swaps and Bridge
---

# Add Swaps/Bridge Network To Mobile

## Use This Standard When

- A task adds a new EVM or non-EVM network to MetaMask Mobile Unified Swaps or Bridge.
- The request mentions Mobile bridge constants, network scopes, default tokens, BIP-44 pairs, asset swap permissions, account compatibility, feature flags, token icons, or transaction display.
- Core controller support exists or is being added and Mobile needs to expose the network.

Unified Swaps and Bridge live under `app/components/UI/Bridge/` and associated bridge controller, redux, selector, and utility files. Do not use stale paths such as `app/components/UI/Swaps/utils/index.js` unless they exist in the target checkout.

## Classify The Network First

Before editing Mobile code, classify the network:

- EVM: uses EIP-155 chain IDs, EVM accounts, EVM transaction data, and standard EVM address behavior.
- Non-EVM: uses a CAIP scope from `@metamask/keyring-api`, non-EVM account handling, and CAIP asset identifiers.
- Hybrid or unknown: stop and confirm the Core package contract, account model, signing path, and Mobile feature surface before wiring the client.

## Common Prerequisites

Confirm all are true before implementation:

- `@metamask/bridge-controller` supports the target network.
- `@metamask/bridge-status-controller` supports submit/status handling when Bridge submission changes.
- The bridge/swaps backend supports the network.
- Token metadata and icons are available through the expected token icon source.
- Mobile consumes controller package versions that include the required constants and helpers.
- Feature flag and build-gate rollout behavior is known.

For non-EVM networks, also confirm:

- The network scope is available in `@metamask/keyring-api`, such as `TrxScope`, `SolScope`, or `BtcScope`.
- Account/keyring support exists in Mobile.
- CAIP asset identifiers and address formats are known.

If any prerequisite is missing, stop and report the blocker instead of partially wiring the feature.

## Reference Implementations

Review the closest references before coding:

- Tron Mobile integration: `https://github.com/MetaMask/metamask-mobile/pull/21294`
- EVM Robinhood Chain Mobile integration: `https://github.com/MetaMask/metamask-mobile/pull/33110`
- Existing Solana, Bitcoin, and Tron handling in Mobile Bridge and multichain code
- Existing EVM bridge chain entries in `app/constants/bridge.ts` and Bridge redux selectors

Mirror existing naming, ordering, build-flag usage, and test style.

## Agent Execution Standard (SSOT)

For agent implementation or review tasks, follow this workflow exactly:

1. Confirm prerequisites and classify the network as EVM, non-EVM, or hybrid/unknown.
2. Review the closest EVM or non-EVM Mobile reference before making edits.
3. Bump `@metamask/bridge-controller` when Core package support lands in a new version.
4. Update Mobile bridge constants, feature flag defaults, default tokens, and BIP-44 default pairs where applicable.
5. Update account scope detection, network enablement, source/destination filtering, asset swap permissions, token icons, fee display, and transaction display where applicable.
6. Apply package/code gates, build flags, and LaunchDarkly `bridgeConfigV2` targeting together.
7. Validate that the network appears only when gated on and supported by accounts/network enablement.
8. Run focused `yarn jest ...` tests for changed areas and note any remaining gaps.

## Common Mobile Checklist

### 1. Bridge Constants

Update `app/constants/bridge.ts` when Mobile needs local bridge metadata:

- Allowed bridge chain IDs, if locally defined in the target checkout.
- `NETWORK_TO_SHORT_NETWORK_NAME_MAP`
- Network display names used by Bridge, activity, transaction details, and token selectors.

Prefer constants from `@metamask/bridge-controller` when Mobile already consumes them.

For EVM networks, add the local short-name entry using the Mobile network constant when needed, for example `NETWORK_CHAIN_ID.<NETWORK>`.

### 2. Feature Flags And Chain Ranking

Update or verify `bridgeConfigV2` handling:

- `tests/feature-flags/feature-flag-registry.ts`
- `app/core/redux/slices/bridge/index.ts`

Verify:

- The chain appears in `bridgeConfigV2.chainRanking` only for intended environments.
- `bridgeConfigV2.chains[caipChainId]` contains top assets, no-fee assets, batch-sell stablecoins, or gasless settings when applicable.
- `bridgeConfigV2.bip44DefaultPairs[namespace]` is present when the network needs a BIP-44 default pair.
- `minimumVersion` matches the intended Mobile release.

### 3. Default Tokens And Icons

Update `app/components/UI/Bridge/constants/default-swap-dest-tokens.ts`:

- `DefaultSwapDestTokens`
- `Bip44TokensForDefaultPairs`

For EVM networks, use the Mobile EVM chain ID key, a wildcard account key when that is the local pattern, and token icon URLs in the EVM token icon format, for example:

```text
https://static.cx.metamask.io/api/v1/tokenIcons/{decimalChainId}/{tokenAddress}.png
```

Use CAIP asset format for non-EVM assets:

```text
{namespace}:{reference}/{token_type}:{address}
```

Example:

```text
tron:728126428/trc20:TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
```

Verify token icons are available through the expected token icon source. For non-EVM assets, the icon path usually follows:

```text
https://static.cx.metamask.io/api/v2/tokenIcons/assets/{namespace}/{reference}/{token_type}/{address}.png
```

### 4. Account And Network Enablement

Update account and network enablement paths when the network has account-specific requirements:

- `app/selectors/multichainAccounts/accounts.ts`
- `app/components/UI/Bridge/hooks/useNonEvmAccounts/useNonEvmAccounts.ts`
- `app/components/UI/Bridge/hooks/useNonEvmTokensWithBalance/useNonEvmTokensWithBalance.ts`
- `app/components/UI/Bridge/hooks/useIsNetworkEnabled/index.ts`
- `app/selectors/networkEnablementController/index.ts`
- `app/selectors/bridge.ts`

The source-chain list must reflect the intersection of package allowlists, LaunchDarkly ranking, user-enabled networks, and compatible accounts.

### 5. Asset Swap Permissions

The Mobile Notion guide references older Swaps and Asset paths. In current Mobile checkouts, verify the exact current Unified Swaps/Bridge entry points before editing.

Search for existing patterns such as:

- `ONLY_INCLUDE_IF(tron)`
- `DefaultSwapDestTokens`
- `ALLOWED_BRIDGE_CHAIN_IDS`
- asset-level swap CTA gating in token detail or asset overview screens

Do not add code to stale paths that are absent from the target checkout.

### 6. Quote, Submit, Deeplink, And Display

Update or verify:

- `app/components/UI/Bridge/hooks/useBridgeQuoteData/index.ts`
- `app/components/UI/Bridge/hooks/useSwapBridgeNavigation/index.ts`
- `app/components/UI/Bridge/hooks/useBatchSellQuoteData/index.ts`
- `app/components/UI/Bridge/hooks/useFeeDisclaimer.ts`
- `app/core/DeeplinkManager/handlers/legacy/handleSwapUrl.ts`
- `app/util/bridge/hooks/useSubmitBridgeTx.ts`
- `app/components/UI/Bridge/components/TransactionDetails/TransactionDetails.tsx`
- `app/components/UI/ActivityListItemRow/useActivityListItemRowContent.ts`

When the Core package version includes updated quote fee types, remove stale local `@ts-expect-error` comments instead of preserving them.

Preserve analytics-relevant params when navigation opens or replaces Bridge screens.

## EVM-Specific Handling

For EVM networks:

- Add the EIP-155 chain ID and short network name where Mobile needs local metadata.
- Reuse existing EVM account, address, quote, approval, and submit behavior.
- Add default destination token metadata in `DefaultSwapDestTokens` only when the network should have a curated default.
- Verify source/destination visibility through `bridgeConfigV2` and package allowlists.
- Verify asset swap CTA behavior for tokens on the network.
- Verify fee display and batch-sell fee handling when the package bump changes quote fee types.
- Do not add CAIP account scope or snap-specific logic for a normal EVM network.

## Non-EVM-Specific Handling

For non-EVM networks:

- Import the network scope from `@metamask/keyring-api`.
- Add CAIP scope support where Mobile requires local constants.
- Use CAIP asset identifiers for default tokens and BIP-44 default pairs.
- Add network-specific account detection and source-chain visibility.
- Add recipient/destination account compatibility checks when account types differ.
- Add build-gated blocks such as `ONLY_INCLUDE_IF(network-name)` when Mobile uses conditional compilation for that network.
- Verify non-EVM token balances and token image handling.
- Add standalone Send handling only when the network supports standalone Send outside Bridge.

## Gating And Rollout

Apply all relevant rollout controls together:

- Package allowlists from `@metamask/bridge-controller`
- Package version bump in `package.json` and lockfile when the network depends on a newer `@metamask/bridge-controller`
- Mobile build gates or `ONLY_INCLUDE_IF(network-name)` blocks
- LaunchDarkly `bridgeConfigV2`
- Minimum version targeting
- User network enablement

Do not rely on only one rollout control.

## Validation Checklist

Before finishing, verify:

- The network is absent when package/build support is gated off.
- The network appears only in targeted `bridgeConfigV2` environments.
- The network appears in Bridge source and destination selections when gated on.
- Swaps functionality works for supported network assets.
- Default tokens display correctly.
- Token icons load correctly.
- Fee disclaimers and batch-sell fee calculations read typed quote fee fields without stale casts or `@ts-expect-error` comments.
- Account compatibility and network enablement filtering are correct.
- Transaction details display network information correctly.
- Deeplinks or activity entry points include the network only when supported.

## Test Guidance

Run focused tests with `yarn jest ...` for changed areas:

- `yarn jest app/core/redux/slices/bridge/index.test.ts`
- `yarn jest app/selectors/bridge.test.ts`
- `yarn jest app/components/UI/Bridge/components/BridgeTokenSelector/BridgeTokenSelector.test.tsx`
- `yarn jest app/components/UI/Bridge/hooks/useBridgeQuoteData/useBridgeQuoteData.test.ts`
- `yarn jest app/components/UI/Bridge/hooks/useBatchSellQuoteData/useBatchSellQuoteData.test.ts`
- `yarn jest app/util/bridge/hooks/useSubmitBridgeTx.test.tsx`
- `yarn jest app/components/Views/confirmations/hooks/send/useSendType.test.ts` when standalone Send is touched

If behavior changes, add or update tests in the closest existing test suites.

## Required Agent Response Sections

When using this standard, return:

1. `Prerequisites Check`
2. `Network Classification`
3. `Implementation Checklist`
4. `Files Changed`
5. `Gating Behavior Verified`
6. `Tests Run`
7. `Remaining Gaps`
