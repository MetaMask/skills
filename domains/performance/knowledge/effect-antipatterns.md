---
name: effect-antipatterns
domain: performance
description: The React `useEffect` patterns that cause unnecessary renders, memory leaks, or race conditions — the canonical, platform-agnostic taxonomy that per-repo effect references instantiate
---

# Effect Anti-Patterns

**This file is the single source for the pattern taxonomy.** Per-repo references — such as
the `mm-hook-dependency-arrays` and `mm-useeffect-antipatterns` references shipped with the
`performance` skill — name these patterns rather than redefining them, and add what only
they can: verified instances with `file:line`, repo-specific lint gaps, and fix recipes.

Two halves, and they fail differently. Patterns 1–2 are about **when an effect re-runs**
(the dependency side). Patterns 3–5 are about **what happens inside and after it** (the
lifecycle side).

## 1. Unstable dependency identity

A dependency array is supposed to be a cheap identity check. Anything that produces a new
value every render defeats it — and usually signals an unstable reference upstream.

```typescript
// ❌ serializes on EVERY render just to build the dep key
useEffect(() => { doSomething(config) }, [JSON.stringify(config)])

// ❌ new object every render → effect runs every render (or loops forever)
useEffect(() => { ... }, [{ id: user.id }])

// ✅ stabilize the reference upstream, then depend on it directly
const stableConfig = useMemo(() => derive(a, b), [a, b])
useEffect(() => { doSomething(stableConfig) }, [stableConfig])

// ✅ or depend on the primitives
useEffect(() => { ... }, [user.id])
```

Stabilizing the source beats hashing it. If you genuinely cannot, a primitive key computed
**once** (`useMemo(() => xs.join(','), [xs])`) still beats a per-render `JSON.stringify`.

Detection: grep for `JSON.stringify` inside a dependency array, and for inline `{`/`[`
literals in the dep position.

## 2. Wrong dependencies

```typescript
// ❌ empty deps but reads state → stale closure, value frozen at first render
const onPress = useCallback(() => doThing(count), [])

// ❌ empty deps and reads nothing → this was never a hook, hoist it out
const config = useMemo(() => ({ a: 1, b: 2 }), [])
```

**Fix:** include what you read; or if there is genuinely nothing to read, move the constant
outside the component. Where `react-hooks/exhaustive-deps` is not enabled, this is not
caught automatically and must be reviewed by hand.

## 3. Derived state via effect + setState

If a value is computable from props/state/store, compute it during render. State plus an
effect is for *synchronizing with something external*, not for derivation.

```typescript
// ❌ two render passes per change: render → effect → setState → render again
const [visible, setVisible] = useState([])
useEffect(() => { setVisible(items.filter((t) => !t.hidden)) }, [items])

// ✅ derive during render — one pass, no state to drift out of sync
const visible = useMemo(() => items.filter((t) => !t.hidden), [items])
```

The React docs call this out directly:
[You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect).

### 3a. Cascading effect chains

The same mistake compounded: effect A sets state, which triggers effect B, which sets
state, which triggers effect C. Each link is a full extra render pass *and* a window where
the UI shows an inconsistent intermediate combination.

**Fix:** collapse the chain into render-time derivation — one `useMemo` per step, or one
for the lot.

## 4. Missing timer cleanup

Every `setInterval` and recurring `setTimeout` started in an effect must be cleared in its
cleanup. Otherwise the timer outlives unmount, fires against dead state, and leaks in
proportion to how often the component mounts.

```typescript
// ❌ BROKEN: timer leaks after unmount
useEffect(() => { setInterval(poll, 1000) }, [])

// ✅ FIXED
useEffect(() => {
  const id = setInterval(poll, 1000)
  return () => clearInterval(id)
}, [])
```

## 5. Uncancelled async work

Async work started in an effect can resolve *after* unmount — or after the input changed,
letting a stale response overwrite a newer one.

```typescript
// ❌ fetch races unmount; stale data can win
useEffect(() => { fetchMeta(address).then(setMeta) }, [address])

// ✅ cancelled flag — cheapest, works for any promise
useEffect(() => {
  let cancelled = false
  fetchMeta(address).then((m) => { if (!cancelled) setMeta(m) })
  return () => { cancelled = true }
}, [address])

// ✅ AbortController — also cancels the request itself
useEffect(() => {
  const ctrl = new AbortController()
  fetch(url, { signal: ctrl.signal })
    .then((r) => setData(r))
    .catch((e) => { if (e.name !== 'AbortError') throw e })
  return () => ctrl.abort()
}, [url])
```

Pick one and apply it consistently.

## Why these matter

- **Renders.** Derived-state effects double every render in the affected subtree, and
  chains multiply it.
- **Memory.** Uncleared timers and subscriptions leak proportional to mount count.
- **Correctness.** Uncancelled async work produces "state update on an unmounted
  component" warnings and, worse, races where an older response overwrites a newer one.

## Don't over-correct

- Don't add `useMemo`/`useCallback` everywhere — only where profiling shows wasted work, or
  where a memoized child depends on the reference. Compilers handle many cases on opted-in
  paths.
- A `JSON.stringify` on a cold path with a small object is acceptable. Prioritize hot render
  paths.

## Related

- `render-cascade` — how effect-driven re-renders propagate through the component graph.
- `selector-antipatterns` — the store-side counterpart; an unstable selector result is a
  common source of the unstable dependency in pattern 1.
