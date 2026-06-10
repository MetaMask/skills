---
title: Selector Dependency Cascades — Blast Radius & Repair (MetaMask)
impact: CRITICAL
tags: reselect, cascade, dependency-graph, isEqual, structural-sharing, react-compiler
---

# Skill: Selector Dependency Cascades

[mm-selector-memoization.md](mm-selector-memoization.md) catalogues the broken-selector *patterns*. This file is about what happens **downstream of one broken root selector** — and how to repair the whole graph instead of patching its leaves. Reference case: extension PR metamask-extension#37147, where a single identity output selector (`getInternalAccounts`) was recomputing through **15 direct + 35+ transitive consumer selectors into 50+ components on every dispatch** — every 5-second balance poll, every keystroke in the send flow.

## Anatomy of a cascade

```ts
// ❌ the root: identity output selector — memoizes nothing, new "result" every dispatch
export const getInternalAccounts = createSelector(
  (state) => state.engine.internalAccounts.accounts,
  (accounts) => accounts, // output === input: the cache can never hit meaningfully
);
```

Every consumer selector that takes the root as an input now sees a "changed" input on every dispatch, recomputes, and — because most result functions allocate (`.filter()`, `.map()`, `Object.values()`) — emits its *own* fresh reference, propagating the invalidation one layer further. Three layers down, nobody remembers the root; they see "my selector keeps firing" and reach for local fixes:

```ts
// ❌ the band-aids that accumulate downstream of a broken root
const accounts = useSelector(getAccountsByScope, isEqual);        // deep compare per dispatch
export const getX = createDeepEqualSelector(getInternalAccounts, …); // deep compare per dispatch
export const getMemoizedAccounts = createSelector(getInternalAccounts, (a) => a); // does nothing
```

Each band-aid suppresses the re-render for one consumer while *adding* an O(n) deep comparison on every dispatch — and the cascade cost scales superlinearly with power-user data (see [mm-power-user-scenario.md](mm-power-user-scenario.md)).

## Step 1 — Traverse the dependency tree exhaustively before fixing

The repair PR's evidence (and its review) should enumerate the graph **to closure** — every selector reachable from the suspect, not just its immediate neighborhood — the way #37147 did:

1. **Direct consumers:** every selector that lists the suspect as an input. `grep -rn "getInternalAccounts" app/selectors --include="*.ts"`
2. **Transitive consumers:** repeat for each direct consumer until the frontier adds no new selectors. Don't stop at a fixed depth — cascades often have **more than one broken root**, and a partial map produces a wrong fix order.
3. **Component consumers:** `useSelector` call sites of anything in the graph.
4. **Recomputation count:** instrument with `selector.recomputations()` (reselect) or a `console.count` in the result function across a few dispatches (a balance poll is a convenient metronome).

A before/after table — *recomputations per dispatch, re-renders per poll cycle, on the same interaction* — is what distinguishes a verified cascade fix from a speculative refactor.

## Step 2 — Plan the memoization fix order from the map: roots first

Write down the fix order before writing any fix. The order is **topological** — roots, then their descendants, layer by layer:

- A descendant fix can't be *verified* while any of its inputs is still unstable: its output identity keeps changing for upstream reasons, so the before/after numbers measure the wrong thing.
- Most descendant "problems" stop being fixes once the roots are stable — they reclassify from "add memoization here" to "remove the band-aid here" (Step 4). The plan is what tells you which is which *in advance*, instead of memoizing selectors that were only recomputing because of their inputs.
- If the map surfaced multiple roots sharing consumers, fix them together — otherwise the shared consumers keep re-rendering and the first root's win never shows up in the numbers.

## Step 3 — Fix the root, not the 50 consumers

Memoizing consumers one by one is whack-a-mole: each fix adds comparison cost and the graph keeps re-deriving from a poisoned root. Trace **upward** (who are my inputs? are *they* stable?) until you hit the selector whose output identity changes without its data changing — that's the root. Fix its memoization there (patterns + recipes in [mm-selector-memoization.md](mm-selector-memoization.md)).

**Know your reference-stability contract first.** What the correct fix looks like depends on whether your store gives you stable references for unchanged data:

- With **Immer-based reducers** (Redux Toolkit), structural sharing guarantees `state.a.b` keeps its reference **iff** nothing under that path changed. Under that contract, a plain `createSelector` over a *narrow* input is already correct, and deep-equal selectors are pure overhead.
- Where state is replaced wholesale on sync (documented for this repo's controller-state slices in [mm-selector-memoization.md](mm-selector-memoization.md)), input references break even when data didn't change, and `createDeepEqualSelector` at the *root* is the pragmatic tool.

Establish which contract a slice actually follows (log `prev === next` for the input across two unrelated dispatches) before choosing — the answer differs per slice, and assuming the wrong contract either reintroduces the cascade or buys deep-compares you don't need.

## Step 4 — Sweep the graph and *remove* the band-aids

This is the step most fixes skip. After the root is stable, every downstream `isEqual`, `createDeepEqualSelector`-wrapping-a-now-stable-input, and `getMemoized*` duplicate is dead weight: it still runs its deep comparison on every dispatch, and it **masks regressions** — if the root breaks again, the band-aids hide it until the app is slow everywhere again.

```bash
# downstream band-aid sweep, scoped to the fixed graph
grep -rn "useSelector(.*isEqual)" app --include="*.tsx" | grep -v ".test."
grep -rn "createDeepEqualSelector" app/selectors --include="*.ts"
grep -rn "getMemoized\|selectMemoized" app/selectors --include="*.ts"
```

For each hit that consumes the fixed root (directly or transitively): remove the equality argument / downgrade to plain `createSelector`, and re-verify the consumer doesn't re-render on unrelated dispatches. #37147 deleted the band-aids in the same PR as the root fix — that's the model.

## What the React Compiler can and cannot do here

The compiler memoizes **within a file**. A `useSelector` result, an imported hook's return value, or an external context value is opaque to it — if the selector hands back a fresh reference, the compiled component still re-renders, and any derivation from it still recomputes (extension audit ticket MetaMask-planning#6661):

```tsx
const tokens = useSelector(selectTokens);     // compiler cannot see/stabilize this
const rows = tokens.map(toRow);               // ❌ recomputes every render even when compiled
const rows = useMemo(() => tokens.map(toRow), [tokens]); // ✅ still needed
```

Rule of thumb: values that **cross a file boundary** (Redux selectors, imported hooks/functions, external context) keep their manual `useMemo`/`useCallback`; same-file props/state derivations can lean on the compiler. Fix the selector graph first — automatic memoization downstream of an unstable root optimizes nothing.

## Don't over-correct

- Not every busy selector is a cascade root — a selector returning a **primitive** breaks the chain at that point regardless of recomputation (allocation waste ≠ re-render bug).
- A *global* top-level cascade (an unstable value in a root provider/HOC re-rendering the whole tree on every state change) is a pattern the extension audit found at app root — worth **ruling out** with one profiler pass ("why did this render?" on a top-level component during an unrelated dispatch), but don't assume it exists here; verify before restructuring providers. See [mm-context-performance.md](mm-context-performance.md) for the provider-value mechanics.
- Don't add `useMemo` around every `useSelector` read preemptively — only where a non-primitive result feeds a derivation or a memoized child (see guardrails in [mm-hook-dependency-arrays.md](mm-hook-dependency-arrays.md)).

## Verify

1. Root selector returns the **same reference** across two unrelated dispatches (the contract test from [mm-selector-memoization.md](mm-selector-memoization.md)).
2. Recomputation counts on direct + transitive consumers drop to ~0 on unrelated dispatches.
3. Profiler on a top consumer (account list, send flow): the re-render cascade is gone during a balance poll.
4. The band-aid greps above return no hits inside the repaired graph.
5. Lock the win in CI: add a Reassure `*.perf-test.tsx` on a top consumer so the cascade can't silently return.

## Related

- [mm-selector-memoization.md](mm-selector-memoization.md) — the root-selector patterns and fix recipes
- [mm-redux-antipatterns.md](mm-redux-antipatterns.md) — `useSelector(x, isEqual)` as symptom; per-consumer view
- [mm-unstable-hook-return.md](mm-unstable-hook-return.md) — the same cascade shape, with a hook as the root
- [mm-state-normalization.md](mm-state-normalization.md) — state shape that prevents cascade-prone selectors
- [mm-react-compiler-error-triage.md](mm-react-compiler-error-triage.md) — confirming what the compiler actually covers
