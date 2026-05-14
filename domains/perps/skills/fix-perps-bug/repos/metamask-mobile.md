---
repo: metamask-mobile
parent: fix-perps-bug
---

## File Paths

| Area | Path |
|---|---|
| Views | `app/components/UI/Perps/Views/` |
| Hooks | `app/components/UI/Perps/hooks/` |
| Utils | `app/components/UI/Perps/utils/` |
| TestIDs | `app/components/UI/Perps/Perps.testIds.ts` |
| Controller | `app/controllers/perps/` |
| Docs | `docs/perps/` (35 docs) |

## TestIDs

Convention: PascalCase selector objects in `Perps.testIds.ts`.

| Element | Selector |
|---|---|
| Position card | `PerpsPositionCardSelectorsIDs.CARD` |
| Balance | `PerpsMarketBalanceActionsSelectorsIDs.BALANCE_VALUE` |
| Order submit | `PerpsOrderViewSelectorsIDs.*` |
| TP price | `PerpsTPSLViewSelectorsIDs.TAKE_PROFIT_PRICE_INPUT` |
| Market row | `PerpsMarketRowItemSelectorsIDs.ROW_ITEM` |
| Close modal | `PerpsClosePositionViewSelectorsIDs.*` |

## Formatting

- Primary formatter: `formatPerpsFiat` in `app/components/UI/Perps/utils/formatUtils.ts`
- Implements adaptive sig-dig rules (see formatting-rules knowledge)
- Has i18n dependency for locale-specific number formatting
- 33KB file -- check the specific range handler for your value range

## Validation

1. `yarn lint` -- no lint errors in affected files
2. `yarn test --testPathPattern=Perps` -- run perps unit tests
3. `yarn build:ios` or `yarn build:android`
4. Detox E2E: `yarn test:e2e:ios --testNamePattern="perps"` (if perps E2E tests exist)
5. Manual: run on simulator, navigate to perps, verify the fix

## Architectural Notes

- Hooks are fine-grained: order form splits into `usePerpsOrderForm` + `usePerpsOrderFees` + `usePerpsOrderValidation` + `usePerpsOrderExecution`
- Each view is a separate screen with its own navigation route
- TP/SL is a separate view (`PerpsTPSLView`), not inline
- Close-all and cancel-all have dedicated views
- Controller changes sync to Core via `validate-core-sync.sh`
