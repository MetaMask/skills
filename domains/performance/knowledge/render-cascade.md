---
name: render-cascade
domain: performance
description: React+Redux render cascade failure mode — single state change triggers multiple re-render cycles
---

# Render Cascade

Single state change → broken selector returns new reference → `useSelector` detects "change" → parent re-renders all children → children trigger more selectors → cycle repeats 5+ times before stabilizing.

## Cost Scaling

| Factor | Impact |
|--------|--------|
| Component tree depth | Each level multiplies re-renders |
| User data size | O(n) selectors × n items = O(n²) operations |
| State update frequency | Background polling compounds the problem |

Power users (large datasets, many accounts/tokens/transactions) are disproportionately affected.

## Root Causes

| Cause | Pattern | Fix |
|-------|---------|-----|
| Plain function selector | `export function get...` | Wrap in `createSelector` |
| Identity function selector | Transform in input, identity in result | Move transform to result function |
| Unnecessary deep equality | `createDeepEqualSelector` on stable Immer inputs | Use `createSelector` |
| O(n) lookup | `.find()` in selector | Normalize state to map; use direct access |
| Chained transforms (unmemoized) | Multiple `.map`/`.filter` in plain function | Single `createSelector` with all transforms |
| Context provider instability | `<Context.Provider value={{ a, b }}>` inline | `useMemo` the value |
| Props recreation | `useParams()` passed directly as prop | `useMemo` the props object |

## Selector Creator Decision Tree

```
Is INPUT unstable (not from Immer/Redux)?
├── YES → createDeepEqualSelector
└── NO → Is OUTPUT unstable (new array/object from transform)?
    ├── YES → createResultEqualSelector (or createShallowResultSelector)
    └── NO → createSelector
```

## Fix Order — Root Selectors First

Selectors form a dependency graph. When a root selector returns an unstable reference, the cost cascades:

- recomputations: **O(m)** — all m dependent selectors recompute
- cascade depth: **O(log m)** — propagates through the tree
- re-renders: **O(m × k)** — each selector triggers k subscribers

**Fixing downstream selectors is ineffective until the upstream root is stable** — a fixed `getActiveAccount` still receives a new input every render if `getAccounts` is broken.

```
getAccountsObject (stable)
  └─ getAccounts (broken: returns new array)
       ├─ getActiveAccount   ├─ getAccountCount   └─ getAccountNames …
```

Triage the dependency graph top-down; fix roots first.

## Why Cascade Breaks All Other Optimizations

| Optimization | Without Cascade Fix | With Cascade Fix |
|---|---|---|
| Virtualization | Parent still re-renders all | Works as intended |
| `React.memo` | Parent defeats it | Works as intended |
| React Compiler | Can't cross file boundaries | Complements selectors |
| `useMemo`/`useCallback` | Recreated on parent render | Stable references |
