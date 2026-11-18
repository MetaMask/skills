# Taste: what reviewers of this cleanup will push back on

Read this before writing any code for an asset-selector cleanup ticket. It comes from the extension maintainers' review comments and from the first cold-agent dry runs of this epic. Where a ticket's own copy of these rules differs, **this file wins** (it is newer).

## Keep the diff to the change
- Do not add JSDoc, comments or reformatting to lines you did not otherwise change. Do not edit an existing comment unless the ticket says to. Reviewers ask agents to revert these.
- Do not add a comment that restates the code ("// get the balance").
- The exception is JSDoc that ESLint requires on a **new** export (see below). Keep it short: one summary line, `@param`s and `@returns`.
- No "while I'm here" fixes. Note them in the PR as a follow-up instead.
- No `console.log`, `debugger` or commented-out code.

## Delete dead code
- If your change makes an import, helper, mock, test handler or type unused, delete it in the same PR. Examples: `toChecksumHexAddress` in BG-01, a `TokensController:getState` handler in BG-03, `#getNumberOfTokens` in BG-04.
- A test that sets up state the code no longer reads is dead too. Remove that setup, or point it at the new field.
- Do not leave a `TODO: remove once migrated` behind once you did the migration.

## Reuse what exists
- New-state selectors go in `shared/lib/selectors/assets-state.ts`, built on its four input selectors. Do not write a parallel helper in the consumer.
- Test fixtures come from `assets-state.test-utils.ts` (`build*` helpers, `ASSETS_STATE_FIXTURE`). Do not hand-build `InternalAccount` or `AssetMetadata` objects.
- Do not import fixtures from another feature's tests, and never from `assets-migration.test.ts`.
- Do not export a function only so that you can test it.

## Read new state, do not relocate the translation
- A new selector never returns a legacy type (`Token`, `MarketData`, `{ conversionRate }`, `{ balance: hexWei }`) or a `hexChainId → address` map. Key by account id and CAIP id and return stored values.
- Do not export a derivable value (a count, a boolean) as a selector. The consumer computes it from the primitive.
- A consumer helper that rebuilds the legacy map from a primitive is the translation layer moved, and reviewers will reject it. The ticket's *What the consumer now computes* line is the limit.
- Market data is fiat (`assetsPrice`). Do not divide by a native rate and then multiply back.
- Build ERC-20 ids with `toAssetId`, never `buildEvmCaip19AssetId` (it lowercases; stored ids are checksummed).

## Small, composed selectors
- Prefer small single-purpose selectors composed with `createSelector` over one selector that does everything.
- Prefer `Object.values`/`Object.entries` with `flatMap`/`filter`/`map`/`.length` over nested `for` loops. Use a loop only when it is clearly simpler, for example an early exit.

## Match the surrounding pattern
- Use `createSelector` from `reselect`, never `createDeepEqualSelector`, and never a plain `export function` for a selector.
- Match the file's existing import style and test structure (`describe` per export).
- Write TypeScript for new files. In JS files, do not convert unrelated code.

## Imports and types the dry runs got wrong
- `InternalAccount` comes from **`@metamask/keyring-internal-api`**, not `@metamask/keyring-api`.
- If a consumer still needs the legacy `Token` type, it comes from `@metamask/assets-controllers` (with the **s**); new selectors never return it. `AssetMetadata` and `AssetsControllerState` come from `@metamask/assets-controller` (no s).
- `Object.keys(...)` returns `string[]`. Write `Object.keys(assetsBalance[id] ?? {}) as CaipAssetType[]` before you index `assetsInfo`. That cast is the one allowed; do not reach for `as any` or `as unknown as` in source files.
- For JSDoc on a selector that reads `state.metamask`, ESLint's `jsdoc/check-param-names` requires the nested entry:
  ```ts
  /**
   * Native balance for an EVM address on a chain, as hex wei.
   *
   * @param state - Redux-shaped state.
   * @param state.metamask - The flat MetaMask state.
   * @param chainId - Hex chain id.
   * @param address - Account address, any casing.
   * @returns Hex wei, or undefined when there is no native balance.
   */
  ```

## Tests
- Name tests in the present tense, with no "should": `it('returns the selectedCurrency')`.
- When a change makes an existing test name wrong, rename it; this is in scope. **Never change an existing test's expected value.** If one has to change, the swap is not behavior-neutral: stop and report.
- Tests **wait**. Use `waitFor` (or the repo's test util); never flush promises (`await new Promise(setImmediate)`, `flushPromises()`) and never hand-roll timers.
- One readable assertion beats many: compare mapped arrays or objects with `toStrictEqual` rather than looping `expect`s.
- Prefer a single `it` that maps lookups over `it.each` for parity cases (`it.each` hit a type clash in one environment).
- Keep a test table inline while it is small; a short inline list is fine.

## PRs
- Draft PR. The title is the ticket title, a Conventional Commit.
- The changelog goes in the PR body as `CHANGELOG entry: null`, unless the ticket gives a user-facing entry. Never edit `CHANGELOG.md`.
- The class must match the change: refactors are `refactor`, new selectors with no consumer are `feat`, comment-only changes are `chore`.
- CI red for a reason outside your diff is not yours to fix. Do not edit a workflow or an unrelated test to make CI green.
