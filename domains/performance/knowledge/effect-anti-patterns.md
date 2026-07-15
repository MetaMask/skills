---
name: effect-anti-patterns
domain: performance
description: Four React `useEffect` patterns that cause unnecessary renders, memory leaks, or race conditions
---

# Effect Anti-Patterns

Four `useEffect` patterns that are systemically broken in React codebases. Each pattern has a broken example, a fixed example, and a detection recipe.

## 1. `JSON.stringify` in Dependency Array

`JSON.stringify` produces a new string on every render when the input is an object. React compares dependency arrays by reference for primitives and by identity for objects. A stringified object is a new primitive every render, so the effect fires every render.

```typescript
// ❌ BROKEN: effect runs on every render
useEffect(() => {
  doSomething(config)
}, [JSON.stringify(config)])

// ✅ FIXED: destructure and depend on primitives
const { a, b } = config
useEffect(() => {
  doSomething({ a, b })
}, [a, b])

// ✅ ALSO FIXED: stabilize via useMemo
const stableConfig = useMemo(() => config, [config.a, config.b])
useEffect(() => {
  doSomething(stableConfig)
}, [stableConfig])
```

Detection: `grep -rnE 'useEffect.*\[.*JSON\.stringify' <source-dir>`

## 2. `useEffect` + `setState` (State Mirror Pattern)

Using an effect to mirror one piece of state into another is almost always wrong. The computed value should be derived inline or via `useMemo`. Mirror-effects trigger an extra render and create synchronization bugs.

```typescript
// ❌ BROKEN: two renders, possible stale state
const [fullName, setFullName] = useState('')
useEffect(() => {
  setFullName(`${first} ${last}`)
}, [first, last])

// ✅ FIXED: derived inline, one render
const fullName = `${first} ${last}`

// ✅ ALSO FIXED: memoized if expensive
const fullName = useMemo(() => expensiveJoin(first, last), [first, last])
```

The React docs explicitly call this out: [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect).

Detection: `grep -rnB1 -A3 'useEffect' <source-dir> | grep -B2 -A1 'set[A-Z]'` (review hits manually)

## 3. Missing Interval/Timer Cleanup

Every `setInterval` and `setTimeout` inside an effect must be cleared in the cleanup function. Otherwise the timer survives component unmount and fires on dead state, leaking memory and causing "setState on unmounted component" warnings.

```typescript
// ❌ BROKEN: timer leaks after unmount
useEffect(() => {
  setInterval(poll, 1000)
}, [])

// ✅ FIXED
useEffect(() => {
  const id = setInterval(poll, 1000)
  return () => clearInterval(id)
}, [])
```

Detection: `grep -rnB2 -A10 'setInterval\|setTimeout' <source-dir> | grep -B5 'useEffect' | grep -v 'clearInterval\|clearTimeout'`

## 4. Missing `AbortController` in Async Effects

Async work inside an effect should be cancellable. Without `AbortController`, a request initiated before unmount can resolve after unmount, triggering `setState` on a dead component and masking memory issues.

```typescript
// ❌ BROKEN: fetch races unmount
useEffect(() => {
  fetch(url).then((r) => setData(r))
}, [url])

// ✅ FIXED
useEffect(() => {
  const ctrl = new AbortController()
  fetch(url, { signal: ctrl.signal })
    .then((r) => setData(r))
    .catch((e) => { if (e.name !== 'AbortError') throw e })
  return () => ctrl.abort()
}, [url])
```

## Why These Matter

- **Renders.** State-mirror effects double every render in the affected component tree.
- **Memory.** Uncleared intervals and timers leak proportional to how often the component mounts.
- **Correctness.** Async effects without cancellation cause `"Can't perform a React state update on an unmounted component"` warnings and, worse, data races where an older response overwrites a newer one.
