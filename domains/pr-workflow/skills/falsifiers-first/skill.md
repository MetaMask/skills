---
name: falsifiers-first
description: Derive what could break from the diff before reading the PR description, test those hypotheses, and only then compare the results against what the PR claims. Inverts the usual order so the author's wording cannot decide which mechanisms get probed, and produces a bucket no description-led run can — effects the change has that nobody claimed. Use when validating a PR whose description makes testable assertions, when a previous run confirmed everything and taught nobody anything, or when the change is security-relevant and the interesting failure is the one not mentioned. Pairs with the evidence skill's runners for execution and the attest gate before publishing.
---

# /falsifiers-first

Read the diff. Write down what could break. Test it. **Then** open the description.

The order is the whole skill. Everything else here exists to keep it.

## Why the order is load-bearing

A description-led run picks its falsifiers out of the author's sentences, so it probes the
mechanisms the author already thought about and phrased clearly. That produces three failures
at once, and they compound:

**The probe lands on the most legible line, not the weakest one.** A condition the description
names is a condition the tests already isolate, so mutating it is the experiment most likely to
be caught and least likely to teach anything.

**Your method mirrors theirs.** If the description says "a diff audit found no X" and you audit
the diff for X, a blind spot in their grep is a blind spot in yours, and agreement carries
almost no information. Two people running the same check is one check.

**There is no bucket for what the description omits.** This is the expensive one. A run whose
hypotheses come from the claims can, structurally, only confirm or refute claims. The most
valuable finding on a change is routinely something nobody wrote down — and it is unreachable
from a method that starts by reading what was written down.

Sealing is what buys all three back. Fixing the hypotheses before seeing what they will be
compared against is the same discipline as pre-registering a study, and for the same reason.

## Phase A — the diff alone

Do not open the description. Do not read the linked ticket. If the PR title is on screen,
ignore it; a title is a claim.

Read the change and answer, in this order:

1. **What does this actually do?** Mechanism by mechanism, in your words, from the code.
2. **Where can each mechanism fail?** Not "is it wrong" — *what would have to be true for it to
   be wrong*, stated so it could be checked.
3. **For each, what is the smallest defeat?** Usually one line: a condition inverted, a guard
   disabled, a bound widened, a call replaced by a constant.
4. **Which test should fail when you apply it?** By name. This is a prediction, and writing it
   down is what makes the run falsifiable rather than decorative.

Write the list to a file before anything runs. A hypothesis you can revise after seeing the
result is not a hypothesis.

**Rank by where refutation would be most surprising**, not by what is easiest to reach. A
mechanism with one obvious guard and three tests around it is well covered by construction; the
mechanism assembled from two files and no direct test is where the run earns its cost.

### Choosing defeats that mean something

- **Prefer a value or a call over a boolean.** Flipping `||` to `&&` probes operands the suite
  usually isolates already. Widening a validation pattern, or replacing a verification call
  with a constant, reaches code that guards rather than code that branches.
- **A mechanism split across two lines can only be attacked at one end.** Set-here, check-there
  guards need a decision about which end, and the answer is usually the one with no test
  pointing at it.
- **A defeat that breaks parsing proves nothing.** Every test fails, which looks identical to a
  falsification by exit code. Keep every identifier referenced so the module still loads.

## Phase B — run them

Each hypothesis becomes one probe with its prediction attached. The runners in the evidence
skill take the prediction directly, and a probe that fires somewhere other than predicted is
its own outcome rather than a pass.

Record every result, including the ones that refuse to reproduce. A hypothesis that survives
its defeat is a finding — the mechanism is better covered than it looked — and dropping it
because it was not interesting is how a run becomes a highlight reel.

**Nothing about the description enters here.** If a result makes you want to check what the
author said, that is the phase working; write the impulse down and keep it sealed.

## Phase C — open the description, and sort

Now read it. Sort every measured result into one of three buckets, and report all three:

| bucket | meaning |
|---|---|
| **Supported** | the measurement and the claim agree |
| **Contradicted** | the measurement and the claim disagree |
| **Unclaimed** | the change does this, and the description does not say so |

**The third bucket is the product.** It is why the phases are ordered this way and it is the
only one a description-led run cannot produce. It catches undersold changes as well as oversold
ones — a mechanism that is more careful than advertised belongs there too, and saying so is
worth as much to a reviewer as catching an overstatement.

### Scope discipline in phase C

Diff-first search reaches code the PR did not touch, and it will find real things there. Report
them, and do not report them as marks against this change. Two rules:

- A finding outside the diff is attributed to the system, never to the author. "These three
  routes forward raw parameters" is publishable; "your PR fails to handle" is not, when the PR
  never went near them.
- If a finding outside the diff is security-relevant, it leaves the PR entirely and goes to the
  private tracker. Venue is decided by subject, not by severity.

## Failure modes this skill has, and what they look like

**Cost.** Enumerating falsifiers across a large diff is a search problem; reading four sentences
is not. On a change past a few hundred lines, phase A is most of the run. Scope by mechanism
rather than by file — a 5,000-line diff often has four mechanisms.

**Lost signal.** A description's manual-testing steps frequently name the exact edge the author
was worried about, which is genuine information you are declining to use during phase A. You
get it back in phase C. Sealed is not discarded.

**Phase A rationalising.** The tell is a hypothesis phrased so that any outcome confirms it.
If you cannot name the observation that would make you say "no, it holds", it is not a
hypothesis, it is a suspicion.

**Leakage.** CI check names, review comments, commit messages and branch names all carry the
author's framing. Perfect sealing is not achievable; note what leaked rather than pretending it
did not.

## Related

- [`evidence`](../evidence/skill.md) — the runners that execute phase B, and the gate that
  decides whether phase C's writeup is publishable
- [`unintended-breakage`](../unintended-breakage/skill.md) — the mirror of this skill, which
  reads the description *first* because "out of scope" is undefinable without a stated scope
- [`pr-readiness-check`](../pr-readiness-check/skill.md) — checklist-shaped review, which this
  deliberately is not
