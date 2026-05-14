---
repo: metamask-extension
parent: fix-perps-bug
---

## File Paths

| Area | Path |
|---|---|
| Components | `ui/components/app/perps/` |
| Pages | `ui/pages/perps/` |
| Hooks | `ui/hooks/perps/` |
| Utils | `ui/components/app/perps/utils.ts` |
| Transforms | `ui/components/app/perps/utils/transactionTransforms.ts` |
| Stream bridge | `app/scripts/controllers/perps/perps-stream-bridge.ts` |
| Routes | `ui/helpers/constants/routes.ts` |

## TestIDs

Convention: kebab-case strings, inline in JSX.

| Element | TestID |
|---|---|
| Position card | `position-card-{symbol}` |
| Order card | `order-card-{orderId}` |
| Balance | `perps-balance-dropdown-balance` |
| Submit order | `order-entry-submit-button` |
| Direction tabs | `direction-tab-long` / `direction-tab-short` |
| TP price | `tp-price-input` |
| Market row | `explore-crypto-{symbol}` |
| Close modal | `perps-close-position-modal` |

## Formatting

Known hotspots with incorrect formatting:

```
ui/components/app/perps/utils/transactionTransforms.ts    -- .toFixed(2) x7
ui/components/app/perps/order-entry/components/auto-close-section/  -- {min:2, max:2}
ui/components/app/perps/order-entry/components/limit-price-input/   -- {min:2, max:2}
ui/components/app/perps/edit-margin/edit-margin-modal-content.tsx    -- .toFixed(2)
ui/components/app/perps/reverse-position/reverse-position-modal.tsx  -- .toFixed(2)
ui/hooks/perps/usePerpsOrderForm.ts                                  -- formatCurrencyWithMinThreshold x6
```

- Search for `.toFixed(2)`, `formatNumber({min:2, max:2})`, `formatCurrencyWithMinThreshold` in affected files
- Do NOT add more `.toFixed(2)` -- use `formatCurrencyWithMinThreshold` as interim
- Target behavior: mobile's `formatPerpsFiat` adaptive sig-dig rules

## Validation

1. `yarn lint` -- no lint errors
2. `yarn test:unit` -- run tests for affected files
3. `yarn build` -- TypeScript compiles
4. Manual: load extension, navigate to perps, verify the fix in the browser
5. E2E: check if existing perps E2E tests cover the affected flow

## Architectural Notes

- Order form is a single `usePerpsOrderForm` hook (mobile splits into 4)
- TP/SL is inline in `auto-close-section.tsx` (mobile has separate view)
- Close position is a modal, not a page
- `usePerpsStreamManager` controls all live data subscriptions
- Missing screens: close-all, cancel-all, withdraw, order book, order details
