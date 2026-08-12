---
name: selector-antipatterns
domain: performance
description: The Redux selector patterns that break memoization and cause render cascades — the canonical, platform-agnostic taxonomy that per-repo selector references instantiate
---

# Selector Anti-Patterns

**This file is the single source for the pattern taxonomy.** Per-repo references — such as
the `mm-selector-memoization` reference shipped with the `performance` skill — name these
patterns rather than redefining them, and add what only they can: the codebase's own
selector-creator utilities, verified instances with `file:line`, and fix recipes.

Every pattern below has the same failure shape: `useSelector` returns a **new reference**
when the underlying data did not change, so every consumer re-renders. One broken selector
near the root of the graph cascades through everything downstream, and the cost scales
superlinearly with user data.

## 1. Unmemoized selector

A plain function that allocates. No memoization at all — a new reference on every call.

```typescript
// ❌ BROKEN
export function getPendingApprovals(state) {
  return Object.values(state.pendingApprovals ?? {});
}

// ✅ FIXED
const getPendingApprovalsObject = (state) => state.pendingApprovals ?? {};
export const getPendingApprovals = createSelector(
  getPendingApprovalsObject,
  (approvals) => Object.values(approvals),
);
```

Detection: grep exported `function get…` in the selectors directory.

## 2. Identity / passthrough result

The transform happens in the **input** and the result function returns its input unchanged,
so the cache can never hit. A plain `createSelector` only helps when its *inputs* are
reference-stable; controller-state slices usually are not.

```typescript
// ❌ BROKEN: Object.values() in the INPUT creates a new array each call
export const getAccounts = createSelector(
  (state) => Object.values(state.accounts),
  (accounts) => accounts, // identity — cache never hits
);

// ✅ FIXED: stable input, transform in the OUTPUT
export const getAccounts = createSelector(
  (state) => state.accounts, // stable structural reference
  (accounts) => Object.values(accounts),
);
```

Detection: the reselect/Jest warning `"result function returned its own inputs"`.

## 3. New collection allocated in the result function

Even a correctly-shaped `createSelector` returns a new reference whenever it recomputes —
and if its inputs are unstable, that is every dispatch.

```typescript
// ❌ new array/Set/Map/object every call → always "changed"
(accounts) => Object.values(accounts).sort(...)
(transactions) => new Set(transactions.flatMap(...))
(items) => items.filter(...)
(state) => state.swapsTransactions ?? {}   // a fresh {} on every nullish hit
```

**Fix:** a deep-equal selector creator (returns the *cached* reference when data is
unchanged), a stable module-level constant for the empty case, or a result-equality check.

## 4. Mutation in the result function

```typescript
// ❌ mutates the input array AND returns a corrupting reference
createSelector([getItems], (items) => { items.sort(cmp); return items; })
```

**Fix:** copy first — `[...items].sort(cmp)`.

## 5. Over-broad input

`state => state`, or a large slice, as an input selector forces recomputation on **any**
state change anywhere. Narrow the input to the smallest slice that actually feeds the
result.

## 6. Unnecessary deep equality

Deep-equal creators cost O(n) per comparison. Reaching for one when the input is already
reference-stable pays that cost for nothing — and deep-comparing a large slice on every
dispatch can be worse than the re-render it prevents.

```typescript
// ❌ UNNECESSARY: this slice is already reference-stable
const getAccounts = createDeepEqualSelector(
  (state) => state.accounts,
  (accounts) => transformAccounts(accounts),
);
```

Prefer **narrowing the input** over deep-equalizing a giant object.

## 7. O(n) lookups over unnormalized state

`.find()` over `Object.values()` is O(n). With n items × m selectors per state change that
is O(n×m) on every dispatch.

```typescript
// ❌ BROKEN
export const getAccountByAddress = (state, address) =>
  Object.values(state.accounts).find((a) => a.address === address);

// ✅ FIXED: normalized state, O(1) access
export const getAccountByAddress = (state, address) => state.accounts[address];
```

## 8. Chained unmemoized transforms

Each transform allocates. Several in sequence means several new references per call.

```typescript
// ❌ BROKEN: 3 new arrays per call
export function getSortedItems(state) {
  const items = Object.values(state.items);    // array 1
  const filtered = items.filter(isVisible);    // array 2
  return filtered.sort(byDate);                // array 3
}

// ✅ FIXED: single memoized output
export const getSortedItems = createSelector(
  (state) => state.items,
  getFilterCriteria,
  (items, criteria) =>
    Object.values(items).filter((i) => matchesCriteria(i, criteria)).sort(byDate),
);
```

## Selector creator decision tree

```
Is the INPUT unstable (a fresh object/array every dispatch)?
├── YES → deep-equal selector creator (but prefer narrowing the input first)
└── NO  → Is the OUTPUT unstable (a new array/object from the transform)?
    ├── YES → result-equality selector creator
    └── NO  → plain createSelector
```

## Don't over-correct

- A selector returning a **primitive** is fine even if it filters internally — the consumer
  memoizes on the primitive value. Wasteful allocation, not a re-render bug.
- Memoization is not free. Prefer narrowing inputs over adding comparison work.

## Related

- `render-cascade` — what one broken root selector does to the component graph downstream.
- Per-repo instances: the `mm-selector-memoization` reference documents a codebase's own
  selector creators, its verified broken selectors, and the fix recipe for each.
