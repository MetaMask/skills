# Patterns: before/after for asset-selector cleanup tickets

Short, copyable shapes. Where a ticket's own copy differs, **this file wins** (it is newer).

## 1. Step A selector (new-state, no consumers)

Append to `shared/lib/selectors/assets-state.ts`. Build only on the ASM-0-00 input selectors; each one defaults a missing slice to one module-level frozen `{}`.

**Shape rule.** Key by account id and CAIP id and return stored values. Never return a legacy type (`Token`, `MarketData`, `{ conversionRate }`, `{ balance: hexWei }`) or a `hexChainId → address` map, and never export a derivable value (a count, a boolean): the consumer computes it.

**Style rule.** Prefer small single-purpose selectors composed with `createSelector`, and `Object.values`/`Object.entries` + `flatMap`/`filter`/`map`/`.length` chains over nested `for` loops. Use a loop only when it is clearly simpler (for example an early exit over a large map). Keep building blocks private (no `export` just for tests).

```ts
// Before: (nothing). The value only exists via the legacy translation layer.

// After: a private building block …
const selectEvmAssetIdsByAccountId = createSelector(
  [selectAssetsBalance, selectCustomAssets, selectInternalAccountsById],
  (assetsBalance, customAssets, accountsById): Record<string, CaipAssetType[]> =>
    Object.fromEntries(
      Object.values(accountsById)
        .filter((account) => isEvmAccountType(account.type))
        .map((account) => [
          account.id,
          [...new Set([
            ...(Object.keys(assetsBalance[account.id] ?? {}) as CaipAssetType[]),
            ...(customAssets[account.id] ?? []),
          ])],
        ]),
    ),
);

// … composed into the exported primitive.
export const getEvmTokenIdsByAccountId = createSelector(
  [selectEvmAssetIdsByAccountId, selectAssetsInfo],
  (assetIdsByAccountId, assetsInfo): Record<string, CaipAssetType[]> =>
    Object.fromEntries(
      Object.entries(assetIdsByAccountId).map(([accountId, assetIds]) => [
        accountId,
        assetIds.filter((assetId) => isEvmTokenId(assetId, assetsInfo)),
      ]),
    ),
);

// Parametrised: args become extra input selectors. Return the stored value.
export const getNativeFiatRate = createSelector(
  [selectAssetsPrice, selectEvmNativeAssetIdByChainId, (_state: AssetsPriceStateSlice, chainId: Hex) => chainId],
  (assetsPrice, nativeAssetIdByChainId, chainId) => {
    const assetId = nativeAssetIdByChainId[chainId];
    return assetId === undefined ? undefined : assetsPrice[assetId];
  },
);
```

Rules:
- Never write the string `assets-migration` in `assets-state.ts` or its unit tests.
- Never call a parametrised selector inside another selector's input function.
- Build ERC-20 ids with `toAssetId` (`shared/lib/asset-utils.ts`), never `buildEvmCaip19AssetId` (it lowercases; stored ids are checksummed).

## 2. Consumer swap (Step B)

The consumer reads a primitive and computes its own small answer. The ticket's **What the consumer now computes** line says exactly what that is.

```ts
// Before: rebuild every account × chain × Token[], then count
const allTokens = getTokensControllerAllTokens({ metamask: state });
const numberOfTokens = Object.values(allTokens).reduce(
  (sum, byAddress) => sum + Object.values(byAddress).reduce((s, tokens) => s + tokens.length, 0),
  0,
);

// After: the consumer computes only the count
import { getEvmTokenIdsByAccountId } from '../../../shared/lib/selectors/assets-state';
const numberOfTokens = Object.values(getEvmTokenIdsByAccountId({ metamask: state })).flat().length;
```

```ts
// Before: fiat → native in the translation, native → fiat in the consumer
const fiat = marketData[chainId]?.[address]?.price * currencyRates[ticker].conversionRate;

// After (D2 (a)): read the fiat price; both operations go away
const fiat = assetsPrice[toAssetId(address, chainId)]?.price;
// tests: expect(fiat).toBeCloseTo(expected, 10)  (the ticket names the precision)
```

Rules:
- Keep a **leaf** consumer's exported names, arguments and return shape. Legacy-shaped intermediate builders (`getMetaMaskAccounts`, `getMetaMask*CachedBalances`) are aliases: migrate their consumers first, then delete them. If a leaf's shape must change, stop: the ticket is "tricky: needs further breakdown".
- Never add a helper in the consumer that rebuilds the legacy map from the primitive. That is the translation layer, relocated.
- Delete the now-unused import names (and the whole migration import if it is empty).
- **Do not edit any existing expected value in the consumer's tests.** The single exception is a D2 market-data ticket switching to `toBeCloseTo`, which the ticket names.

## 3. Parity case (Step A tickets only)

Append one `it` to `shared/lib/selectors/assets-state.parity.test.ts`. This file is the **only** new code allowed to import the legacy module, and ASM-C-01 deletes it.

Convert **each side's keys** to one comparable string form and compare sorted lists. Never rebuild the legacy shape from the new result.

```ts
it('getEvmTokenIdsByAccountId matches legacy allTokens per account and chain', () => {
  const { accounts } = ASSETS_STATE_FIXTURE.metamask.internalAccounts;

  expect(
    Object.entries(getEvmTokenIdsByAccountId(ASSETS_STATE_FIXTURE))
      .flatMap(([accountId, assetIds]) =>
        assetIds.map((assetId) => {
          const { chain, assetReference } = parseCaipAssetType(assetId);
          return `${decimalToPrefixedHex(chain.reference)}/${accounts[accountId].address}/${toChecksumHexAddress(assetReference)}`;
        }),
      )
      .sort(),
  ).toStrictEqual(
    Object.entries(getTokensControllerAllTokens(legacyState))
      .flatMap(([chainId, byAddress]) =>
        Object.entries(byAddress).flatMap(([address, tokens]) =>
          tokens.map((token) => `${chainId}/${address}/${token.address}`),
        ),
      )
      .sort(),
  );
});
```

Rules:
- Use the shared `ASSETS_STATE_FIXTURE`. If the fixture lacks a case your selector cares about, stop and report; do not grow the fixture in a selector ticket.
- Cover every account and chain in the fixture (it has mixed-case address spellings). Stored casing alone missed a case-insensitive-match bug.
- Express the legacy side exactly as the consumer reads it today (same key and casing).
- **Planted-bug check:** loosen the selector's filter once (for example drop `type !== 'native'`), confirm the parity or unit case goes red, then restore. Say which line you changed in the PR.
- A failing parity case means the new selector is wrong, or the ticket's spec is. Stop and report. Never "fix" it by changing the legacy expression.

## 4. Discriminating case (every consumer ticket)

The test must fail if the consumer still read the legacy source. Make the legacy field and the new field **disagree**, and assert the new value.

```js
// Before: legacy and new fields agree, so the test passes either way
const state = { metamask: { currentCurrency: 'usd', selectedCurrency: 'usd' } };
expect(getCurrentCurrency(state)).toBe('usd');

// After (added, existing case left as is)
it('returns selectedCurrency when it differs from currentCurrency', () => {
  const state = { metamask: { currentCurrency: 'usd', selectedCurrency: 'eur' } };
  expect(getCurrentCurrency(state)).toBe('eur');
});
```

**Revert check:** prove the case by swapping your expression for the naive field reads (new field with no default, then legacy field), never by reverting to the migration selector, which already returns the new value under `IN_TEST`. If the migration selector applies a default (for example `selectedCurrency ?? 'usd'`), keep the default and add an unset case:

```js
it('returns usd when selectedCurrency is unset', () => {
  expect(getCurrentCurrency({ metamask: { currentCurrency: 'eur' } })).toBe('usd');
});
```

For token or balance swaps, seed the legacy slice (`allTokens`, `accountsByChainId`, `accountTrackerController.state`) with a different value from the new slices (`assetsBalance` and friends), or omit the legacy slice entirely.

## 5. Referential stability (any swap returning an object or array)

The legacy selectors were deep-equal memoised, so a plain `createSelector` swap can create new references on every call and re-render consumers.

```ts
it('returns the same reference for the same state', () => {
  const state = buildState(/* … */);
  const first = getEvmTokenIdsByAccountId(state);
  getEvmTokenIdsByAccountId(buildState(/* other data */)); // interleaved call
  expect(getEvmTokenIdsByAccountId(state)).toBe(first);
});
```

- Parametrised selectors interleave a call with **different args** (for example `getNativeFiatRate(state, '0xe708')` between two `'0x1'` calls).
- Assert with `toBe` (same reference), never `toStrictEqual`.
- For a consumer selector, call it twice with the **same state object** and `toBe` the results.
- Skip this rule for primitive returns (strings, numbers, hex), and say so in the PR self-check.
