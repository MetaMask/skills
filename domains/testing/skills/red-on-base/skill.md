---
name: red-on-base
description: Produce the strongest single proof that a fix targets the reported bug — a test that fails on the base commit and passes on the branch, with both runs shown. The falsifier is a test that fails on base for the wrong reason (import error, missing fixture, unrelated breakage) rather than by asserting the bug; that failure looks identical in an exit code and proves nothing. Also covers the diagnostic case: if no test can be written that fails on base, the fix's connection to the reported bug is the thing in doubt. Triggers on /red-on-base, or when asked to write a regression test for a fix, prove a bug fix works, show a test failing before and passing after, or check whether a PR's test actually covers its claim. Callable by evidence as the engine behind its falsifying regression test evidence category. Named for its own discipline rather than for that category, so it is not mistaken for `falsify-probe.sh`, which shares the two-arm shape and answers a different question.
maturity: experimental
---

# /red-on-base

Reach for this on **every bug-fix PR**. A test that passes on the branch proves the branch is
green. A test that **fails on base and passes on the branch** proves the change is causally
connected to the reported bug. Only the second is evidence, and the gap between them is where
this skill lives.

> **Falsifier.** A test that fails on base for a reason unrelated to the bug. A missing import,
> a fixture the base commit doesn't have, a helper introduced by the branch, an unrelated
> pre-existing failure — every one produces a red run and a non-zero exit code that looks
> exactly like a correct falsification. **The exit code is not the evidence; the assertion
> message is.**

## Method

1. **Write the test against the reported behaviour, not the diff.** Start from the issue's
   reproduction. A test derived from reading the fix tends to assert the fix's mechanism and
   will pass on base the moment the mechanism is reachable by other means — or fail on base
   for structural reasons rather than behavioural ones.

2. **Run it on base FIRST, and read the failure output.** Not the exit code — the message. It
   must fail on the **assertion that encodes the bug**: an expected value that differs, a state
   that wasn't reached, an event that didn't fire. If base fails with a
   `ModuleNotFoundError`, a syntax error, or a helper that doesn't exist yet, you have not
   falsified anything; you have discovered that the test can't run there.

3. **Pin the base explicitly.** Use the PR's actual merge-base, not whatever `main` points at
   today. `main` moves; a re-run weeks later against a drifted `main` is a different
   experiment and may fail for reasons that have nothing to do with the fix.

4. **Make the test runnable on base.** When the test needs a helper or fixture the branch
   introduces, split it: land the scaffolding in a form that exists on both sides, or inline
   the setup so the test file is self-contained. If that's impossible, say so and downgrade the
   claim — a test that *cannot* run on base gives a branch-only pass, which is a weaker piece
   of evidence and should not be presented as a falsifying one.

5. **Confirm it fails for one reason, not several.** If base has unrelated failures in the same
   file or suite, scope the run to the new test (by name/path) so the red is attributable. A
   suite that was already red proves nothing about your assertion.

6. **Show both runs, and let a tool write them down.** Base: the assertion failure, verbatim.
   Branch: the pass. Same command, same filter, both commits identified. Retyped output is a
   self-report — indistinguishable from output that was never produced — so the two arms want
   to come out of a runner rather than a paste buffer.

   `evidence` ships the mechanism: its run workflow takes `ref` and `baseline`, checks out both
   commits, executes the same command at each, and attaches the artifacts to a run URL a reader
   can open without going through you. Wrapping the test command in `capture.sh` gets the same
   property locally, minus the reader-verifiable half — and that runner's footer says so, in
   the artifact, rather than leaving the gap for a reviewer to notice.

7. **Pair it with the issue.** The PR's `Fixes #N` plus a test named for the behaviour makes
   the causal chain checkable by a reader who runs nothing.

## When you can't write one

This is a finding, not a gap to paper over. If no test fails on base, one of these is true:

- **The bug isn't where the fix is.** The most common case, and the reason to run this check
  before review rather than after.
- **The reported behaviour isn't reproducible in the harness** — timing, environment, or a
  real-device dependency. Say which, and reach for a different evidence category (a
  deterministic interleaving test for ordering bugs, an e2e trace for environment-dependent
  ones).
- **The fix is a refactor or hardening change, not a bug fix.** Fine — then the PR's claim
  should say that, and this category doesn't apply.

State which one. "No test added" with no explanation reads as an omission; the diagnosis is
useful information about the change.

## Output

```
Falsifying test — <test name>  (Fixes #N)
  base   <sha>  FAIL   <the assertion line, verbatim>
  branch <sha>  PASS
  command: <exact command, same on both>
  scoped: <how the run was limited to this test>
```

## The sibling experiment, and why it is not this one

`evidence` also ships `falsify-probe.sh`, which has the same two-arm shape and answers a
different question. The distinction is worth holding, because conflating them produces a proof
of the wrong thing:

| | arms | question |
|---|---|---|
| **this skill** | base commit, branch commit — same test | is the test causally connected to the reported bug? |
| **`falsify-probe.sh`** | one commit, one line mutated | does the test fail when the mechanism it guards is removed? |

A test can pass this skill and fail that one: it fails on base because the fix was not there,
and passes under mutation because it asserts something adjacent to the mechanism. The reverse
also happens. On a bug-fix PR you usually want both — the first proves the test is about *this
bug*, the second proves it will keep noticing.

What the runner does mechanise is step 2. Its guards refuse to call a red arm a falsification
when the suite ran fewer tests than the baseline, or failed to load at all — which is this
skill's falsifier, enforced rather than remembered. It also takes the names of the tests you
expect to fail, so a red run in the wrong place is reported as such instead of passing as a
falsification.

## Related

- `evidence` — packages this skill's output as its [falsifying regression test category](https://github.com/MetaMask/skills/blob/main/domains/pr-workflow/skills/evidence/references/evidence-catalog.md),
  and supplies the two-commit run harness step 6 asks for. The deterministic-interleaving
  category is the sibling for concurrency and temporal-ordering bugs; `race-condition-repro`
  drives it.
- `react-render-delta` — the same before/after discipline applied to a measured quantity
  rather than a boolean.
