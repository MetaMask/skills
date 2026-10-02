---
name: activity-mappers
description: >-
  Guidance for Activity List and Activity Item changes: start in
  `@metamask/client-utils/mappers` to share behavior across the mobile and
  extension apps. Prefer API data, or the keyring transaction for non-EVM;
  avoid massaging local state. Use when changing Activity List, Activity Item,
  or their data mapping.
---

# Activity mapper guide

## When to use

- Change an Activity list, row, item, mapper, or details template.
- Change Activity data, source precedence, filtering, or details routing.

## Start with the source

| Source | Mapper |
| --- | --- |
| EVM API transaction | `mapApiTransaction` |
| Local EVM transaction | `mapLocalTransaction` |
| Non-EVM transaction | `mapKeyringTransaction` |
| Ramps order | `mapRampsOrder` |
| Swap or bridge | `mapLocalTransaction` |

## Shared contract and rules

Both clients use `@metamask/client-utils` activity types and mappers. Start
there when a change can affect both clients.

- Use API activity when it has the best classification or metadata.
- Use the keyring transaction for non-EVM activity.
- Keep source-specific facts near the source. Do not create a second local
  state representation only to shape an Activity row.
- Preserve a more specific activity type over `contractInteraction`.
- Add mapper tests in the shared package for shared behavior. Add client tests
  for client data or presentation behavior.

## Cross-client map

| Feature, function, or flow | Mobile | Extension |
| --- | --- | --- |
| Base Activity contract | `@metamask/client-utils` provides `ActivityItem` and core mappers. Mobile adds `ActivityListItem` fields. | `shared/lib/activity/types.ts` adds Money Account kinds. |
| Public adapter boundary | `app/util/activity-adapters/index.ts` exports Mobile adapters and display helpers. | No barrel. Start in `ui/selectors/activity.ts`. |
| Adapter dependencies | `adapters/environment.ts` injects metadata, asset, status, and parsing dependencies. | Redux state is read in `ui/selectors/activity.ts`. |
| Transaction grouping | `adapters/transaction-group.ts` groups attempts, fees, related Pay transactions, and account context. | `TransactionGroup` plus `ui/pages/activity/useLocalTransactions.ts`. |
| EVM local mapping | `enrich-local-activity.ts` enriches core-mapper output with local facts. | `selectLocalActivityItems` prepares mapper data. `ui/selectors/activity/enrich-local-activity.ts` adds Extension cases. |
| Local enrichment | Covers staking, mUSD, Money Account, Predict and Perps funds, deployments, upgrades, transfers, approvals, fees, cancellation, and bridge or swap data. | Transfers, approval revoke, mUSD claim, Money Account, and bridge data. No unified-list staking, Predict, deployment, or upgrade mapper. |
| Token and approval parsing | `adapters/helpers.ts` resolves token metadata, transfer facts, unlimited approvals, NFT transfers, and fees. | `shared/lib/activity/adapters/helpers.ts` and `ui/selectors/activity/enrich-local-activity.ts`. |
| Bridge and swap enrichment | Uses bridge quotes and legacy swap metadata to derive status and token legs. | Bridge history in `ui/selectors/activity.ts`. |
| Non-EVM mapping | Mobile local adapters produce shared activity items for non-EVM sources. | `mapKeyringTransaction` in `ui/selectors/activity.ts`. |
| API activity mapping | Mobile fetch hooks map API and domain sources into one Activity shape. | `ui/pages/activity/useTransactionsQuery.ts` for lists. `mapApiTransaction` in `ui/pages/details/transaction-details.tsx` for details. |
| Source merge and deduplication | `adapters/dedup.ts` and list transformations prevent duplicate local, API, and domain rows. | `ui/pages/activity/helpers.ts` deduplicates, sorts, and groups rows. |
| Ramps mapping | `ramp-order.ts` and `ramps-order.ts` handle two Mobile order sources. | `ui/hooks/ramps/utils/mapRampsOrderSafely.ts` and `ui/selectors/rampsController/index.ts`. |
| Perps activity | `perps-transaction.ts` maps deposits, withdrawals, funding, fills, and orders. | `ui/pages/perps/perps-activity-page.tsx` is separate from the unified list. |
| Predict activity | `predict-activity.ts` maps prediction, cash-out, and claim entries. | No unified-list mapper or details template. |
| Money Account activity | Mobile local enrichment includes Money Account behavior. | `ui/pages/money/money-activity-page.tsx` is separate, with generic local-item enrichment. |
| Fee policy | `fees.ts` defines Mobile fee behavior, including sponsored gas. | `shared/lib/activity/adapters/helpers.ts`. Money uses `ui/hooks/money/use-money-transaction-fee.ts`. |
| Fiat and token formatting | `fiat.ts` and `token-display.ts` format signed values and token amounts. | `shared/lib/activity/fiat.ts` and `ui/pages/activity/rows/useActivityRowContent.tsx`. |
| List transformations | `activity-list-helpers.ts` handles date grouping, source precedence, and display data. | `ui/pages/activity/helpers.ts` and `ui/pages/activity/query-filters`. |
| Activity list | `ActivityList.tsx` and source hooks unify local, API, Perps, Predict, and Ramps items. | `ui/pages/activity/activity-list.tsx` unifies local, API, non-EVM, and Ramps items. |
| Activity rows | `ActivityListItemRow.tsx`, layout, and icon helpers render rows. | `ui/pages/activity/rows/activity-row.tsx`, `activity-row-layout.tsx`, and `useActivityRowContent.tsx`. |
| Pending rows and actions | Pending row and actions present queued and pending activity. | `pending-activity-row.tsx` and `pending-transaction-actions.tsx`. |
| Details item lookup | `useActivityDetailsItem.ts` resolves cached, API, local, and domain items. | `transaction-details.tsx` resolves Ramps, API or local EVM, non-EVM, then API. |
| Details template dispatch | `TemplateLoader.tsx` dispatches generic and domain-specific templates. | `ui/pages/details/templates/template-loader.tsx`. |
| Details layout, amounts, status, and metadata | Mobile has reusable details frame, metadata, amount, fee, status, pending-banner, and footer components. | `ui/pages/details/components` plus templates. |
| Bridge details | `BridgeDetails.tsx` and metadata components show quote legs, status, and explorer links. | `ui/pages/details/templates/bridge-details`. |
| Domain details | Mobile has Perps, Predict, and Ramps templates. | Ramps, Perps funds, and Money. No Predict or shared timeline. |
| Explorer lookup and actions | `useActivityBlockExplorer.ts` resolves primary and multi-step explorer links. | Details components and bridge-template utilities. |
| Activity analytics | Mobile tracks `Activity Details Opened`. | `activity-list.tsx` and `useActivityScreenViewed.ts`. |

## Transaction details ownership

The code owner reviews the changed file. The domain team owns the product
behavior and data path. Ask both teams to review a change that crosses those
boundaries.

| Transaction details group | Detail files | Code owner | Domain team to involve |
| --- | --- | --- | --- |
| Shared shell and generic Activity details | `transaction-details.tsx`, `components`, `template-loader.tsx`, default, send, NFT, approval, convert, and asset-activation templates | `@MetaMask/core-extension-ux` | `@MetaMask/core-extension-ux` |
| Swap and convert | `swap-details.tsx`, `convert-details.tsx`, swap-again and convert-again controls | `@MetaMask/core-extension-ux` | `@MetaMask/swaps-engineers` |
| Bridge | `bridge-details`, bridge explorer controls | `@MetaMask/core-extension-ux` | `@MetaMask/swaps-engineers` |
| Perps funding | `perps-deposit-details.tsx`, `perps-details.tsx` | `@MetaMask/core-extension-ux` | `@MetaMask/perps` |
| Money Account and MetaMask Pay | `money-account-details.tsx`, `mm-pay-details-layout.tsx` | `@MetaMask/core-extension-ux` | `@MetaMask/earn` |
| Ramps orders | `ui/pages/details/templates/ramps` | `@MetaMask/money-movement` | `@MetaMask/money-movement` |

`ui/pages/details` makes Core Extension UX the code owner for most details
templates. Ramps is the only details-template directory with an explicit
override. A file name such as `perps-details.tsx` or `bridge-details.tsx` does
not change its code owner by itself.

## How to

### Fix a missing or wrong amount

- ✅ Do this: Treat missing decimals as an unknown scale. Keep EVM base-unit
  amounts separate from human-readable keyring and Ramps amounts. Test known
  decimals, missing decimals, zero-value native transactions, and ERC-20s
  with incomplete metadata.
- ❌ Don't do this: Scale an EVM amount by zero, show a raw base-unit value, or
  invent a zero amount when the source does not provide one.

### Fix a missing logo or token label

- ✅ Do this: Supply `assetId`, symbol, and decimals from the activity source.
  If local data is incomplete, use watched-token or known-token metadata.
  Check custom networks and tokens that are known but not watched.
- ❌ Don't do this: Make a row guess a token identity from a symbol or render a
  partial token object without an `assetId`.

### Replace a generic contract interaction

- ✅ Do this: Keep pending activity local. Let finalized API data replace an
  incomplete local item. Preserve a specific type over `contractInteraction`.
  Apply the same source-precedence rule in list deduplication and details
  lookup.
- ❌ Don't do this: Replace a categorized local item with a less-specific API
  item, or give the list and details different precedence rules.

### Open Activity details from every entry point

- ✅ Do this: Route with a stable identifier that exists while the transaction
  is pending. Fetch activity when a details route opens with a cold cache.
  Test the list, token page, home or market preview, and a cold start.
- ❌ Don't do this: Assume an EVM transaction hash always exists, or render an
  unavailable state before an eligible details query finishes.

### Filter Activity without hiding valid rows

- ✅ Do this: Pass the selected account and requested network or asset to the
  mapper. Test send, receive, self-send, contract interaction, bridge, and
  non-EVM rows on the filtered surface.
- ❌ Don't do this: Add a client-side `from` or `to` filter when the API already
  scopes the account. Some valid activity does not use that simple shape.

### Load and refresh Activity safely

- ✅ Do this: Model loading, settled-empty, and populated states separately.
  Refresh API activity after local confirmation. Test a cold load, an empty
  account, a pending transaction that confirms, and pagination.
- ❌ Don't do this: Show empty copy while the first page is loading, or leave a
  confirmed row on stale local data until the normal cache refresh.

### Merge bridge and non-EVM activity

- ✅ Do this: Normalize EVM hashes consistently, retain native non-EVM
  identifiers, and use indexed lookups for bridge history and deduplication.
  Test same-chain swaps, cross-chain bridges before and after the destination
  leg, duplicate source IDs, and EVM hash case differences.
- ❌ Don't do this: Scan bridge history for every row, normalize all non-EVM IDs
  as EVM hashes, or deduplicate only one activity source.

### Find a prior Activity fix

- ✅ Do this: Search closed issues and pull requests in Extension and Mobile by
  activity kind, source, chain, and symptom. Read the issue and the closing
  pull request before changing a mapper, source-precedence rule, or details
  route.
- ❌ Don't do this: Copy a client-specific fix without checking the shared mapper
  contract and the other client's behavior.

## Workflow

Use this checklist for an Activity change.

1. Search closed Extension and Mobile issues and pull requests for the changed
   activity kind, source, chain, and symptom.
2. Identify the source: Accounts API, local EVM transaction group, keyring
   transaction, Ramps order, Money activity, or a domain controller.
3. Check whether `@metamask/client-utils` already maps the behavior.
4. Put client-only enrichment next to the client data it needs.
5. Check list deduplication and details precedence for the same identifier.
6. Update the affected row and details template, including pending, failed,
   incomplete metadata, and non-EVM behavior where applicable.
7. Add or update focused tests in the mapper, selector or hook, row, and
   details layer that owns the changed behavior.
