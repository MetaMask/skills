---
name: instrument-check
description: Prove the instrument works before its output counts as evidence — plant a defect it should catch (positive control), and run it where nothing is wrong (negative control). A runner broken in a plausible direction emits well-formed numbers, and well-formed numbers get published. Encodes the standing rule that an instrument reports the effect it had, never the instruction it was given: the change that landed is read back off disk and published beside the change that was requested, so the two are capable of disagreeing. Use before trusting a mutation runner, a counter, a grep- or diff-based check, an A/B harness, or any probe whose green result would be indistinguishable from having measured nothing.
---

# /instrument-check

A measurement is not evidence. A measurement from an instrument that has been shown to work is
evidence. The gap between those two sentences is where published wrong answers come from.

The failure is not that instruments break loudly. A broken instrument that throws gets fixed in
the same minute. The dangerous one is **broken in a plausible direction**: it still runs, still
emits a number of the right shape, still satisfies every guard around it, and the number is
wrong. Nothing downstream can tell, because nothing downstream ever sees the instrument — only
its output.

## What this looks like when it happens

A mutation runner applied its one-line replacement through `awk -v r="$REPLACE"`. `awk`
escape-processes a `-v` assignment before the program ever sees it, so a replacement of
`/^[\s\S]{1,4096}$/u` was written to the file as `/^[sS]{1,4096}$/u`. The `\s` and `\S` were
eaten. A pattern intended to be **widened** to accept anything was **narrowed** to accept a
string of `s` and `S` characters.

Then read what the run reported, and how each layer of protection cooperated:

- The suite went red — but on a **different test** than the mutation targeted, because the
  probe had landed on a mechanism nobody was studying.
- Arm B ran the **same test count** as arm A, so the arms-differ guard was satisfied.
- The file changed on disk, so the mutation-applied guard was satisfied.
- The runner emitted `falsifying` for a mechanism it had never touched.
- The artifact's `mutation applied` field echoed the **requested** text. The requested and the
  applied could not disagree, because they were the same string printed twice.

Every guard was a real check, honestly implemented. Collectively they described a run that never
happened. Nothing in the system was in a position to notice, and the defect had been there since
the first commit; it was found weeks later, by accident.

A second one from the same session, cheaper and just as total: a probe file was copied into a
target tree at a path where none of its imports resolved. The suite failed to load. The run
reported **success** and produced an artifact that measured nothing at all.

## Two controls, both required

Before a measurement counts, the instrument passes both. One without the other is half a check,
and the halves catch opposite defects.

**Positive control — plant a defect the instrument should detect.** Break something on purpose,
in a way you are certain about, and confirm the instrument fires. If it stays quiet, it is not
measuring what you think it is measuring, and every clean result it has ever produced is a clean
result about nothing.

**Negative control — run it where nothing is wrong.** An empty range, an untouched tree, a
fixture with a known-good answer. If it fires anyway, every positive result is suspect, because
you now know the instrument can produce a finding without a cause.

The positive control catches an instrument that is deaf. The negative catches one that is
hallucinating. The awk defect was, precisely, an instrument that was deaf and hallucinating at
once — it did not do what it was asked, and it reported a finding regardless.

## The standing rule

> An instrument reports the effect it had, never the instruction it was given.

Wherever a runner takes an input and performs an action, the artifact carries **what happened**,
not what was asked. The mutation artifact publishes the line read back off disk after the write,
alongside the line that was requested. Two fields, from two sources, and the entire value is
that they are **capable of disagreeing**. A field that echoes its own input is decoration; it
can only ever confirm that the program remembers what it was told.

The second fix from the same session generalises the same way: the caller now states **which
test names should fail**. The instrument no longer gets to interpret any red as its red. A probe
that fires somewhere unintended becomes its own outcome — reported as a probe that missed —
rather than silently passing as a falsification. An instrument that cannot say "I hit the wrong
thing" will never say it.

Both fixes are one move: give the instrument a way to contradict its own operator.

## What a control looks like, by instrument

| instrument | positive control | negative control |
|---|---|---|
| **mutation runner** | mutate something with an obvious, named guard — an assertion with a dedicated test. Does *that* test fail? If not, the write is not reaching the file the suite loads | apply an identity mutation, or none. Suite must be green and the arms identical |
| **counter** | count a fixture whose answer you counted by hand. Off-by-one and double-count both show here and nowhere else | count an empty input. A counter that returns anything but zero is measuring its own scaffolding |
| **grep-based check** | search for a string you know is present. A pattern that cannot match *anything* returns clean, which is character-for-character the output of a clean tree | search for a string you know is absent. A pattern that matches everything reads as a wall of findings nobody triages |
| **diff-based check** | run it across a commit you know introduces the thing. Silence means the range, the filter, or the parser is wrong | run it on an empty range — a commit against itself. Any finding at all is manufactured |
| **A/B harness** | make the arms differ in a way that must move the metric. If the arms report the same number, the treatment is not reaching the built artifact | run A against A. A non-zero delta is the harness's noise floor, and it bounds every result you will publish |

Where an instrument copies files, executes in another tree, or shells out, add one more: **prove
the target actually ran.** Load failures, missing imports, and empty test selections all exit
in ways that look like a fast, clean pass. Assert a non-zero test count from the run's own
output, not from the count you intended to run.

## The failure mode this skill exists to prevent

**Controls that were run once, at build time, and never again.**

This is the one that gets everybody, because it feels like diligence. The instrument was
validated. There is a commit that proves it. That commit validated a *different instrument* —
one composed of the shell quoting, file paths, environment, working directory, and dependency
versions of that day.

A control is standing procedure, not a milestone. Run it in the same invocation that produces
the measurement, through the same code path, with the same plumbing, so its result and the
measurement's result share a fate. Cheap enough to run every time is a design requirement of the
control, not a nice property; a control too expensive to run per-measurement will quietly become
a control that ran once.

The awk defect passed review. It shipped. It ran for weeks producing artifacts that read as
rigorous. The number of runs it corrupted is unknown, and the honest report of that period is
not "the findings were wrong" but **"the findings were not measurements"** — which is worse,
because it cannot be corrected, only discarded and redone.

## Related

- [`falsifiers-first`](../falsifiers-first/skill.md) — supplies the probes this skill validates;
  its predictions ("which test should fail, by name") are exactly the field that lets a probe
  report having hit the wrong thing
- [`silent-failure`](../silent-failure/skill.md) — the same question aimed at the system under
  test rather than at the tooling; its last three shapes are instrument defects, and this is
  where they get run down
- [`unintended-breakage`](../unintended-breakage/skill.md) — depends on this one, since a scan
  that cannot find breakage and a change that broke nothing produce identical output
- [`evidence`](../evidence/skill.md) — the runners that carry the requested-vs-applied fields,
  and the gate that should refuse an artifact with no control attached
