# Instrumentation — render and stylesheet counters

How to get real numbers out of the swaps screen. Counters are added to source,
delivered by Fast Refresh, read back through Hermes CDP, and removed before any
report is written.

Prerequisite: the preflight passed. Its last gate reads an account count over
`mm cdp`, so a pass already proves the readout path below works. On Node 20,
export `NODE_OPTIONS=--experimental-websocket`.

## The counter object

One global, one shape, so every readout is comparable:

```ts
// Temporary. Deleted before the audit is reported.
const bump = (key: string) => {
  const g = globalThis as unknown as { __mmPerf?: Record<string, number> };
  g.__mmPerf = g.__mmPerf ?? {};
  g.__mmPerf[key] = (g.__mmPerf[key] ?? 0) + 1;
};
```

In practice inline the two-line version at the top of each instrumented module
rather than importing a shared helper — a new import is a module-graph change
that Fast Refresh handles less predictably than an edit inside a module.

## Recipe A — render counts

Put the bump in the component body, before any early return:

```tsx
const TokenInputAreaComponent = ({ amount, token, ... }: TokenInputAreaProps) => {
  bump('TokenInputArea.render');
  // ...
};
```

For a component wrapped in `memo`, count inside the inner function. Counting
outside `memo` measures the parent's render, not this component's.

## Recipe B — stylesheet creation counts

This is the measurement that catches broken `useStyles` memoization.
`app/component-library/hooks/useStyles.ts` memoizes on
`[styleSheet, theme, vars]` **by reference**:

```ts
const styles = useMemo(
  () => styleSheet({ theme, vars: vars as V }),
  [styleSheet, theme, vars],
);
```

So a new `vars` object literal per render, or a new `styleSheet` function
identity per render, re-runs `StyleSheet.create()` on every render.

> **The wrapper must have a stable identity.** This is the single easiest way
> to produce a false result. If you wrap `createStyles` inside the component
> body, the wrapper is a *new function every render*, which becomes a changing
> `styleSheet` dependency and breaks the very memoization you are measuring.
> The counter then reports style creations that your instrumentation caused.
> This exact mistake produced a false negative during the session this skill
> was extracted from: fixes that had already landed looked like they had not
> worked.

Correct — wrapper at module scope:

```tsx
const createStylesInstrumented: typeof createStyles = (params) => {
  bump('TokenInputArea.styleCreate');
  return createStyles(params);
};

// inside the component
const { styles } = useStyles(createStylesInstrumented, styleVars);
```

Also correct when the wrapper genuinely must live in the component (it closes
over something local) — memoize it on stable deps only:

```tsx
const createStylesInstrumented = useCallback(
  (params: Parameters<typeof createStyles>[0]) => {
    bump(`${__mmKey}.styleCreate`);
    return createStyles(params);
  },
  [__mmKey],           // __mmKey must itself be stable (a prop or a constant)
);
```

Wrong, and the trap:

```tsx
// ❌ new function identity every render → useStyles memo always misses
const createStylesInstrumented = (params) => {
  bump('TokenInputArea.styleCreate');
  return createStyles(params);
};
```

Sanity check before trusting any style numbers: instrument one component you
have already proven correct (a static module-scope `StyleSheet.create`, e.g.
`QuoteCountdownTimer` after its fix). Its `styleCreate` count must stay at its
mount value while the screen sits idle. If it climbs, your wrapper is unstable
and every other number in the run is suspect.

## Recipe C — subscription balance (leak detection)

Renders and stylesheets say nothing about retention. To catch a leaked
interval, listener, or controller subscription, count setup against teardown
and assert the pair nets to zero.

```ts
// Temporary. Deleted before the audit is reported.
const balance = (key: string, delta: number) => {
  const g = globalThis as unknown as { __mmPerf?: Record<string, number> };
  g.__mmPerf = g.__mmPerf ?? {};
  g.__mmPerf[`${key}.balance`] = (g.__mmPerf[`${key}.balance`] ?? 0) + delta;
};
```

Put the increment where the resource is acquired and the decrement in the
cleanup that releases it — inside the same effect, never in a sibling:

```tsx
useEffect(() => {
  const id = setInterval(tick, 1000);
  balance('QuoteCountdownTimer.interval', 1);
  return () => {
    clearInterval(id);
    balance('QuoteCountdownTimer.interval', -1);
  };
}, []);
```

Read it like any other counter. The only correct resting value, once the screen
has been unmounted, is `0`:

- **positive** — teardown never ran, or released a different handle than the
  one it created. That is the leak.
- **negative** — teardown ran more often than setup. Usually an effect whose
  dependency array causes re-subscription without a matching acquire, and a bug
  in its own right.

Do not reset counters between the cycles of `COMMON-S6`. The balance is
cumulative by design; resetting mid-run destroys the only signal it carries.

Instrument the pairs that actually hold resources: `setInterval` and
`setTimeout`, `AppState` and other event listeners, and any `.subscribe()` on a
controller or messenger. `COMMON-M002` in `checks/common.md` has the sweep that
finds them.

**Scope.** This measures JS-side retention, which is where this codebase's
leaks live, and it needs no heap tooling. It does not measure heap growth — a
retained object graph with balanced subscriptions will pass. A heap-level check
would need a different primitive: `mm cdp` forwards arbitrary methods to the
Hermes inspector with no allowlist, so `HeapProfiler.*` may work, but verify
what Hermes actually answers on a running app before writing a check that
depends on it.

## Recipe D — identity change counter

Render counters tell you a component re-rendered. They do not tell you *why*.
When the suspect is a value handed down through context or a hook return —
where one unstable reference re-renders an entire memoized subtree — count how
often the reference changes rather than how often anything rendered.

```ts
// Temporary. Deleted before the audit is reported.
const identity = (key: string, value: unknown) => {
  const g = globalThis as unknown as {
    __mmPerf?: Record<string, number>;
    __mmRefs?: Record<string, unknown>;
  };
  g.__mmPerf = g.__mmPerf ?? {};
  g.__mmRefs = g.__mmRefs ?? {};
  if (g.__mmRefs[key] !== value) {
    g.__mmRefs[key] = value;
    g.__mmPerf[`${key}.identity`] = (g.__mmPerf[`${key}.identity`] ?? 0) + 1;
  }
};
```

Call it where the value is produced, not where it is consumed:

```tsx
const value = useBridgeQuoteData({ latestSourceAtomicBalance });
identity('BridgeQuoteData.value', value);
```

Read `<key>.identity` against the number of times the underlying data actually
changed. A context value that changes identity once per quote refresh is
correct; one that changes on every provider render is a memo whose dependency
list contains something unstable, and every consumer below it re-renders for
nothing.

Two cautions. The counter holds a strong reference to the last value in
`__mmRefs`, so it retains one object per key — harmless for a short audit,
but do not leave it in place while running `COMMON-S6` and reading a heap.
And a reset of `__mmPerf` does not clear `__mmRefs`; clear both together:

```bash
yarn mm cdp Runtime.evaluate '{"expression":"globalThis.__mmPerf = {}; globalThis.__mmRefs = {}; \"reset\""}'
```

## Reading and resetting counters

```bash
# read
yarn mm cdp Runtime.evaluate '{"expression":"JSON.stringify(globalThis.__mmPerf)"}'

# reset between scenarios
yarn mm cdp Runtime.evaluate '{"expression":"globalThis.__mmPerf = {}; \"reset\""}'

# confirm Fast Refresh delivered the edit (counter exists at all)
yarn mm cdp Runtime.evaluate '{"expression":"Object.keys(globalThis.__mmPerf ?? {}).join(\",\")"}'
```

If a key never appears, Fast Refresh did not apply the edit. Save the file
again, watch the terminal the user's `yarn watch` is running in, and re-read.
Do not proceed on a missing key — a zero you cannot distinguish from "never
instrumented" is not evidence.

## What to instrument

Each surface in the area files under `checks/` names its own components under
**Instrument**. Start there. For the default `swaps-screen` area that means:

| Component | Keys |
|---|---|
| `BridgeView` / `BridgeViewContent` | `render` |
| `TokenInputArea` (source and dest) | `render`, `styleCreate` |
| `FlipQuoteButton` | `render`, `styleCreate` |
| `QuoteCountdownTimer` | `render`, `styleCreate`, `balance` |

Recipe D counts against the same budget. An identity counter is cheaper than a
render counter — it runs once where the value is produced rather than once per
component — but it is still a render-time side effect, and it is most useful
paired with the render counters it explains.

Instrument no more than five components per run. Every counter is itself a
render-time side effect, and a wide sweep both slows the app and increases the
chance one wrapper is unstable. This ceiling is why an audit is scoped to one
area — the whole Bridge tree does not fit under it.

List rows are the exception worth thinking about. A row counter in the token
selector or a batch sell list fires once per visible row, so it dominates the
output and slows scrolling. Instrument the row *and nothing else* when a list
surface is the subject.

## Revert checklist

Run all of these before writing the report:

```bash
git diff | grep -n "__mmPerf"        # must print nothing
git diff | grep -n "Instrumented"    # must print nothing
git diff --stat                      # only intended fixes remain
yarn lint:changed:fix
yarn jest <touched test files>
```

Then reload the app once and confirm
`globalThis.__mmPerf` is `undefined`, proving the reverted source is what is
actually running.
