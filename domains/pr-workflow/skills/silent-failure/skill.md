---
name: silent-failure
description: Find the paths where this code can fail without anything saying so, and prove it by inducing the failure and watching for a signal that never comes. Asks a different question from correctness — not "can this break" but "if it breaks, would we know" — and treats detectability as a property to be tested rather than assumed. Use on error handling that swallows, fallbacks that substitute a default, caches and guards that fail open, retries that mask, instrumentation whose absence looks like health, and any measurement whose wrong answer is well-formed. Inverts the usual mutation verdict: a suite that stays green under an induced failure is the result, not a disappointment.
---

# /silent-failure

A loud failure is a solved problem: someone sees it, someone fixes it. The expensive failures
are the ones where the system keeps going, reports success, and the only evidence is an
observable nobody is watching.

This skill hunts those, and it proves them rather than suspecting them.

## The question

For every mechanism on the path, ask **not** "can this be wrong" but:

> If this were wrong right now, what would be different?

Three answers, and only one of them is comfortable:

- **A test fails, a log appears, a metric moves.** Detectable. Move on.
- **A different, plausible value is produced.** Silent. This is the dangerous one, because the
  output is well-formed and the reader has no reason to doubt it.
- **Nothing whatsoever.** Silent and unbounded, and it will be discovered by a user.

The second answer is where most of the real ones live, and it is why "can it fail" is the wrong
question. Nobody ships a mechanism that explodes. They ship one that returns `0`, or `[]`, or
the previous value, or the default.

## Where to look

These are the shapes that produce silence, ordered by how often they turn out to be real:

| shape | why it goes quiet |
|---|---|
| `catch` that returns a default | the error is the signal, and it was consumed |
| optional chaining on the thing that does the work | `a?.b?.()` is a no-op when the dependency is missing, and a no-op looks like success |
| a fallback that substitutes a plausible value | the wrong answer is well-formed |
| a guard that fails open | the unprotected path is also the working path |
| a cache or memo whose key is incomplete | a stale value is a valid value |
| a bounded buffer that evicts | the evicted item is indistinguishable from one that completed |
| a retry that eventually succeeds | the failures never reach anyone |
| instrumentation that is conditionally off | absent data reads as healthy, not as unmeasured |
| a name that does not match what is counted | the number is right and describes something else |
| a check whose pattern cannot match the failure | absence of matches reads as absence of the thing |

The last three are about the *instruments*, and they belong here for a reason: a measurement
that fails silently is worse than one that fails loudly, because its output gets published.

## Inducing it

You cannot observe a silent failure — that is its definition. So make it happen and watch for a
signal that never comes.

For each candidate:

1. **Name the signal you expect.** A test by name, a log line, a metric, a thrown error. If you
   cannot name one before you start, you have already found the answer.
2. **Induce the failure at its source**, minimally, without breaking parsing. Make the
   dependency absent, the guard fail, the cache return stale, the buffer evict, the flag off.
3. **Run everything that could plausibly notice** — not just the module's own tests. The point
   is breadth of detection, so the widest suite that could reasonably fire is the right one.
4. **Record what went red.** Nothing going red is the finding.

**The verdict is inverted from a normal falsification probe.** There, a suite that stays green
under mutation means the test is vacuous and you go fix the test. Here, a suite that stays green
under an induced failure means *the failure is undetectable*, which is a property of the system
and a legitimate result to report. Say which reading you are applying, in the artifact, because
the same green output supports both and they are opposite conclusions.

## Reporting

For each confirmed silent path, three facts and no adjectives:

- **The induced failure** — what was made to go wrong, and where.
- **What was watched** — the suites, logs and metrics that had a chance to notice.
- **What happened** — ideally a captured run showing green under a broken mechanism.

Then one line on **who finds out, and when**. That is the sentence a reviewer acts on. "Nothing
detects this; it surfaces as a support ticket" and "nothing detects this; the value is wrong by
a factor of two in a dashboard" are different findings even though the mechanism is identical.

Do not rank by severity of the failure. Rank by **distance to discovery** — how long the wrong
state persists before anyone can see it. A small error nobody can detect outranks a large one
that pages someone in a minute.

## What this skill is not

**Not error handling review.** A `catch` that swallows is a candidate, not a finding. It
becomes a finding when the induced failure produces no signal anywhere.

**Not the same as unintended breakage.** [`unintended-breakage`](../unintended-breakage/skill.md)
asks what a change broke that nobody meant, and one of its tiers is breakage that surfaces
quietly. This skill asks whether a mechanism — new or ten years old, changed or untouched —
announces its own failure. Different question, different input, and they overlap only on the
one tier.

**Not a search for missing tests.** A path with no test but a loud runtime error is detectable.
A path with full coverage that returns a default on failure is not. Coverage and detectability
are independent, and confusing them produces a report about test quality when the finding was
about observability.

## Related

- [`falsifiers-first`](../falsifiers-first/skill.md) — supplies the induction technique; this
  skill reads its verdict in the opposite direction
- [`unintended-breakage`](../unintended-breakage/skill.md) — overlaps only at its
  breaks-silently tier, and starts from a change rather than from a mechanism
- [`evidence`](../evidence/skill.md) — the runners that induce the failure and capture the
  green output that proves nothing noticed
