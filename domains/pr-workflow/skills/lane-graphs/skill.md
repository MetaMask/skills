---
name: lane-graphs
description: Route a claim to a small executable graph that measures it, instead of running a procedure from prose. Each graph is a fixed sequence of preconditions, a capture step, and a prediction check — deterministic where determinism is cheap, so the judgement stays on which graph to run rather than on how to run it. Defines the router contract, including the two outcomes that make routing honest: no-match as a first-class result, and a mandatory unrouted read whose findings no graph was looking for. Use when a claim maps onto a known measurement kind, when a run needs to be repeatable by someone who did not design it, or when deciding whether a new lane deserves a graph at all.
maturity: experimental
---

# Lane graphs

A prose lane says what to measure. A graph runs it. The difference is not rigour — it is that a
graph fails the same way every time, which is what makes a failure findable.

The split this skill exists to hold: **routing is judgement, execution is not.** Choosing which
measurement answers a claim requires reading the change. Computing a merge-base, checking a probe
loaded, verifying the mutation landed where it was aimed — none of that requires reading anything,
and all of it has been got wrong by hand.

## What a graph is

Five nodes, in this order, and a graph missing any of them is a script rather than a graph:

| node | job | fails when |
|---|---|---|
| **preconditions** | the range is the pull request's, the target is open, the tree is at a pinned SHA | any is false — before anything expensive runs |
| **baseline** | run the measurement unmutated | it does not produce the expected shape of output |
| **treatment** | apply exactly one change, read back what was applied | the applied thing differs from the requested thing |
| **prediction** | the named observation the treatment should produce | it is absent, or something else moved instead |
| **capture** | the tool writes the artifact; the run URL is the citation | nothing was written |

Two of these exist because they were missing and something published anyway: reading back the
treatment, and naming the prediction. A run whose treatment silently changed shape, or that went
red somewhere other than where it aimed, satisfied every other node.

## The router contract

The router takes a claim and returns a graph, **or nothing**. Both are results.

**1. It may return no match, and no-match is a first-class outcome.** A router over enough lanes
always finds a best score. That score is meaningless if nothing was actually a fit, and a graph
run on a claim it does not measure produces a clean green that answers a question nobody asked.
The router must be able to say the claim is not of a kind it measures, and that must be reportable
rather than a fallback into the nearest lane.

**2. An unrouted read runs regardless of what matched.** Before or alongside the graph, read the
mechanism and write down what could break, without reference to the lane catalog. This is not
redundancy. The catalog is a list of questions someone already thought of, so anything outside it
is invisible to routing by construction — and that is exactly where the findings worth having
tend to sit. Its output feeds the unclaimed bucket.

**3. The route is part of the artifact.** Publish which graph ran and why it was chosen. A reader
who disagrees with the routing can then say so, which is impossible if only the result is shown.

**4. A graph reports what it does not cover.** Each states its own blind spot in its output — the
paths it does not traverse, the properties it does not assert. A green result that does not say
what it declined to measure reads as broader than it is.

## When a lane should not get a graph

Graphs cost maintenance and drift silently: a defect can sit in one for weeks while every run it
produces looks correct. So the bar is not "could this be automated".

Build a graph when the measurement is **run more than a handful of times**, its **preconditions
have been got wrong by hand**, and its **result is checkable without interpretation**. Leave a
lane in prose when the interesting part is the reading — a policy diff, a retention review, a
supply-chain disposition — because there the procedure is trivial and the judgement is everything.

## Two failure modes with the same shape

**A deterministic graph makes wrongness consistent.** A flaky procedure fails visibly; a
deterministic one fails identically forever and reads as evidence. The published examples in this
repository's own trial runs bear this out — large node counts, reproducible artifacts, checksums,
and assertions that keyed on a per-case sentinel rather than on absence, so a regression leaking a
different value would have passed every run.

**A large green total stops being read.** Fifty-three of fifty-three, two hundred and one of two
hundred and one. Report the partition instead: which nodes carry the claim, which are navigation,
and which assertions would notice a regression. A total is a summary of effort, not of coverage.

## Related

- [`evidence`](../evidence/skill.md) — owns the lane catalog these graphs execute, and the runners
  that are their capture step
- [`falsifiers-first`](../falsifiers-first/skill.md) — supplies the unrouted read, and receives its
  output as the unclaimed bucket
- [`instrument-check`](../instrument-check/skill.md) — the controls a graph needs before its
  results count
- [`coverage-partition`](../coverage-partition/skill.md) — what to report instead of a total
