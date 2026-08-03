---
name: observability-gap
description: Before debugging a path, establish what signal already exists on it — logs, metrics, error reporting, test coverage, user-visible state — and treat the blanks in that inventory as the first finding. A bug you cannot see is a bug you will fix by guessing, so once reading has stopped narrowing the search, the productive move is to install signal rather than read further. Separates absent signal from suppressed signal — filtered by level, sample rate, a feature flag, or an error-swallowing wrapper — because they are different problems with different fixes, and the suppressed one is both more common and more expensive. Use when a bug reproduces but its cause is invisible, when a report arrives with no trace attached, when reading code has stopped eliminating candidates, or when instrumentation appears to exist and the environment where the bug happens is emitting none of it.
---

# /observability-gap

The first question about a bug is not "where is it". It is **what would have told me**.

A path you cannot see is a path you will fix by guessing, and a guess that happens to make the
symptom go away is indistinguishable from a fix until it comes back. The opening move on an
unobservable path is usually to make it observable — not because instrumentation is virtuous,
but because every subsequent step is cheaper once the path reports on itself.

## Inventory the signal before the code

For the path under investigation, write the list before reading further:

| signal | what to check | a blank here means |
|---|---|---|
| logs | is anything written on this path, at what level | the path runs and leaves no trace |
| metrics / traces | is the operation counted, timed, spanned | you cannot tell how often, or whether it is getting worse |
| error reporting | does a failure here reach Sentry or equivalent | failures are counted by users, not by you |
| tests | does anything execute this path at all | you cannot reproduce without the full system |
| user-visible state | does the UI or the API response differ when this goes wrong | the only detector is a human noticing |

The list is not the deliverable. **The blanks are the finding**, and a path with five blanks is
not a hard bug, it is an unobservable one — a different problem with a different first move.

## Absent is not suppressed

No log line, and a log line nobody sees, look identical from where you are sitting. They are
not the same problem:

- **Absent** — the code never emits. The fix is to write the emission, and it lands in the diff.
- **Suppressed** — the code emits and something eats it: a level filter, a sample rate, a
  feature flag or env gate, a transport pointed at a sink nobody reads, or a `catch` that
  consumes the error before anything can report it. The fix is usually a config change, often
  one line, sometimes in a repo you do not own.

Suppressed is the more common case and by far the more frustrating, because the codebase reads
as instrumented. Grep found the log line. The line is there. It is just not reaching you, and
every minute spent explaining why the code "should" be logging is spent on the wrong question.
Establish which of the two you have before proposing anything.

## Read until it stops narrowing, then install

Reading has a point of diminishing returns and it is easy to blow past, because reading feels
like progress in a way that writing a log line does not.

The tell is mechanical: **two consecutive passes over the same files that eliminate no
candidate**. At that point more reading is not going to produce the answer, and the cheapest
remaining move is to add signal and run it again. One log line at the right boundary routinely
settles a question that an hour of reading left open, because it reports what actually
happened rather than what the code permits to happen.

## Instrument the boundary, not the suspect

Put signal at the **edges of the subsystem**, not on the line you suspect.

A boundary tells you whether the problem is inside or outside, which halves the search
regardless of whether your hypothesis was right. Signal on your favourite line tells you about
that line only, and only in the case where you had already guessed correctly — which is the
case where you needed the least help. Instrument in and out first; narrow after the halving.

## The gaps worth naming

| class | why it costs you |
|---|---|
| a failure path with no error reporting | the failure is real and the count is zero |
| an async boundary that loses context | the error surfaces detached from its cause, pointing at the awaiting frame instead of the failing one |
| a conditional whose branch is not recorded | you cannot tell which way it went, so both explanations survive |
| state mutated with no trace of the mutator | you can see the wrong value and not who wrote it |
| a third-party call whose failure mode is a default return | a degraded dependency is indistinguishable from an empty result |
| instrumentation that is off in the environment with the bug | the signal appears to exist |

The last one is the most expensive in this table, and the reason is in the phrasing: the others
announce themselves as gaps once you look, and this one does not. You find the log line, you
assume the path is covered, and you spend the afternoon reasoning about why the covered path
produced no output.

### The environment check

Confirm the signal is on **in the environment where the bug happens**, not in the one where you
are reading the code. A metric emitted only in production and a log emitted only in development
are both silence exactly where you need them — and each looks like working instrumentation from
the other side.

Concretely, for each signal you are counting on: which env vars, flags, log levels, sample
rates and build modes gate it, and what are their values *on the machine that reproduced the
bug*. If you cannot answer that, you do not know that the signal exists there; you know it
exists in the source.

## Keeping what you added

A signal you add to find a bug is a signal the next person needs. Decide deliberately before
removing it, and default to keeping it: the path was hard to debug **because** it was
unobservable, and reverting the instrumentation restores precisely that condition for whoever
arrives next.

Reasons to remove are real but specific — a per-iteration log in a hot loop, output containing
user data, a metric whose cardinality is unbounded. "It was only for debugging" is not one of
them. If the volume is the problem, lower the level or gate it behind a sample rate rather than
deleting it, so the next person can turn it back on instead of rediscovering the gap.

## Related

- [`silent-failure`](../../../pr-workflow/skills/silent-failure/skill.md) — the review-facing
  sibling. Same property, opposite end: it asks whether a mechanism would announce its own
  failure, this one starts from a failure that already happened and nobody saw
- [`falsifiers-first`](../../../pr-workflow/skills/falsifiers-first/skill.md) — once the path
  reports on itself, hypotheses about it become testable rather than arguable
- [`flaky-test-detection`](../flaky-test-detection/skill.md) — the same gap inside a suite,
  where the missing signal is what the test observed on the run that failed
