---
name: debug
description: Locate the cause of a symptom you cannot yet explain — a crash, a leak, a flake, a production error spike, a number that moved. The sibling of evidence: where evidence is handed a claim and looks for the observation that would falsify it, this is handed a symptom and must generate the hypothesis first, then kill it. Classifies the symptom into a defect class, routes to the engine skill that owns that class (memory-leak, race-condition-repro, react-render-proof, sentry-grafana-correlation, extension-errors-debugging, tsc-blindspots, supply-chain-audit), and holds the investigation to the same evidence bar evidence applies — an instrument that cannot fail is not evidence, a null needs its sensitivity stated, and a finding is scoped to what the change introduced versus what pre-existed. Stops when the cause is located or the class is excluded, not when a plausible story is available. Triggers on /debug, or when asked to debug, diagnose, or investigate a symptom, find why something is slow, leaking, flaky, or erroring, chase a production alert to its cause, or reproduce a bug that cannot be reproduced by hand.
maturity: experimental
---

# /debug

`evidence` is given a claim and looks for the observation that would prove it false.
This is given a **symptom** and has to produce the hypothesis before anything can falsify it.

That difference is the whole skill. In review, the claim is someone else's and the social
pressure runs toward scepticism. In debugging, the hypothesis is *yours*, nobody else is
positioned to challenge it, and the expensive failure is building three hours of work on the
first theory that fit the first observation.

## When To Use

- A symptom with no established cause: a crash, a hang, a leak, an intermittent test, an
  error-rate step change, a metric that moved without a deploy that explains it.
- A bug you cannot reproduce by hand and therefore cannot yet observe.
- A production signal that needs chasing back to code.

## Do Not Use When

- The PR states a claim and you need it settled — that is `/evidence`.
- The cause is known and you are validating the fix — that is `/evidence`, or the engine
  skill directly.
- You want an after-the-fact writeup of a resolved failure — that is a postmortem, not this.

## Workflow

1. **State the symptom as an observation, not a theory.** "Popup memory grows ~105 MB per
   open/close cycle" — not "the popup leaks because of the snow hook". The theory is the
   output, never the input.
2. **Classify into a defect class** (table below). If two classes fit, run both; do not pick
   the one you find more interesting.
3. **Delegate to the engine.** Each owns its own method and its own falsifier. This skill
   routes and holds the bar; it does not re-implement the investigation.
4. **Kill the hypothesis before extending it.** Name the observation that would rule it out,
   and go looking for that observation specifically. A hypothesis that has only ever been
   confirmed has not been tested.
5. **Stop on a located cause or an excluded class.** A plausible story is not a stop condition.

## Symptom → engine

| Symptom | Class | Engine |
|---|---|---|
| Memory grows across a repeated flow; tab or worker dies over time | retention | `memory-leak` |
| Intermittent failure; passes on rerun; order-dependent | interleaving | `race-condition-repro` |
| UI janks, re-renders excessively, selector recomputes | wasted render work | `react-render-proof` |
| Production error spike, latency change, or a metric that moved | production signal | `sentry-grafana-correlation` |
| Extension-specific: MV3 vs MV2, background vs UI context, service-worker lifecycle | platform | `extension-errors-debugging` |
| Runtime value disagrees with its declared type; green typecheck, wrong behaviour | type/reality drift | `tsc-blindspots` |
| Started after a dependency change; new capability or transitive edge | supply chain | `supply-chain-audit` |
| None of the above, or several | — | bisect to a change first, then re-classify |

## The evidence bar carries over

The engines are shared with `evidence`, and so are its trust gates. They matter more here,
because in review a weak instrument produces a weak claim someone else will challenge — in
debugging it produces a wrong theory nobody checks.

- **An instrument that cannot fail is not evidence.** Before trusting a measurement, establish
  it can report the negative: a positive control that must move, a base arm that must fail.
- **A null needs its sensitivity stated.** "No difference" and "could not have detected one"
  print identically. Calibrate, then report the zero against what the instrument demonstrably
  resolves.
- **Scope to the change.** Classify each finding as introduced-here versus pre-existing.
  Report pre-existing separately and uncharged, or you will attribute an old defect to a new
  diff.
- **A negative result carries the scope of its search.** "No leak found", "nothing in the logs",
  "the artifact does not exist" are claims about where you looked. Name the stores searched in the
  finding itself — filesystem, artifact bucket, issue tracker, the other process's logs. If you
  cannot name them, the search is not finished.
- **Measure on an isolated machine.** Timing- and GC-sensitive numbers taken on a contended host
  are not noisy-but-usable, they are *stably wrong* — several runs will agree with each other and
  disagree with reality. Replicate across hosts, not just across runs, before trusting a figure.
- **Collect the whole battery, not the discriminating member.** Instruments that stay flat are
  data: the joint pattern localises the defect in a way no single reading does.

## Output

A short investigation record, not a narrative:

```
SYMPTOM    observation, as measured
CLASS      defect class, and why (with the classes considered and dropped)
HYPOTHESES each with the observation that would kill it, and whether that was found
CAUSE      located mechanism, at file:line — or "class excluded", which is a real result
NOT CAUSE  hypotheses killed, kept so the next person does not re-walk them
```

Killed hypotheses are part of the deliverable. Deleting them makes the surviving one look
inevitable and hands the next investigator the same dead ends.

## Scope — what this is NOT

- Not a fix. It locates and evidences the cause; the change is a separate act.
- Not a replacement for the engines. Each owns its method; this chooses among them.
- Not an incident-management process. No severity, comms, or timeline.
