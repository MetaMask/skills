---
name: coverage-partition
description: Measure which cases in a suite guard which mechanism, by defeating each mechanism in turn and recording the exact set of cases that go red. Reports the partition rather than the total, because "the suite has power" is a boolean while a suite's power is a distribution — and a suite credited with covering five behaviours routinely has one case standing between a mechanism and silence. Names why each survivor survived, since testing something else, being shielded by an upstream step, and being genuinely unaffected are three different facts that a count collapses into one. Use when a suite is offered as evidence for a specific claim, when one description credits one test set with covering several mechanisms, when deciding whether a green suite can be trusted to guard a security check, or when a mutation run reported a number and stopped there. Costs one full suite run per mechanism, two arms each.
---

# /coverage-partition

A mutation run that reports "4 of 7 tests failed" has answered a question nobody asked. **Which**
four is the reviewable fact, and it costs the same probe to find out.

"The test has power" is a boolean. A suite's power is a distribution, and the distribution is
almost never the one the author's sentence implies.

## Why a total is the wrong number

Totals compose badly. Seven cases that each defeat one mechanism and seven cases that all defeat
the same mechanism produce the same count and describe opposite suites. The count also hides its
own shape: a mechanism guarded by exactly one case looks identical, in the total, to a mechanism
guarded by four.

And a total cannot be checked against a claim. "This suite covers signing and verification" is an
assertion about *which* mechanisms the cases reach — it is refuted or supported by the partition
and is untouched by the number.

## The probe

For each mechanism the suite is credited with guarding:

1. **Defeat it minimally**, at its source, without breaking parsing — invert the condition, widen
   the pattern, replace the verification call with a constant that succeeds.
2. **Run the whole suite** and record the exact set of cases that go red, by name.
3. **Name why each survivor survived.** This is the step that turns a count into a map, and it is
   the step that gets skipped.

Then report the sets, one row per case, one column per mechanism.

## A worked partition

A seven-case suite, described by its author as covering "real ECDSA signing and verification
across valid signed, unsigned, tampered, malformed, and invalid-signature cases". Three
mechanisms, three probes:

| case | strip condition weakened | verification stubbed to succeed | value-format pattern widened |
|---|---|---|---|
| positive forward | — | — | — |
| legacy-signature | **fail** | — | — |
| missing-signature | **fail** | — | — |
| tampered | **fail** | **fail** | — |
| invalid-signature | **fail** | **fail** | — |
| unlisted-parameter | — | — | — |
| malformed-value | — | — | **fail** |
| | **4 of 7** | **2 of 7** | **1 of 7** |

Five cases pass with signature verification entirely disabled.

### Why each survivor survived

The three cases that survive the strip mutation survive for three unrelated reasons, and the
distinction is the finding:

- **The positive case is supposed to forward.** It tests the other side of the branch. Not a gap.
- **The unlisted-parameter case never reaches the strip** — an earlier canonicalization step
  already dropped that parameter, so the mutated condition does not run on it. This one is
  shielded, and it would keep passing no matter how badly the strip broke.
- **The malformed-value case is rejected by the format check first**, regardless of the strip. It
  is genuinely unaffected, and it is load-bearing for a different mechanism.

Three survivors, three facts. A count says "3 passed" and loses all of them. Shielded cases are
the ones worth naming out loud, because they read as coverage in a case list and provide none.

### What the partition said that the total could not

The suite's power is real and it is distributed — but most of it sits on the parameter strip, and
**exactly two cases would notice if signature verification stopped working entirely**. The
author's sentence reads as though all five case classes exercise verification. Five of them do
not.

The format check has one guarding case, and that case asserts three keys at once.

## Reading a partition

**Name why each survivor survives.** A case that passes under mutation is testing something else,
or shielded by a step upstream, or genuinely unaffected. Those are different facts and only the
second one is a problem — but you cannot tell which you have without looking.

**A mechanism with one guarding case is a finding, even when that case passes.** One case is one
refactor, one skip, one flaky quarantine away from zero, and nothing in a green run announces the
drop from one to none. Report it as a finding, not as coverage.

**A case that asserts several things at once counts as thin.** When it goes red you cannot tell
which assertion fired, so it cannot serve as the guard for any one of them. Its column entry
should be read as "something in here broke", which is a weaker fact than it looks.

**Overlap matters as much as coverage.** Cases that all fail under the same mutation are
redundant with each other under that mutation, however different their names and fixtures are.
Four cases failing on the strip is one guard with four expressions of it, and it will survive
deleting three of them.

## When to reach for it

When someone credits a suite as evidence for a claim — a PR description, a review reply, a
security sign-off. **"It has power" answers whether the suite is decorative. The partition answers
whether it has power over the mechanism named in the claim**, which is a different question and
usually an unasked one.

Reach for it also when a mutation run has already produced a number, because the expensive part is
already paid for and the partition is what that run was capable of reporting all along.

## Cost

One full suite run per mechanism, two arms each — mutated and clean, since a case already red on
the clean arm is not evidence about anything. Three mechanisms is six suite runs. That is the
honest price, and it scales with mechanisms rather than with cases, so a large suite over three
mechanisms costs the same number of runs as a small one.

Scope by mechanism, and pick them before running: the mechanisms the claim names, plus any
mechanism whose failure would be silent.

## Related

- [`falsifiers-first`](../falsifiers-first/skill.md) — supplies the defeats; this skill changes
  what gets recorded when they run
- [`silent-failure`](../silent-failure/skill.md) — a mechanism with zero guarding cases is a
  silent path by construction, and the partition is how the zero gets found
- [`evidence`](../evidence/skill.md) — the runners that execute the arms and capture the per-case
  results the partition is built from
- [`unintended-breakage`](../unintended-breakage/skill.md) — reads the same per-case results in
  the other direction, asking which cases went red that nobody meant to touch
