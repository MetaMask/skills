# Principles

Eighteen rules the rest of this skill implements. When a situation isn't covered by a
specific instruction, decide by these.

## What you may claim

- **Falsifiability** — name the observation that would disprove the claim, then go looking
  for it. A review that cannot fail is not a review.
- **Diff-anchored** — the claim is what the code *can* do, not what the PR body promises.
  Drift between them is a finding, not a claim.
- **Surface-specific, and a surface need not be a screen** — a job graph, a build artifact,
  a policy file, or a telemetry shape are all legitimate surfaces with their own falsifiers.
  Routing a CI or build claim through a product effect is the wrong bar, not a stricter one.

## What counts as evidence

- **Demonstrate, don't claim** — a verdict shows the objective met with an inspectable
  artifact. Prose asserting it is a vacuous pass; report ⚠️ inconclusive instead.
- **In situ** — present output on the tool's own surface: the run page, the Discover view,
  the trace waterfall, the console. Retyping output into the report launders evidence into
  claim. Verbatim text is better than a hand-built table and still proves nothing about
  provenance — and a transcription is a place to be selective without noticing you are
  being selective. Check what a harness *imports*: a harness that re-implements the code
  under test evidences only itself, however it is presented.
- **Reproducibility of assertions** — the bar is not that the reader *can* re-run it (a
  working link is the floor) but that they *needn't*: the exhibit is complete enough — the
  numbers, the window, the method, the control — that reading it makes the result
  near-certain. The re-issuable link/query is a backstop for the skeptic, offered second,
  never the headline.

## Why believe it

- **No vacuous passes** — green is not proof. Assert non-empty artifacts; ask whether the
  assertion *could* have failed, and whether the test exercises the changed code.
- **Check the instrument, not just the result** — measurement design can manufacture a
  finding. Verify the treatment is actually delivered in each arm before interpreting a delta.
- **Removing a bias is not establishing validity** — correcting a flaw you found licenses
  only that correction. A trust gate names how the evidence could *still* be vacuous; if the
  sentence describes work you did rather than risk that remains, it is not a gate. List what
  stays uncontrolled — an unenumerated confound reads as a nonexistent one.
- **A null states its power** — when run-to-run spread exceeds the effect under test, report
  *not resolvable at this n* and name the smallest detectable effect. An underpowered run and
  a true null print the same word; reporting the word alone lets the reader infer the
  stronger claim.
- **Premises are claims** — probe the *because* ("unavailable", "access-limited", "can't be
  done here") as hard as the verdict. A false premise silently justifies the wrong method,
  and a probe that *agrees* with a premise deserves more suspicion than one that contradicts
  it — confirm the probe targeted the right thing.
- **Recompute stated counts** against the source before publishing. A number that was true of
  an earlier draft's scope is the commonest stale fact.

## When to stop

- **Stop at the falsifier** — match the bar to the claim's risk. Evidence past the closed
  falsifier is noise.
- **Defer to CI** where CI already covers it, unless that coverage is itself the point.
- **State what was not covered** — steps that could not be automated are recorded as open,
  with the reason. A report listing only successes reads the same as one where nothing was
  checked.

## How it is handled

- **Refutation is a successful validation** — report it, localize it, hand back the repro.
  Don't fix, and don't publish a failure to someone else's PR unprompted.
- **Publish surface follows ownership** — the PR body when you authored it; a comment when
  validating someone else's.
- **Scrub before publishing, confirm before any public write** — local paths and usernames
  leak through failure summaries, and one PR's approval does not carry to the next.
- **Isolate concurrent runs** — colliding debug ports, artifact dirs, or upload paths
  cross-contaminate evidence *silently*. That is an integrity failure, not flakiness.
