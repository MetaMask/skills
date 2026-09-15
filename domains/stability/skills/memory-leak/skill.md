---
name: memory-leak
description: Find and investigate memory leaks / retention issues in JavaScript/TypeScript. Two phases. (1) Static identification from a diff — enumerate the retention primitives the change introduces (event listeners, timers, pending-request registries, subscriptions, module singletons, growing collections), pair every acquire with its release site, and scope findings to what the diff adds versus what pre-exists. (2) Runtime investigation, for a primitive that cannot be paired statically or a no-leak verdict to demonstrate beside a positive control — DevTools/CDP heap snapshots over N cycles, the retainer graph, detached-node count, and a falsifying lifecycle test. Leads with the cheap static read (the retention review a reviewer already performs), which sets the order of the work, not its extent. Triggers on /mms-memory-leak, or when asked to find or investigate a memory leak, check listener/subscription/timer cleanup, review a diff for retention, or take and read a heap snapshot.
maturity: experimental
---

# /memory-leak

Find where an object outlives its purpose — and prove it, or prove it doesn't. A memory
leak is a **retention path**: something acquires a reference (a listener, a timer, a map
entry, a subscription) and never releases it at the boundary where it should
(`destroy()`, stream close, instance replacement, request completion). The object, and
everything its closure pins, survives past its lifecycle.

**The core move — pair every acquire with its release.** For each retention primitive the
code introduces, find the matching teardown in the same scope. A primitive *with* a
teardown is safe. A primitive *without* one is the finding, and the first place to point a
heap snapshot.

> **Lead with the read, not the instrument.** A heap snapshot is the *last* step, not the
> first. The decisive, cheap step is the read a reviewer already does: enumerate the
> primitives, pair each against its release. Escalate to the profiler for a primitive the
> read cannot pair. The read sets the *order* of the work, not its extent: a no-leak verdict
> the read predicts can still be demonstrated at runtime, beside a positive control.

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
3. **Outlived boundary** — the moment release *should* happen but doesn't. Confirm which event
   marks it in the dependency's installed source under `node_modules`, not from the event's
   name: one Node stream emits `end`, `finish` and `close` as three separate events.

**The pairing check is the finding.** The absence of the release, cited at the acquire
site, *is* the evidence. Cite it as `acquire L<n>` with `no release in scope`, or as
`acquire L<n> → release L<m> (on <boundary>)` when it is paired.

**Four leak shapes** (forms an unpaired primitive can take):
- **Unbounded accumulator** — a collection with a defeated or missing eviction, no drain.
- **Stale-instance listener** — on singleton replacement, the old instance's listeners
  are never removed; both instances now receive dispatches.
- **Unremoved listener + capture set** — a listener whose handler closure pins a large set,
  never removed, retained for the emitter's life.
- **Retention past `destroy()`** — teardown runs but misses one primitive.

State whether each finding is **bounded** (retained until the next replacement) or
**unbounded** (growing per request with no drain): the severity differs.

### Scope to the diff, or you invent findings

Classify every flagged primitive as **introduced by this change** (in the added lines) vs
**pre-existing** (already in the file). Charge only the introduced ones. Report pre-existing
un-paired primitives **separately and uncharged** — flagging them is useful, but attributing
a pre-existing leak to the change under review is a false positive. (On MetaMask
extension#40684 the two new stream listeners each had a `removeListener` on
`onStreamClosed` and the new pending Map had its `.delete` — no leak introduced — while
three pre-existing un-torn-down listeners were surfaced and left uncharged, matching how the
reviewers treated them.)

## Phase 2 — Investigation (runtime)

Run it when Phase 1 finds an introduced primitive it cannot pair, when the claim is about
*magnitude* ("retained heap grows across N cycles"), or when a no-leak verdict is to be
demonstrated rather than asserted. **Read [references/heap-investigation.md](references/heap-investigation.md)
before running any of it.** It carries the escalation order, the capture steps and the trust
gate. In brief:

- **Falsifying lifecycle test first** (cheaper than a snapshot, and deterministic): force the
  boundary in a test, assert release — listener count returns to zero, singleton nulled,
  collection drained. Fails on the leaking code, passes on the fix.
- **Heap-over-a-flow** when a test can't reach it: DevTools/CDP heap snapshots before and
  after N cycles of the flow; compare **retained size** and **detached-node / listener
  count**, not a single snapshot (one snapshot shows occupancy, not growth).
- **A flat result needs a positive control.** A flat retained-heap curve is evidence of no leak
  only beside an arm known to leak that grows under the same measurement. A measurement that
  cannot detect a leak cannot prove its absence.
- **The retainer graph must name the same path** the static argument named. If the profiler's
  retainer chain does not match the Phase-1 holder→held→boundary, one of them is wrong —
  reconcile before concluding.
- **The intervention test carries causation.** Change *only* the one thing the retainer graph
  named — the accessor, the missing teardown, the line — and re-measure. If the slope
  flattens, the graph found the *cause*; if it persists, it found a correlate. A before/after
  snapshot of unchanged code shows retention but never that *this* is what creates it. The fix
  itself is the strongest form of this test.

## Output

Report the verdict scoped to the change, with each primitive shown paired or not:

```
Retention review — <change>
NEW (introduced here):
  ok   <acquire L..>  → <release L..> (on <boundary>)
  OPEN <acquire L..>  → no release in scope   ← heap-snapshot candidate
  SKIP <acquire L..>  → no pass paired this form: not examined
PRE-EXISTING (surfaced, not charged):
  --   <acquire L..>  → no release (pre-existing)
Examined: <N> of <M> NEW acquires
Verdict: no retention path introduced   |   OPEN candidate warrants a snapshot (Phase 2)   |   <k> NEW acquires not examined, not clean
```

Every site cites a permalink pinned to a commit sha, so a reader can open the line. Present
it in situ where possible (the scan output, the failing lifecycle test, the retainer graph)
rather than as prose.

## Worked example — extension#40684 (extract patch-store substream)

Phase 1 on the diff found three introduced primitives, cited at the PR's head commit `e03c9e9`:
`outStream.on('data', handleIncomingMessage)`
([`metamask-controller.js#L6881`](https://github.com/MetaMask/metamask-extension/blob/e03c9e93b2bcc3b292ded81cc8953747759ce189/app/scripts/metamask-controller.js#L6881)),
`this.on('update', handleUpdate)`
([`#L6883`](https://github.com/MetaMask/metamask-extension/blob/e03c9e93b2bcc3b292ded81cc8953747759ce189/app/scripts/metamask-controller.js#L6883)),
and a `#pendingGetStatePatchesRequests` Map
([`patch-store-substream-connection.ts#L49`](https://github.com/MetaMask/metamask-extension/blob/e03c9e93b2bcc3b292ded81cc8953747759ce189/ui/store/patch-store-substream-connection.ts#L49)).
Each paired: `removeListener` at
[`#L6886`](https://github.com/MetaMask/metamask-extension/blob/e03c9e93b2bcc3b292ded81cc8953747759ce189/app/scripts/metamask-controller.js#L6886)
and [`#L6887`](https://github.com/MetaMask/metamask-extension/blob/e03c9e93b2bcc3b292ded81cc8953747759ce189/app/scripts/metamask-controller.js#L6887)
inside `onStreamClosed`, and `.delete` at
[`#L187`](https://github.com/MetaMask/metamask-extension/blob/e03c9e93b2bcc3b292ded81cc8953747759ce189/ui/store/patch-store-substream-connection.ts#L187)
against the `.set` at
[`#L107`](https://github.com/MetaMask/metamask-extension/blob/e03c9e93b2bcc3b292ded81cc8953747759ce189/ui/store/patch-store-substream-connection.ts#L107).
**Verdict: no leak introduced.** The read settled it without a snapshot.
[`scripts/heap-over-cycles.example.ts`](scripts/heap-over-cycles.example.ts) is the two-arm driver
for demonstrating the non-leak at runtime, the head code beside a control that withholds
responses. The teardown at
[`#L6886`](https://github.com/MetaMask/metamask-extension/blob/e03c9e93b2bcc3b292ded81cc8953747759ce189/app/scripts/metamask-controller.js#L6886)
was the exact fix a reviewer had suggested in-thread; the static read reproduced the review's
conclusion. Three pre-existing un-paired listeners were surfaced and left uncharged.

## Worked example — extension#44352 (Firefox detached-window leak, a real leak)

Phase 1 finds nothing to pair: the leak is not a listener, timer, or map the diff adds — it is
a *native object's* lifecycle. Snow's (pre-existing) picture-in-picture hook, on every window it
wraps, assigns its wrapper closure onto `win.documentPictureInPicture.requestWindow`, the
per-window `DocumentPictureInPicture` instance. On Firefox 153 reading that property leaks
nothing by itself (a read-only arm retained 0/12). The assignment is the leaking step: the
closure, stored as an expando on the instance's preserved wrapper, forms a cycle Firefox's cycle
collector cannot break (12/12 retained), so every closed popup's document is retained. There
is no acquire/release in the changed lines to match, so the evidence is Phase 2 run forward:

- **Magnitude, not a snapshot** — reported by the PR, not reproduced: ~70 detached window
  entries (~105 MB on a fresh test wallet) in `about:memory` per popup open/close, linear with
  use. 30 cycles leave 3.56 GB on 13.37.0, and the detached documents survive a forced GC.
  One snapshot shows occupancy; the slope across cycles is the leak.
- **Retainer graph** — names the holder (the per-window `documentPictureInPicture` instance)
  and the boundary (window close, where the collector should reclaim it but can't).
- **Intervention test** — the fix installs the hook on the constructor prototype,
  `win.DocumentPictureInPicture.prototype.requestWindow`, instead of assigning it onto the
  per-window instance. Moving *only* the closure assignment, from instance to prototype, is the
  intervention that separates cause from correlate. A three-line patch to `@lavamoat/snow`,
  fixing extension#42891 (Memory leak in Firefox). The PR reports its intervention (only this
  hook changed, 30 cycles) taking retained documents from +2,100 (3.35 GB) to -13 (1.6 MB),
  reported, not reproduced. A separate two-arm reproduction's prototype arm read 0, 0 and 2
  across three runs on the working machine, and 6/8 in each of six replicates on a fresh
  isolated host, with valid controls in all six. The records disagree, so the causal claim
  stays open until the fix arm replicates across hosts.

**The lesson for the hunt:** a native-lifecycle leak, a closure stored on a native object in a
cycle the engine can't collect, is invisible to Phase 1 pairing, because there is no
acquire/release in the diff. When the claim is about *magnitude* and no diff primitive explains
it, go straight to Phase 2, and let the intervention test carry the causal claim once it
replicates. Reproduce the operation under test, the assignment, and not a proxy for it such as
the read: an arm that only reads would have cleared the hook. extension#44352 (the Firefox
detached-window leak) is the Phase-2 counterpart to extension#40684 (the patch-store substream
extraction): the read settles the absence of a leak there, and runtime measurement has to carry
the presence of one here.
