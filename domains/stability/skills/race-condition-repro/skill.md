---
name: race-condition-repro
description: Prove an ordering guarantee under concurrency — that when B arrives during A's pending window, A is canceled, or completes first, or the two commit in a defined order. Covers race conditions, retries, cancellation, supersession, debounce/throttle, locks, queues, and async state machines, where correctness IS the interleaving rather than a value. Builds a deterministic interleaving harness (fake timers advanced into the pending window, concurrent launch, microtask stepping) and asserts each guarantee separately, including asymmetric ones where two paths deliberately differ. The falsifier is a test that never interleaved — operations run to completion in sequence exercise no race and produce a vacuous green indistinguishable from a real pass, so the proof obligation is to show the interleaving occurred, not that the assertion passed. Triggers on /mms-race-condition-repro, or when asked to prove a race condition is fixed, test cancellation or supersession, validate retry or debounce ordering, write a deterministic interleaving test, or check whether a concurrency test actually exercises the race. Callable by `evidence` as its deterministic-interleaving engine, and named by `falsifying-test` as its sibling for ordering bugs.
maturity: experimental
---

# /race-condition-repro

A race is nondeterministic in the wild, so you cannot validate "the stale retry was canceled" by
running the code and hoping the interleaving occurs. The evidence has to **make the race
deterministic** — force the exact interleaving, then assert the outcome.

The claim shape is distinctive: not a value, not a behavior, but an *ordering guarantee*. "When a
newer write supersedes a pending retry, the stale retry is dropped." No screenshot, benchmark, or
value assertion touches that.

> **Falsifier.** A test that never interleaved. If the operations ran to completion in sequence,
> no race was exercised and the green is vacuous — and it looks identical to a real pass. The
> proof obligation is to show **the interleaving happened**, not that the assertion passed.

This is the reward-hack specific to the category, and it is easy to write by accident: `await`
the first operation, then start the second, then assert. Every assertion passes. Nothing was
tested.

## Method

1. **State each guarantee separately, in interleaving terms.** Not "retries work" but "when B
   arrives during A's pending window, A's recovery event does not fire." One sentence per
   guarantee, each naming the arriving operation, the window, and the expected outcome.

   **Asymmetric guarantees are usually the crux.** Two paths that deliberately behave differently
   — a primary retry that *is* cancelable by a newer write, a backup retry that is *not* because a
   split write could leave backed-up keys stale — need one forced interleaving each. A harness
   that proves the symmetric half and assumes the other has proven the easy one.

2. **Force the interleaving.** Control time and ordering rather than waiting for them:

   | technique | purpose |
   |---|---|
   | `jest.useFakeTimers()` + `advanceTimersByTimeAsync(DELAY)` | fire the delayed action at a known point |
   | `Promise.all([opA, opB])` | overlap operations rather than sequencing them |
   | `advanceTimersByTimeAsync(0)` | step to a precise interleaving point between overlapping ops |

   The shape that matters: launch A, advance time *into* its pending window, inject B *during*
   that window, then assert. Never `await opA` before starting `opB`.

3. **Verify the interleaving before believing the assertion.** This is step 2's trust-gate and it
   is not optional — confirm time was advanced into the pending window and the superseding op was
   launched concurrently. Reading the assertion tells you nothing; a sequential test asserts the
   same things and passes.

   The cheap check: **break the implementation and confirm the test fails.** Revert the ordering
   logic, keep the test file byte-identical, re-run. A test that still passes never exercised the
   race. Show both runs — that mutation pair is the evidence, not the green run alone.

4. **Assert the negative side explicitly.** Cancellation guarantees are proven by absence:
   `expect(recoveryEvent).not.toHaveBeenCalled()`. A suite that only asserts things happened
   cannot detect a stale operation that ran when it should have been dropped. Pair every
   "must complete" (`.toHaveBeenCalledWith(...)`) with its "must not" counterpart.

5. **Corroborate the integration path if the claim reaches beyond the unit.** The deterministic
   harness is a *model* — exhaustive and fast, but a model. For a high-stakes claim, add one live
   forced-race capture in the real runtime (CDP/injection, the force-the-unobservable technique)
   to show the race exists where the model says it does. Unit harness for coverage, live capture
   for reality; use both when the cost of being wrong is high.

6. **Report transition telemetry with enough labeling to distinguish branches.** `retry-recovered`
   is ambiguous when there are two retry paths; `set-retry-recovered` vs
   `set-backup-retry-recovered` is not. If the observable can't tell the branches apart, it can't
   witness an asymmetric guarantee.

## Output

```
Ordering guarantees — <component> <claim>

| guarantee | forced how | assertion | result |
|---|---|---|---|
| B during A's window cancels A | advance <DELAY>, inject B via Promise.all | recovery .not.toHaveBeenCalled() | pass |
| backup completes despite newer write | advance <DELAY>, inject B | .toHaveBeenCalledWith(...) | pass |

Interleaving verified: <how time was advanced / where the concurrent op was injected>
Mutation check: <impl reverted> → <N failures>, test file unchanged
Live corroboration: <capture> | not run
```

Lead with the guarantee table — one row per guarantee, each naming how the interleaving was
forced. A row without a forcing mechanism is a sequential test wearing the category's clothes.
Report the mutation pair (head green / reverted red) as the evidence that the harness discriminates.

## Scope — what this is NOT

- **Not the generic falsifying test.** These *are* falsifying tests, but the category is the
  *technique* (forced deterministic interleaving) and the *claim shape* (ordering, not values).
  `falsifying-test` names this skill as its sibling for ordering bugs; use that one when the claim
  is a value or a behavior and the base/head arms are the whole story.
- **Not flake diagnosis.** A test that fails intermittently is a different problem from a
  guarantee that needs proving. Determinism here is the *method*, not the goal.
- **Not performance under load.** Throughput and contention are timing questions; this is about
  ordering correctness at a specific interleaving.

## Notes

Correctness of the *reasoning* about a race is not something to assert from reading. Where the
guarantee depends on runtime semantics — what an `AbortController` actually cancels, whether a
microtask runs before a timer callback — cite the behavior or demonstrate it in the harness rather
than describing it.

## Related

- `evidence` — this skill is its deterministic-interleaving engine: `evidence` decides that a
  concurrency claim needs an interleaving proof, and calls here to produce one. The category note
  is [`deterministic interleaving` in the evidence catalog](https://github.com/MetaMask/skills/blob/main/domains/pr-workflow/skills/evidence/references/evidence-catalog.md).
  A relative path would not survive installation — skills flatten to `mms-<name>/`, so a link
  out of one skill into another only resolves as a URL.
- `falsifying-test` — the sibling engine for ordering bugs that reproduce without a forced
  interleaving.
