---
name: distinguishing-observation
description: Enumerate every mechanism that could produce a symptom, then design the observation that separates them — instead of instrumenting the one mechanism you already suspect. An observation your favourite hypothesis predicts, and the alternatives predict too, costs a debugging cycle and buys nothing. Use when a bug has more than one plausible cause, when you are about to add a log line to confirm a suspicion, when a fix landed and the symptom did not move, when every result so far "is consistent with" the theory you started with, or when the symptom looks impossible given your model of the system. Ranks observations by how much they split the candidate set rather than by how easy they are to collect, requires a per-candidate prediction written before looking, and records survivors as not-yet-distinguished rather than ruled out.
---

# /distinguishing-observation

Given a symptom, the instinct is to instrument the mechanism you already suspect. That produces
evidence consistent with your hypothesis — and equally consistent with three others you never
wrote down.

This is the diagnostic mirror of hypothesis-first validation. There, you fix the hypothesis
before seeing what it will be compared against. Here, you fix the *candidate set* before
choosing what to measure, because the value of an observation is a property of the whole set and
cannot be judged against one member of it.

## The information is in the split

A confirming observation feels like progress and usually is not. If four mechanisms could produce
this symptom and your log line fires under all four, you have learned that the code ran. You
already knew that; the symptom told you.

The observation worth making is the one whose outcome you cannot predict, because the candidates
disagree about it. That is the only kind that costs a cycle and returns a cycle's worth of
information. Debugging that never converges is almost always a sequence of observations each of
which was compatible with everything.

## The discipline

1. **List the candidates before instrumenting.** Three to six mechanisms that could produce this
   symptom. A list of one is not a list, it is a conclusion — and you will spend the next hour
   collecting support for it.

2. **For each pair, write what differs.** Not what you believe about each; what the world would
   look like differently. If two candidates predict identical observations *everywhere*, they are
   not distinguishable by observation at all, and you need either a different pair or a different
   axis — often a level lower, where the two mechanisms stop coinciding.

3. **Rank observations by how much they split the field**, not by how easy they are to collect.
   The best observation halves the candidate set. The worst confirms the favourite. Cheapness is
   worth something, but a cheap observation with no discriminating power is not cheap, it is free
   and worthless.

4. **Predict before you look.** Write down what each candidate predicts for the observation you
   are about to make, then make it. Doing this after the fact is how every result becomes
   consistent with the hypothesis you started with — the prediction is elastic until it is
   written down, and reading the output first sets it.

5. **A candidate that survives is not eliminated.** Say "not distinguished by this observation",
   never "ruled out". The observation constrained what it constrained. This wording is not
   pedantry: when the bug comes back in three weeks, a list of things "ruled out" is a list you
   will not revisit, and the real mechanism is usually on it.

## Pairs that look identical from outside

These shapes recur, and knowing them saves the cycle you would spend rediscovering that your
evidence does not separate them. In each case the fix is to add the separating signal *before*
continuing — which is routinely faster than more reading.

| indistinguishable pair | why the evidence coincides | what separates them |
|---|---|---|
| an error swallowed by a `catch` vs. a code path never reached | both produce no output, no error, and no trace | count entries to the `try`, not exits from the `catch`: entered-and-never-completed is the first, never-entered is the second |
| a cache hit vs. a correct recomputation | the returned value is the same value | poison the entry with a marker only a hit could return, or count invocations of the compute function |
| a retry that succeeded vs. a call that never failed | both end in one success log | log the attempt number, not the outcome — success on attempt 1 and success on attempt 3 are different worlds |
| a timing-dependent bug vs. a state-dependent bug | both reproduce "sometimes" | hold one axis fixed: a fresh process per run under varying load isolates timing; repeated runs in one process isolate accumulated state |
| the wrong value vs. the right value from the wrong source | the assertion fails the same way | print provenance alongside the value — which module, which config, which build |
| a change that had no effect vs. a change that never shipped | the symptom is unmoved either way | verify delivery first (hash, timestamp, a deliberate marker in the artifact); an undelivered treatment reads exactly like a null result |

The last row generalises: **before concluding that a mechanism does not matter, prove the
mechanism was present.** Otherwise "no effect" and "not applied" are the same measurement.

## The anti-pattern: the observation that always fires

The tell is a log line you added, that printed, and that made you feel confirmed. Ask what would
have had to appear instead for you to abandon the hypothesis. If the answer is "nothing" — if
every candidate on your list predicts this exact output — the observation had no capacity to
discriminate and the confidence it produced is manufactured.

This is why step 4 is ordered where it is. A prediction table written first makes an
always-fires observation obvious before you spend the cycle: the column is identical all the way
down, and you go find a different one.

## When the candidate set is empty

Sometimes you enumerate and get nothing: the symptom is impossible given your model of the
system. That is not a dead end, it is the most informative result available, because it means the
model is wrong and you now know it.

Switch the question from "which mechanism did this" to **"what would have to be true for this to
happen at all"**, and enumerate *those*. The answers are usually assumptions you did not know you
were making — the built artifact is not the source you are editing, two copies of the module are
loaded, the process you are reading logs from is not the process serving the request, the
environment differs from the one you configured. Each is checkable, and one of them is the bug.

## Related

- [`flaky-test-detection`](../flaky-test-detection/skill.md) — the timing-vs-state pair applied
  to one domain, where "reproduces sometimes" is the starting symptom rather than a row in a table
- [`falsifiers-first`](../../../pr-workflow/skills/falsifiers-first/skill.md) — the same sealing
  discipline pointed at a change instead of a symptom: fix the hypotheses before seeing what they
  will be compared against
- [`silent-failure`](../../../pr-workflow/skills/silent-failure/skill.md) — supplies the first
  row of the table as a subject in its own right, and asks whether a mechanism announces its own
  failure at all
- [`evidence`](../../../pr-workflow/skills/evidence/skill.md) — the runners that collect the
  chosen observation and attach the prediction made before it
