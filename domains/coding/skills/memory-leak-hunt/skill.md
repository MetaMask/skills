---
name: memory-leak-hunt
description: Find and investigate memory leaks / retention issues in JavaScript/TypeScript. Two phases. (1) Static identification from a diff — enumerate the retention primitives the change introduces (event listeners, timers, pending-request registries, subscriptions, module singletons, growing collections), pair every acquire with its release site, and scope findings to what the diff adds versus what pre-exists. (2) Runtime investigation, only for a primitive that cannot be paired statically — DevTools/CDP heap snapshots over N cycles, the retainer graph, detached-node count, and a falsifying lifecycle test. Leads with the cheap static read (the retention review a reviewer already performs) and escalates to a heap snapshot only where the read is inconclusive. Triggers on /memory-leak-hunt, or when asked to find or investigate a memory leak, check listener/subscription/timer cleanup, review a diff for retention, or take and read a heap snapshot. Callable by pr-validate as the engine behind its memory-leak evidence category.
---

# /memory-leak-hunt

Find where an object outlives its purpose — and prove it, or prove it doesn't. A memory
leak is a **retention path**: something acquires a reference (a listener, a timer, a map
entry, a subscription) and never releases it at the boundary where it should
(`destroy()`, stream close, instance replacement, request completion). The object, and
everything its closure pins, survives past its lifecycle.

**The core move — pair every acquire with its release.** For each retention primitive the
code introduces, find the matching teardown in the same scope. A primitive *with* a
teardown is safe. A primitive *without* one is the finding — and the only place a heap
snapshot could earn its cost.

> **Lead with the read, not the instrument.** A heap snapshot is the *last* step, not the
> first. The decisive, cheap step is the read a reviewer already does: enumerate the
> primitives, pair each against its release. Escalate to the profiler only for a primitive
> the read cannot pair. Most leak claims are settled without ever taking a snapshot.

## Phase 1 — Identification (static, from the diff) — the lead

Enumerate the **retention primitives** the change introduces, and for each, name the
**holder → held set → outlived boundary** triple, then pair the acquire with its release.

**The primitives to hunt** (each is an acquire that needs a matching release):

| Primitive | Acquire | Release to pair it with |
|---|---|---|
| Event listener | `.on(ev, h)` · `addListener` · `addEventListener` | `removeListener(ev, h)` · `off` · `removeEventListener` — **same handler reference** |
| Timer | `setInterval` · recurring `setTimeout` | `clearInterval` · `clearTimeout` |
| Pending registry | `map.set(id, {resolve})` | `map.delete(id)` on **every** completion/close/error path |
| Subscription | `.subscribe()` · `messenger.subscribe` · store `subscribe` | the returned unsubscribe, called at teardown |
| Module singleton / cache | assignment to module/`this` scope | reset to `null` / eviction on replacement |
| Growing collection | `push` / `set` / `add` | a `drain` / `delete` / bounded eviction policy |

**The three things to state per suspect:**
1. **Holder** — the primitive above.
2. **Held set** — the *specific* objects pinned. For a listener, list the closure's
   captures (`outStream`, `api`, `messengerSubscription`…). Note when a closure links two
   otherwise-independent objects' GC.
3. **Outlived boundary** — the moment release *should* happen but doesn't.

**The pairing check is the finding.** The absence of the release, cited at the acquire
site, *is* the evidence. Cite it as `acquire L<n>` with `no release in scope`, or as
`acquire L<n> → release L<m> (on <boundary>)` when it is paired.

**Four canonical leak shapes** (what an unpaired primitive usually is):
- **Unbounded accumulator** — a collection with a defeated or missing eviction, no drain.
- **Stale-instance listener** — on singleton replacement, the old instance's listeners
  are never removed; both instances now receive dispatches.
- **Unremoved listener + capture set** — a listener whose handler closure pins a large set,
  never removed, retained for the emitter's life.
- **Retention past `destroy()`** — teardown runs but misses one primitive.

### Scope to the diff, or you invent findings

Classify every flagged primitive as **introduced by this change** (in the added lines) vs
**pre-existing** (already in the file). Charge only the introduced ones. Report pre-existing
un-paired primitives **separately and uncharged** — flagging them is useful, but attributing
a pre-existing leak to the change under review is a false positive. (On MetaMask
extension#40684 the two new stream listeners each had a `removeListener` on
`onStreamClosed` and the new pending Map had its `.delete` — no leak introduced — while
three pre-existing un-torn-down listeners were surfaced and left uncharged, matching how the
reviewers treated them.)

## Phase 2 — Investigation (runtime) — only for an unpaired primitive

A snapshot is warranted **only** when Phase 1 finds an introduced primitive it cannot pair,
or when the claim is specifically about *magnitude* ("retained heap grows across N cycles").
Full runtime procedure: **[references/heap-investigation.md](references/heap-investigation.md).**
In brief:

- **Falsifying lifecycle test first** (cheaper than a snapshot, and deterministic): force the
  boundary in a test, assert release — listener count returns to zero, singleton nulled,
  collection drained. Fails on the leaking code, passes on the fix.
- **Heap-over-a-flow** when a test can't reach it: DevTools/CDP heap snapshots before and
  after N cycles of the flow; compare **retained size** and **detached-node / listener
  count**, not a single snapshot (one snapshot shows occupancy, not growth).
- **The retainer graph must name the same path** the static argument named. If the profiler's
  retainer chain does not match the Phase-1 holder→held→boundary, one of them is wrong —
  reconcile before concluding.

## Output

Report the verdict scoped to the change, with each primitive shown paired or not:

```
Retention review — <change>
NEW (introduced here):
  ok   <acquire L..>  → <release L..> (on <boundary>)
  OPEN <acquire L..>  → no release in scope   ← heap-snapshot candidate
PRE-EXISTING (surfaced, not charged):
  --   <acquire L..>  → no release (pre-existing)
Verdict: no retention path introduced   |   OPEN candidate warrants a snapshot (Phase 2)
```

Every figure resolves to a line number a reader can open. Present it in situ where possible
(the scan output, the failing lifecycle test, the retainer graph) rather than as prose.

## Worked example — extension#40684 (extract patch-store substream)

Phase 1 on the diff found three introduced primitives:
`outStream.on('data', handleIncomingMessage)` (L6881), `this.on('update', handleUpdate)`
(L6883), and a `#pendingGetStatePatchesRequests` Map (L49). Each paired: `removeListener`
at L6886/L6887 inside `onStreamClosed`, and `.delete` at L187 against the `.set` at L107.
**Verdict: no leak introduced — no snapshot taken.** The teardown at L6886 was the exact fix
a reviewer had suggested in-thread; the static read reproduced the review's conclusion. Three
pre-existing un-paired listeners were surfaced and left uncharged.

## Called by pr-validate

pr-validate keeps **memory leak** as an evidence category and delegates the analysis here:
it invokes this skill on the PR's diff, takes the verdict + the paired/unpaired sites, and
packages them as the category's evidence (an in-situ capture of the scan, plus the lifecycle
test or retainer graph if Phase 2 ran). This skill is the engine; pr-validate is the
orchestrator that publishes the result. Usable standalone for any leak hunt, in review or in
an incident, PR or not.
