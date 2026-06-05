---
name: selector-anti-patterns
domain: performance
description: Five Redux selector patterns that that break selector memoization and cause render cascades
---

# Selector Anti-Patterns

Each pattern causes `useSelector` to return a new reference on every call, triggering unnecessary re-renders.

## The Five Patterns

### 1. Plain Function Selector

No memoization. Returns new reference every call.

```typescript
// ❌ BROKEN
export function getPendingApprovals(state) {
  return Object.values(state.metamask.pendingApprovals ?? {});
}

// ✅ FIXED
const getPendingApprovalsObject = (state) => state.metamask.pendingApprovals ?? {};
export const getPendingApprovals = createSelector(
  getPendingApprovalsObject,
  (approvals) => Object.values(approvals),
);
```

Detection: `grep -r "export function get" ui/selectors/`

### 2. Identity Function Selector

Transform in input, identity in result → memoization is broken.

```typescript
// ❌ BROKEN: Object.values() in INPUT creates new array
export const getAccounts = createSelector(
  (state) => Object.values(state.accounts),
  (accounts) => accounts, // identity — cache never hits
);

// ✅ FIXED: Stable input, transform in OUTPUT
export const getAccounts = createSelector(
  (state) => state.accounts, // stable Immer reference
  (accounts) => Object.values(accounts),
);
```

Detection: Jest warning `"result function returned its own inputs"`

### 3. Unnecessary Deep Equality

`createDeepEqualSelector` adds O(n) overhead when Immer already provides stable references.

```typescript
// ❌ UNNECESSARY: state.accounts is already stable
const getAccounts = createDeepEqualSelector(
  (state) => state.metamask.accounts,
  (accounts) => transformAccounts(accounts),
);

// ✅ CORRECT
const getAccounts = createSelector(
  (state) => state.metamask.accounts,
  (accounts) => transformAccounts(accounts),
);
```

Use `createDeepEqualSelector` only when inputs are genuinely not from Immer/Redux state.

### 4. O(n) Lookups

`.find()` on Object.values is O(n). With n items × m selectors per state change = O(n×m).

```typescript
// ❌ BROKEN
export const getAccountByAddress = (state, address) =>
  Object.values(state.accounts).find((a) => a.address === address);

// ✅ FIXED: normalized state, O(1) access
export const getAccountByAddress = (state, address) => state.accounts[address];
```

### 5. Chained Transforms (Unmemoized)

Each transform creates a new array. Multiple transforms = multiple new references per call.

```typescript
// ❌ BROKEN: 3 new arrays per call
export function getSortedItems(state) {
  const items = Object.values(state.items);    // array 1
  const filtered = items.filter(isVisible);    // array 2
  return filtered.sort(byDate);               // array 3
}

// ✅ FIXED: single memoized output
export const getSortedItems = createSelector(
  (state) => state.items,
  getFilterCriteria,
  (items, criteria) =>
    Object.values(items).filter((i) => matchesCriteria(i, criteria)).sort(byDate),
);
```

## Selector Creator Decision Tree

```
Is INPUT unstable (not from Immer/Redux)?
├── YES → createDeepEqualSelector
└── NO → Is OUTPUT unstable (new array/object from transform)?
    ├── YES → createResultEqualSelector (or createShallowResultSelector)
    └── NO → createSelector
```
