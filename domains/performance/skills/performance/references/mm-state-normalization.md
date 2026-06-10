---
title: State Normalization & Selector Shape (MetaMask)
impact: HIGH
tags: redux, normalization, selectors, O(1)-lookups, cache-thrashing, useSelector
---

# Skill: State Normalization & Selector Shape

Selector *memoization* fixes when things recompute; state and selector **shape** fixes how much each recomputation costs and how many subscriptions fire. The patterns here come from the extension performance audit (MetaMask-planning#6580, #6484), where linear scans and reshaping selectors multiplied across power-user data: with 1,000 tokens, 27 `.find()`-based lookups per render is 27,000 comparisons — per render.

## Pattern — O(n) scans where the state shape should provide O(1) lookups

```ts
// ❌ linear scan through all accounts on every call
export const getAccountByAddress = createSelector(
  selectAccounts,
  (_, address) => address,
  (accounts, address) =>
    Object.values(accounts).find((a) => a.address.toLowerCase() === address.toLowerCase()),
);
```

When lookups by some key are frequent, **index the state once** instead of scanning per consumer:

```ts
// ✅ build the index once per data change; lookups are O(1) key access
export const selectAccountsByAddress = createSelector(selectAccounts, (accounts) =>
  Object.fromEntries(Object.values(accounts).map((a) => [a.address.toLowerCase(), a])),
);
// consumers key into the memoized index — no scan, no per-arg selector cache to bust
const account = useSelector(selectAccountsByAddress)[address.toLowerCase()];
```

Normalized shape (`byId` / `byAddress` maps + an `ids` array for order) is the same idea applied at the reducer level — the index is maintained on write instead of derived on read.

## Pattern — parameterized selector cache thrashing

`createSelector` has a **single-entry cache**. A parameterized selector called with different arguments from different components busts that one cache slot on every call:

```ts
// ❌ each component's call evicts the previous component's result
const a1 = useSelector((s) => getAccountByAddress(s, addr1)); // miss
const a2 = useSelector((s) => getAccountByAddress(s, addr2)); // miss, evicts addr1
const a3 = useSelector((s) => getAccountByAddress(s, addr3)); // miss, evicts addr2 — and so on every render cycle
```

In a list rendering N rows, the "memoized" selector recomputes N times per render, forever. Fixes, in order of preference:

1. **Lookup-map selector** (above): select the whole memoized index once; key into it. Sidesteps per-arg caching entirely.
2. **Per-instance selector**: a factory (`makeSelectAccountByAddress()`) instantiated in the component with `useMemo`, so each call site owns its own cache slot.
3. **Bigger cache**: reselect's `lruMemoize` with `maxSize: N` — last resort; sizing is a guess that goes stale.

```bash
# parameterized selectors: second input selector reads the argument, not state
grep -rn "(_, \|(_state" app/selectors --include="*.ts"
```

## Pattern — selectors that reorganize nested state

```ts
// ❌ inverts { account → chain → tokens } into { chain → account → tokens } on every recompute
export const getTokensByChain = createSelector(selectAllTokens, (byAccount) => {
  const byChain = {};
  for (const [account, chains] of Object.entries(byAccount))
    for (const [chainId, tokens] of Object.entries(chains))
      (byChain[chainId] ??= {})[account] = tokens;
  return byChain;
});
```

A full restructure allocates a new tree every recomputation — expensive to build, and every consumer sees a fresh reference. If two access patterns are both hot, **store both shapes** (maintain the second index in the reducer on write) or normalize so both reads are key lookups. A reshaping selector is acceptable only for cold paths.

## Pattern — deep property access instead of composed input selectors

```ts
// ❌ re-derives the full path; recomputes when ANY ancestor changes; nothing is reusable
export const getGroupName = (state, walletId, groupId) =>
  state.engine.accountTree.wallets[walletId]?.groups[groupId]?.metadata?.name;
```

Compose granular selectors at each level (`selectWallets` → `selectWalletById` → `selectGroupById` → …). Each layer memoizes independently, intermediate results are reusable by other selectors, and a change to one wallet no longer recomputes selectors reading a different one. This is also what keeps inputs *narrow* — the prerequisite for the memoization patterns in [mm-selector-memoization.md](mm-selector-memoization.md).

## Pattern — many useSelector calls where one view selector should exist

```tsx
// ❌ 11 store subscriptions; each runs on every dispatch; component re-checks 11 results
const quotes = useSelector(getQuotes);
const currency = useSelector(getCurrentCurrency);
const gasFee = useSelector(getGasFee);
// … ×8 more
```

Each `useSelector` is an independent store subscription with its own equality check per dispatch. When a component reads 5+ related values, combine them into **one memoized view selector** that returns the assembled view-model. One subscription, one equality check, one place where the shape is defined — and a natural home for the derivation logic that would otherwise sit unmemoized in the component (where, note, the React Compiler can't stabilize it — see [mm-selector-cascade.md](mm-selector-cascade.md)).

The same consolidation applies to **duplicate derived-data implementations**: the extension audit found 4+ independent fiat-conversion code paths recomputing the same numbers in different components. One canonical selector ends both the wasted compute and the drift between implementations.

## How to find

```bash
# linear scans inside selectors/hooks
grep -rn "Object.values(.*)\.\(find\|filter\)\|\.find((" app/selectors app/components --include="*.ts*" | grep -v ".test."

# reshaping selectors: nested loops/reduce building objects in a result function
grep -rn -B2 "??= {}\|reduce((acc" app/selectors --include="*.ts"

# components with many subscriptions (5+ useSelector in one file = consolidation candidate)
grep -rc "useSelector(" app/components --include="*.tsx" | awk -F: '$2>=5' | sort -t: -k2 -rn | head -20
```

## Verify

- Lookup fix: recomputation count on the index selector is ~1 per data change (not per render); list scroll/render time drops in the Profiler.
- Consolidation: the component's "why did this render" shows one subscription firing instead of N; render count per dispatch drops.
- Normalization: reducer tests confirm both shapes stay in sync on write.

## Don't over-correct

- Don't normalize a slice that's only ever iterated in full — indexes pay for themselves on *keyed lookups*, not on `.map()` over everything.
- Don't merge *unrelated* selectors into one mega view selector — that re-couples components to data they don't read and re-renders them for it. Consolidate related values consumed together.
- `maxSize`/factory-selector machinery is for genuinely parameterized hot paths; for one or two call sites the lookup-map pattern is simpler and stays correct.

## Related

- [mm-selector-memoization.md](mm-selector-memoization.md) — memoization correctness for the selectors shaped here
- [mm-selector-cascade.md](mm-selector-cascade.md) — graph-level repair when a root selector poisons consumers
- [mm-redux-antipatterns.md](mm-redux-antipatterns.md) — inline selectors and `isEqual` band-aids
