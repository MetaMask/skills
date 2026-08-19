# Phase 2 — runtime investigation

Reach for this **only** when Phase 1 (static pairing) leaves an introduced primitive it
cannot pair, or when the claim is explicitly about magnitude ("retained heap grows across N
cycles", "detached nodes accumulate"). A snapshot confirms a *suspected* leak and shows its size and retainer chain — but a
non-leak is also worth demonstrating: a flat retained-heap curve across N cycles is positive
evidence, valid **only beside a positive control** (a known-leaking arm that grows), because a
measurement that cannot detect a leak cannot prove its absence. See `scripts/heap-over-cycles.example.ts`
for a two-arm driver (real code flat vs control grows) over the real module.

## Order of escalation (cheapest first)

### 1. Falsifying lifecycle test (preferred)

Deterministic, fast, and it lives in the suite as a regression guard. Force the boundary the
primitive should release at, then assert the release directly:

- listener: assert `emitter.listenerCount(ev)` returns to its pre-acquire value after the
  boundary (stream close, `destroy()`, instance replacement).
- singleton / cache: assert the reference is nulled / the entry evicted.
- pending registry: assert the map is empty after the flow (all requests settled or rejected).
- subscription: assert the unsubscribe was called (spy) and no further dispatches land.

The test **fails on the leaking code and passes on the fix** — that falsifiability is the
point. A test that passes on both proves nothing.

### 2. Heap-over-a-flow (when a unit test can't reach it)

One snapshot shows occupancy, not a leak. You need the **delta across repetition**:

1. Drive the flow once to warm caches; take a baseline snapshot.
2. Run N cycles of the suspected flow (open/close, mount/unmount, connect/disconnect).
3. Force GC, take a second snapshot.
4. Compare **retained size**, **detached DOM nodes**, and **listener count** — a leak grows
   roughly linearly in N. A flat delta refutes the leak.

Capture (Chrome, extension context):
- DevTools Memory panel → *Allocation instrumentation on timeline* or two heap snapshots
  with *Comparison* view; or
- CDP: `HeapProfiler.takeHeapSnapshot` before/after, diff the node counts. `mm cdp` drives
  the extension's contexts (page, service worker) over the protocol.

### 3. Retainer graph — must match the static argument

Select a surviving object in the post-flow snapshot and read its **retainer chain** (why it
is still reachable). That chain must name the **same holder → held → boundary** the Phase-1
read named. If the profiler says the object is retained by a path the static argument did not
predict, the static argument is incomplete — reconcile before concluding. Agreement between
the two independently-derived paths is what makes the finding trustworthy; either alone is
weaker.

## Trust gate

- **A single snapshot is not evidence of a leak** — it is occupancy. Only the delta across N
  cycles is.
- **GC must be forced** before the comparison snapshot, or you measure collection lag, not
  retention.
- **The retainer chain is the discriminator** — "retained size went up" without a chain
  naming the culprit is a symptom, not a diagnosis.
- **Warm the caches first** — the first cycle populates legitimate one-time caches that would
  otherwise read as a leak.

## Scrub before sharing

Heap snapshots and retainer graphs can contain live application state (URLs, account
identifiers, in-flight request payloads). Scrub or crop before any snapshot leaves the
machine; never attach a raw `.heapsnapshot` to a public surface.
