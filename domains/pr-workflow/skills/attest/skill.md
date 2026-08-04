---
name: attest
description: The gate an evidence artifact passes before it is published to a pull request, issue or shared tracker. Two halves that do not substitute for each other — a mechanical pass that greps for the properties a reader needs (marker pair, pinned environment, a captured artifact rather than typed prose, a destination that is still open) and a dispatched pass sent to fresh instances that contest the framing, the coverage, and how it reads to a stranger. The author is the wrong checker: they remember running the check, and the memory supplies the provenance the text lacks. Verdicts are attested, attested with named caveats, blocked, or not a run — the last being common and legitimate, because a run that could not execute has produced nothing to publish. Triggers on mms-attest, or before posting any evidence, validation or diligence output to a public surface.
maturity: experimental
---

# /mms-attest

The gate an evidence artifact passes before it leaves your hands. Use before posting any
`/mms-evidence` or diligence output to a pull request, issue, or shared tracker.

## The author is the wrong reader, and the wrong checker

A validation run claims something was measured. Its characteristic failure is not a wrong number
— it is **prose that reads like a measurement**. An operator who ran the check cannot see this,
because they remember running it; the memory supplies the provenance the text lacks, before the
eye registers that it was missing.

This is not hypothetical. A run in this workflow shipped a results section whose commands, exit
codes and "reached 100%" were typed by hand, while the real logs sat unpublished on disk. The
author had the skill installed that forbids exactly that.

So the gate has two halves, and neither substitutes for the other.

**The mechanical half is not advisory.** Marker presence, a pinned environment, whether any
fenced block is a tool's output rather than the author's transcription, whether the destination
is still open — all greppable. Anything checkable is checked before a model is asked for
judgement, because a model asked "is this good evidence?" answers from inside the frame that
produced it.

**The dispatched half is positional.** Contesting the frame, the coverage, and the reading cannot
be self-run, for the same reason an author cannot proofread their own sentence for a word their
eye supplies.

## Phase 0 — mechanical, no model

```
scripts/attest-gate.sh <artifact.md> --target <owner/repo#N>
scripts/attest-gate.sh <artifact.md> --target <owner/repo#N> --diligence
```

Thirteen checks; every one a hard fail. `--diligence` swaps the four Validation-Run envelope
checks for a no-verdict contract's own and shares everything downstream. See
[references/phase-0-checks.md](references/phase-0-checks.md) for what each check exists to catch
and the run that caused it to be written.

**Run it as the same command that publishes, or it is a log line.** The gate and the write must
be one chain — `gate && publish`. Running both and reading the verdict afterwards is how a
blocked artifact reaches a public PR. The `hooks/pr-evidence-gate.py` PreToolUse hook enforces
this independently of your discipline, and fails closed; phase 0 is what you run to iterate
before it does.

## Phase 1 — dispatched, three lenses

| pass | reads for | returns |
|---|---|---|
| **outframe** | the frame — what claim was chosen, and what a different framing makes visible | findings the framing hid |
| **missing** | coverage — modality not run, claim unverified, source unread | the gap list |
| **press** | the text as it ships, as the stranger who has to act on it | leak and register findings |

Dispatch to fresh instances is the mechanism, not an optimisation: a self-run frame check is
composed inside the frame it is meant to test. Briefs in
[references/dispatched-passes.md](references/dispatched-passes.md).

Skipping a pass is allowed. Silently skipping it is not — name it as skipped in the verdict.

## Phase 2 — shape

Front-load the verdict, cut anything that does not change what the reader does, keep every
artifact and move only its placement. Shape only, after content is settled — a shape pass that
reaches content is how a capability table gets dissolved into paragraphs and the comment's
payload disappears.

## Verdict

```
ATTESTED        phase 0 clean, no blocking finding from phase 1
ATTESTED WITH   publishable, with named caveats carried INTO the artifact
BLOCKED         phase 0 failure, or a phase 1 finding that invalidates the claim
NOT A RUN       nothing was measured; there is no artifact to publish
```

`NOT A RUN` is legitimate and common. A run that could not execute its check produced no
evidence, and publishing the attempt with a disclaimer is worse than publishing nothing — the
disclaimer reads as hedging and the figure is kept anyway.

## Anti-patterns

| Bad | Good |
|---|---|
| Running phase 1 to decide phase 0 | Mechanical checks first; cheap and unarguable |
| Self-running the dispatched passes | Dispatch, or skip and say it was skipped |
| Attesting your own run | The gate is positional; an author attesting themselves attests nothing |
| Treating phase 0 items as advisory | Every one is a hard fail |
| `ATTESTED WITH` as a soft pass | The caveat goes *into the published artifact*, not just the verdict |
| Softening a check to fit the case in hand | If the new version could be satisfied by better prose alone, it is no longer the check |

## Related

- `mms-evidence` — produces the artifact this gates
- `mms-instrument-check` — prove the instrument fires before its output counts
- `mms-unmeasured-join` — audit the inference between the facts
- `mms-scope-of-search` — what a negative result is a fact about
