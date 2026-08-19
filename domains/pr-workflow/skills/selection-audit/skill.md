---
name: selection-audit
description: A count is the output of a selection rule, so two counts agree only when their rules do — report the rule that produced the number rather than the number, and never read a matching count as corroboration until both selections have been written out and compared. Catches the failure where a PR claims N affected suites and a validation run measures the same N from a narrower rule, and the coincidence closes a question nobody then asks. Use when checking a count against someone else's, when a report says "N of them" — tests, files, call sites, consumers, events — and the interesting question is which N, or when a word like affected, related, relevant or impacted is quietly doing the selecting.
---

# /selection-audit

A count is the output of a selection rule. The number is the cheap part; the rule is the claim.

Two people can produce the same number from different rules and read it as agreement. That is
worse than disagreeing, because a disagreement gets investigated and a match closes the
question.

## The case

A PR body claimed **18 affected Perps suites / 730 tests passed**. A validation run measured
**18 suites, 731 tests**, and read the exact suite-count match as corroboration — off by one
test, dead on for suites, so the selections must be the same set.

They were not. They were two different rules landing on the same number:

- **The run's rule** was every `*.test.*` file in the PR's own diff: 19 such files, of which 18
  still exist at head, because the PR deletes one.
- **The author's word was "affected"**, which selects something else entirely — a changed source
  file affects suites that do not themselves change. At head, 31 test files reference the
  controller package whose Jest stub this PR grows by 156 lines, and 15 reference the events
  constants module.

So "18" was reproducible, defensible, and meant a different thing in each mouth. The match was a
coincidence of two boundaries, and it carried exactly zero information about whether the run had
covered what the author claimed. Nineteen minus a deletion is not thirty-one.

The one-test difference has its own lesson. It was explained away by a commit landing after the
pin the author had measured at — an explanation asserted from a *line* count in that commit
rather than a test count, and it stood unchallenged until someone actually counted. A plausible
mechanism offered for a numeric gap is a hypothesis about numbers, and it is checkable with the
same effort it took to say.

## The rule

**State the rule, not the count.** "Every changed test file that still exists at head" is a
claim someone can reproduce or dispute. "18 suites" is not — it is the residue of a claim, with
the claim removed. Write the selection into the report at the point where the number appears.

**Matching numbers from unstated rules are not agreement.** Before treating a match as
corroboration, make both rules explicit and check they are the same rule. If you cannot state
the other party's rule, you have not confirmed anything; you have found that two unknown sets
happen to be the same size.

**"Affected", "related", "relevant", "impacted" are selection rules in disguise** — and almost
always broader ones than whatever got run, because they reach through the change into code that
did not change. When someone else's count uses one of these words, the question is not whether
their number is right. It is what set the word names.

**Name what the rule excludes.** A selection is defined by its boundary, and the excluded set is
where the missing coverage lives. "Every changed test file" excludes every unchanged test that
exercises the changed source — which is the entire population a reviewer cares about. Reporting
the boundary costs one sentence and is the only part of the count that can surprise anyone.

**A count measured at a different commit is a different count.** Say where you measured. If you
are comparing two numbers, say whether they were measured at the same place, and treat "they
differ by one" as unexplained until the commits match or the difference is counted rather than
narrated.

## The tell

You are about to write **"which matches"**, **"as claimed"**, **"consistent with the PR body"**,
or **"confirming the author's figure"** about a number.

Stop there. Two numbers agreeing tells you nothing until two rules agree, and the sentence you
were about to write is the one that converts a coincidence into a finding. Write the two rules
side by side first; if they turn out to differ, the match is the finding, and a more interesting
one than the confirmation would have been.

## Beyond test counts

The shape is general, and the phrase to watch for is "N of them":

| the count | the rule hiding inside it |
|---|---|
| files changed | tracked? generated? vendored? renames as one or two? |
| call sites | static references, or reachable at runtime? through re-exports? |
| consumers | packages that import it, or packages that ship it to users? |
| events emitted | distinct names, or instances, and over what window? |
| failing tests | at which commit, with which shard, retries counted or collapsed? |

Every row is a place where two competent people report different integers and neither is wrong.
Anywhere a report says "N of them", the number is an answer to a question that was never
written down — and your job is to write it down, especially when the number looks right.

## Related

- [`falsifiers-first`](../falsifiers-first/skill.md) — a count that agrees with the claim is the
  most comfortable result available, and the least examined; this is that failure in its
  numeric form
- [`coverage-partition`](../coverage-partition/skill.md) — takes the excluded set seriously as
  its own object, rather than as the remainder of a selection
- [`scope-of-search`](../scope-of-search/skill.md) — the same discipline for what a search
  looked at, where an empty result and an unsearched region are indistinguishable
- [`evidence`](../evidence/skill.md) — where the rule gets recorded alongside the number, so the
  count remains reproducible after the run
