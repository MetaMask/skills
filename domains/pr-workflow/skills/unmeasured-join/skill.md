---
name: unmeasured-join
description: Audit a finding for the step between its facts — the inference that turns two true observations into a conclusion, which is usually the only part nobody instrumented. Decomposes a finding into steps, marks each measured or asserted, and requires an instrument on the connecting step, because the facts are almost always fine and the join is where it fails. Use before publishing a verdict, when reviewing another run's report, when a finding reads as obviously right, and especially when its conclusion is correct — a right answer through an unmeasured step leaves nothing downstream to contradict it. Triggers on any finding whose statement needs "so", "therefore", "which means" or "hence", on a conclusion assembled from a grep plus an interpretation, and on set-membership claims hidden in possessives like "the recipe's coverage of X".
---

# /unmeasured-join

A finding is two or more facts and a step between them. The facts get checked. The step is the
finding.

That asymmetry is the whole failure. Every fact in a bad report can be individually true and the
report still wrong, because the error lives in the connective — and the connective is the one
part that never got an instrument pointed at it.

## Why it survives review

A reader who checks the facts and finds them solid stops checking. This is not laziness; it is
the correct heuristic applied to the wrong target. Verifying a fact *feels* like diligence — you
run something, you read output, you tick it off. Passing over the "so" between two verified
facts feels like reading, not like skipping a step, because grammar presents it as connective
tissue rather than as a claim.

So the join gets the least scrutiny of anything in the finding, while being the cheapest thing in
it to check. Re-deriving the facts is the expensive part. The join is usually one grep, one
count, or one repeated request under a different identity.

## Four that shipped

Each of these had facts that held up. Each failed at the join.

**A stale evidence bundle that did not matter.** Facts: the bundle pins commit A; three commits
landed after it; one of them changes close-all transport error tracking; close-all error tracking
is analytics emission; the evidence recipe measures analytics. Every one true. **Join asserted:**
that the recipe's analytics coverage *includes close-all*. Measured afterwards:
`grep -icE 'close[-_ ]all'` returns 0 across the recipe, the report and the trace — zero of 201
nodes would differ. The verdict was withdrawn. Note where the claim hid: "the recipe's analytics
coverage" is a possessive, and it is carrying a set-membership assertion that a grep settles in
seconds.

**730 versus 731.** A run explained the one-test difference with "commit X adds 40 lines to that
test file". The conclusion was right — the commit does add one test — and a line count cannot
yield a test count. Forty lines is two `it()` blocks and a deleted one, or a fixture and no
tests at all. The commit happens to add exactly one `it()`, which nobody counted until an
adversarial pass did. The instrument was `grep -c 'it('` on one file.

**Signing without verifying.** A run credited a PR's claim of "real ECDSA signing and
verification" on a grep whose output contained `webcrypto`, `subtle.sign` and
`subtle.generateKey`. The pattern also included `subtle.importKey` and `subtle.verify`; both
matched nothing. **Join asserted:** signing present therefore verification exercised. A suite
that signs with a real key and never verifies produces exactly that output. The instrument had
already run here — the disconfirming half of its own pattern was in the file and went unread,
because a compound pattern reports the union and the reader takes the union as the answer.

**A link that was not broken.** A run reported a documentation link as broken because it returned
404 to an anonymous fetch. It returns 404 to an authenticated token too. That is what an
org-internal repository looks like from outside the org, not what a broken link looks like. The
fetch measured reachability *from this identity*; the finding needed existence, and 404 does not
distinguish the two. One repeat request under different credentials separates them.

## The rule

Decompose the finding into its steps. Mark each one:

- **Measured** — an instrument ran, and you read its output *including the part that did not
  match*. A pattern with five alternatives produces five results, not one.
- **Asserted** — you supplied it. Domain knowledge, a reasonable reading, a thing that is
  obviously true. All of those are assertions.

Then: **the connecting step must be measured.** Not the facts — the step that turns them into a
conclusion. Facts arrive already instrumented, which is why they are facts; the join is the part
you wrote.

An instrument on a join is small by construction, because a join is a small claim. Membership:
grep for the term in the artifact. Quantity: count the thing you are claiming changed, not a
proxy for it. Identity or environment: repeat the observation with the variable changed. If you
cannot name the one command, the step is not yet stated precisely enough to be a step.

### The tell

If a finding needs the word **"so"**, **"therefore"**, **"which means"** or **"hence"**, that is
where the instrument goes. Those words mark the seam where facts become a conclusion, and the
seam is the failure surface.

They are the easy case. Joins also hide where there is no connective at all — in a possessive
("the recipe's coverage"), in an apposition, in a noun phrase that quietly names a category
membership ("close-all error tracking is analytics emission" is a fact; "the analytics the recipe
measures" is a set, and putting the two beside each other is an argument). When a sentence has no
"therefore" but the conclusion still moved, something joined silently. Find it.

## When the conclusion is right

This is the hardest case, and it is worth being honest about why: nothing downstream contradicts
it. The test count really was 731. No later step trips, no reviewer notices, no CI job disagrees.
The reasoning is defective and the artifact is clean.

Which means it can only be caught by **auditing the reasoning rather than the result** — and that
audit has to be scheduled, because nothing about a correct answer prompts one. If the 730/731
commit had added forty lines of fixtures and two `it()` blocks, the identical sentence produces
the identical confidence and the answer is wrong. The method was already broken when it was
right; the outcome just did not report it.

Treat a correct conclusion reached through an asserted join as a defect of the same class as a
wrong one, and say so in the writeup. A run that only records where it was wrong has no way to
learn that it was right by accident.

## What this is not

**Not a demand that everything be measured.** Assertions are how a finding gets written at all.
The rule is narrow and it is positional: the *connecting* step, the one doing the inferential
work, is the one that must be measured. Marking the facts asserted where they plainly hold is
fine and costs nothing.

**Not fact-checking.** A run that re-verifies every fact and never names the join has done the
expensive half of the work and skipped the half that fails. The facts being solid is the
precondition for this skill applying, not evidence against it.

## Related

- [`falsifiers-first`](../falsifiers-first/skill.md) — fixes hypotheses before seeing the claims;
  this skill audits the inference inside a hypothesis once it has produced a finding
- [`silent-failure`](../silent-failure/skill.md) — its "a check whose pattern cannot match the
  failure" row is the ECDSA case seen from the instrument's side
- [`evidence`](../evidence/skill.md) — the runners that execute a join's instrument, and the gate
  a finding passes before it is published
- [`unintended-breakage`](../unintended-breakage/skill.md) — findings about a change's blast
  radius are assembled from exactly this shape, and the radius is the asserted step
