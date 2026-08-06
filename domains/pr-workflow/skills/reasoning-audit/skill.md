---
name: reasoning-audit
description: >
  Route a reasoning move to the skill that checks it, instead of hoping the right one surfaces.
  Each check fires on the shape of the move rather than on the subject matter: about to report
  something absent, about to trust a count, about to believe an instrument, about to read a diff
  through its own description. Answers the question of which question should be asked, which is a
  different job from proving a claim (evidence) or measuring one (lane-graphs), and applies earlier,
  while reviewing, debugging, or refining a ticket, before there is a claim to prove. Use when a
  review or investigation is about to conclude, when a negative result is about to be published,
  when a number is about to be trusted, or when a green run is about to be read as a pass. Returns
  no-match as a result rather than routing to the nearest-looking check.
maturity: experimental
---

# Reasoning audit

Eleven reasoning skills exist and nothing composes them. Each is individually invocable, which
means each depends on being recalled at the moment it applies, and the moment it applies is
exactly the moment attention is on the subject rather than on the move. This routes instead.

## What this is not

**Not `evidence`.** That orchestrates measurement engines to prove a claim someone has already
made. It is heavy by design, and most of its lanes cost a build. This is cheap and runs before
there is a claim.

**Not `lane-graphs`.** That routes a claim to an executable graph that measures it. This routes a
reasoning move to a check that interrogates it. A lane graph answers "what did the measurement
show". A reasoning audit answers "was that the right thing to measure, and does the result mean
what it appears to".

## When To Use

Reach for this when a piece of reasoning is about to become a conclusion. A review about to be
posted, a negative about to be published, a number about to be trusted, a green run about to be
read as a pass, a bug about to be explained by the first plausible cause.

Do not reach for it to prove a claim. That is `evidence`, and it costs a build. This runs first
and often removes the need.

## Workflow

1. Name the move that is about to happen, in the author's own words. Not the subject, the move.
2. Match it against the router. More than one row may fire.
3. Run each check that fired. They are independent and cheap.
4. Record a result per check, including the ones that came back clean.
5. State what was noticed that no check was looking for.
6. If nothing fired, say so and record the situation. Do not route to the nearest match.

## Router

Fire on the shape of the move, not the subject. The left column is what is about to happen.

| About to | Check | Because |
|---|---|---|
| Report something absent, or publish a 404, an empty result, a quiet run | `scope-of-search` | A negative is a fact about the search, not the thing searched |
| Trust a count, or read one count agreeing with another as corroboration | `selection-audit` | Two counts agree only when their selection rules do |
| Believe a measurement, a probe, a counter, a diff-based check | `instrument-check` | A runner broken in a plausible direction emits well-formed numbers |
| Validate a PR by reading its description first | `falsifiers-first` | The author's wording should not decide which mechanisms get probed |
| Accept error handling, a fallback, a cache, a retry, a guard | `silent-failure` | The question is not "is it correct" but "if it broke, would we know" |
| Offer a suite as evidence that a mechanism is guarded | `coverage-partition` | Suite power is a distribution, not a boolean |
| Join two datasets on a key and compare | `unmeasured-join` | The join is an assumption until its overlap is measured |
| Explain a symptom with one plausible cause | `distinguishing-observation` | An observation every candidate predicts costs a cycle and buys nothing |
| Debug something that reproduces but is invisible | `observability-gap` | Absent signal and suppressed signal are different problems |
| Merge a refactor whose description says behaviour is preserved | `unintended-breakage` | Effects outside the intended scope are the ones nobody looked for |
| Ship a fix claiming it addresses a reported bug | `red-on-base` | A test that fails on base for the wrong reason proves nothing |

More than one row can fire. Run each that applies. They are cheap and they are not mutually
exclusive.

## No-match is a result

If no row fires, say so and stop. Do not route to the nearest-looking check. A router that always
matches has stopped discriminating, and a reasoning check applied to a move it was not written for
produces confident output about the wrong thing.

Record the no-match. A situation that repeatedly finds no check is where the next reasoning skill
comes from.

## The unrouted read

The router only sees moves someone anticipated. After running whatever fired, state plainly what
was noticed that no check was looking for. That paragraph is the part no table can generate, and
it is the reason this is an audit rather than a lookup.

## Output

Emit a result per check, not prose. Each carries the move that triggered it, the check that ran,
and what it found, so a reader can tell a check that ran clean from a check that never ran.

```
move:      published "no occurrences of X"
check:     scope-of-search
found:     pattern was `X\b`, cannot match XSomething; positive control not run
```

A check with no such record did not run. Silence is not a pass, which is the whole premise of
half the skills in the table.

## Cost

Every check here is reading and reasoning. None requires a build, a run, or a network call. The
expensive thing in this domain is `evidence`, and this is deliberately the layer above it: most
findings that would have triggered an expensive validation get resolved, or dismissed, by one of
these first.
