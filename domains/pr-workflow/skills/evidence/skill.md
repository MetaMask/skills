---
name: evidence
description: Produce reviewer-grade evidence that a claim is true — or that it is not. Matches the evidence to the specific falsifiable claim rather than running a fixed checklist, across a catalog of 41 lanes: before/after screenshots, falsifying regression tests, render and selector proofs, bundle and LavaMoat diffs, Sentry and Tempo links, state-migration and vault checks, plus the Autonomous Engineering Platform (AEP) harness for autonomous visual and perf capture. Assembles an evidence bundle and publishes it, images re-hosted and local paths scrubbed. Runs three ways: on a PR whose claim someone else made, in the inner loop against uncommitted changes before a reviewer sees them, and on a symptom with no claim yet, where the hypothesis to kill is your own. Triggers on the evidence command and its subcommands (visual, perf, preflight, status, plan, lane, compare) — installed as mms-evidence — or when the user mentions validating or proving a PR, capturing evidence, before/after screenshots, a screen recording for a PR, attaching Sentry or DevTools output as proof, AEP or visual/perf validation, or publishing an evidence bundle.
---

# /evidence

Prove a PR does what it claims with **objective, reviewer-grade evidence**. The primary engine is the **Autonomous Engineering Platform (AEP)** harness run locally — `visual_validation` for visible UI behavior, `perf_validation` for non-visible perf behavior — augmented by whatever complementary evidence the claim demands (Sentry query links, screenshots, screen recordings, DevTools/CDP output, bundle/web-vitals/test results).

This skill **executes**: it brings up the local stack, runs the harness, captures artifacts, assembles the bundle, and — **only with confirmation** — publishes to the public PR body. The platform decides what passes; the model does not declare victory. See the AEP creed: *"Tests prove the code compiles. Screenshots prove the user actually sees the fix."*

> **Hard rule — demonstrate, don't claim.** Every verdict must *demonstrate that the **ticket objective** is achieved* with an inspectable artifact (link / screenshot / screen recording / run / Sentry query / CDP capture) — never explain or claim in prose that it is achieved. Anchor to the linked issue's objective, not just the PR body's self-description. An unbacked "objective achieved" narrative is a vacuous pass → report **⚠️ inconclusive** and name what's missing; never upgrade prose to **✅ proven**.

## Principles

Twenty rules the rest of this skill implements. When a situation isn't covered below, decide by these.

**What you may claim**
- **Falsifiability** — name the observation that would disprove the claim, then go looking for it. A review that cannot fail is not a review.
- **Falsifier coverage is not exhaustive — human intervention point.** There is no fixed checklist, so there is no completeness guarantee: the falsifiers found are bounded by claim-extraction quality and by what the reviewer thought to test. "Nothing turned up" is not "there is nothing to find." A human judges whether the falsifier chosen matches the claim's actual risk, and whether a mixed or high-stakes claim needed more than one — this skill closes the falsifiers it finds, it does not attest that it found all of them.
- **Diff-anchored** — the claim is what the code *can* do, not what the PR body promises. Drift between them is a finding, not a claim.
- **Surface-specific, and a surface need not be a screen** — a job graph, a build artifact, a policy file, or a telemetry shape are all legitimate surfaces with their own falsifiers.

**What counts as evidence**
- **Demonstrate, don't claim** — a verdict shows the objective met with an inspectable artifact. Prose asserting it is a vacuous pass.
- **In situ** — present output on the tool's own surface (the run page, the Discover view, the trace waterfall, the console). Retyping output into the report launders evidence into claim: verbatim text proves nothing about provenance, and a transcription is a place to be selective without noticing you are being selective.
- **Reproducibility of assertions** — the bar is not that the reader *can* re-run it (a working link is the floor) but that they *needn't*: the exhibit is complete enough — the numbers, the window, the method, the control — that reading it makes the result near-certain. The re-issuable link/query is a backstop for the skeptic, offered second, never the headline.

**Why believe it**
- **No vacuous passes** — green is not proof. Assert non-empty artifacts; ask whether the assertion *could* have failed and whether the test exercises the changed code.
- **Check the instrument, not just the result** — measurement design can manufacture a finding. Verify the treatment is actually delivered in each arm before interpreting any delta.
- **Removing a bias is not establishing validity** — correcting a flaw you found licenses only that correction. A trust gate names how the evidence could *still* be vacuous; if the sentence describes work you did rather than risk that remains, it is not a gate.
- **A null states its power** — when the spread exceeds the effect under test, report *not resolvable at this n* and name the smallest detectable effect. Never let it read as "no effect".
- **Premises are claims** — probe the *because* ("unavailable", "access-limited", "can't be done here") as hard as the verdict. A false premise silently justifies the wrong method, and "unavailable" is the highest-suspicion premise because it licenses weaker evidence.
- **Recompute stated counts** against the source before publishing. A number true of an earlier draft's scope is the commonest stale fact.

**When to stop**
- **Stop at the falsifier** — match the bar to the claim's risk; evidence past the closed falsifier is noise.
- **Defer to CI** where CI already covers it, unless the coverage is itself the point.
- **State what was not covered** — steps that could not be automated are recorded as open, with the reason. A report listing only successes reads the same as one where nothing was checked.

**How it is handled**
- **Refutation is a successful validation** — report it, localize it, hand back the repro. Don't fix, and don't publish a failure to someone else's PR unprompted.
- **Publish surface follows ownership** — the PR body when you authored it; a comment when validating someone else's.
- **Scrub before publishing, confirm before any public write** — local paths and usernames leak through failure summaries; one PR's approval does not carry to the next.
- **Isolate concurrent runs** — colliding ports, artifact dirs, or upload paths cross-contaminate evidence *silently*. That is an integrity failure, not flakiness.

## The core move: match evidence to the claim

A PR makes a **falsifiable claim** ("privacy mode now hides the Perps balance"; "hovering the asset row preloads the chart with no double-fetch"; "this cuts startup http.client time"). Validation = pick the evidence that would **falsify that claim if it were false**, then run it. Do not run a fixed checklist.

**Step 1 — extract the claim.** Read the PR (`gh pr view`, `gh pr diff`) *and the linked issue*, then write a **Claim Card** — the linchpin; every lane is only as good as the claim. Full rubric, anti-patterns, and special cases (refactor/no-op, bug-fix, perf, migration, flag-gated): **[references/claim-extraction.md](references/claim-extraction.md).**

```
Claim:     Given <precondition>, when <action>, then <observable>.
Surface:   <screen / API / metric>  (reachable? seed / flag / fallback: …)
Type:      <visible | perf | telemetry | state | build | behavior>  → lanes <…>
Falsifier: <observation that would disprove the claim>
Baseline:  <base ref | fails-on-main test | before-window>
```

A claim must be falsifiable, surface-specific, **anchored to the diff** (if the body promises X but the diff can't deliver it, flag the drift — that's a finding, not a claim), bounded, and quantified where it's a perf claim. Decompose a mixed PR into one card per claim.

**Step 2 — match each claim to lanes** from the [evidence catalog](references/evidence-catalog.md):

| Claim shape | Primary lane | Complementary |
|---|---|---|
| Visible UI change (layout, copy, show/hide, theme) | **A1 `visual_validation`** / B1 mm-CLI — before/after screenshots | recording→GIF for motion; B5 a11y |
| A bug fix (any kind) | **⭐ B3 falsifying test** — fails on `main`, passes on the branch | A1/B1 if visible; E1 if it errored |
| Non-visible perf (preload, no-double-fetch, lazy-load, chunk) | **A2 `perf_validation`** — falsifiable assertions | C6 CDP netlog, D2 chunk membership |
| Render / over-render | **C4 WDYR + `devtools:react`** | C1 startup traces |
| Interaction responsiveness / startup timing | **C2 INP · C3 TBT · C5 benchmark (paired A/B)** | C1 phase traces, C6 profile |
| Telemetry / error-rate / latency in prod | **E1 Sentry links** (before/after) | E2 Tempo; span-volume → `/sentry-quota` |
| Bundle / build output | **D1 size · D2 chunk membership** | — |
| A dependency change is safe | **D3 LavaMoat policy + D4 manifest diff** | D1 size |
| Persisted-state change | **⭐ F1 migration** (`changedKeys`, old→new state) | F2 vault round-trip |
| Tx / dapp / flag / snap / i18n behavior | **F3 sim · F4 provider · F5 flag matrix · F6 snaps · F7 i18n** | B2 e2e trace |
| Behavior with no UI | **B3 test + G4 repro** | G1 CI checks |
| Mechanical migration / "rename-only" refactor; a hand-written type/schema/constant/policy that restates a source | **⭐ D6 substitution A/B** at a fixed head (`compare` arm kind `substitution`) | B3 if behavior-visible; D1 for accidental output change |

Lane IDs (A1, B3, …) index [references/evidence-catalog.md](references/evidence-catalog.md) — the full menu with verified capture commands and the complete matching guide. When a PR mixes claims (a UI fix that also shifts a metric), run more than one lane and assemble them into one bundle.

## When to use

- **Prove a PR** before requesting review or merge — produce the before/after a reviewer expects.
- **Re-validate** after a force-push or a requested change.
- **Back a perf/telemetry claim** with numbers and links, not prose.
- **Assemble + publish** an evidence bundle from a run you already have (`evidence` subcommand).

Not for code-correctness review (use `/review`, `/code-review`) or span-quota review (use `/sentry-quota`). This skill proves *behavior*, not code quality.

## Subcommands

| Invocation | Behavior |
|---|---|
| `/evidence <pr>` | **Flagship.** Read the PR → state the claim → pick lanes → [preflight](references/aep-local-run.md) → run AEP lane(s) + gather complementary evidence → assemble bundle → **propose** the PR-body section and confirm before publishing. |
| `/evidence plan <pr>` | Dry run: read the PR, state the claim, recommend lanes + targeting hints. No stack, no run. Cheap first step when unsure. |
| `/evidence visual <pr>` | AEP `visual_validation` only. |
| `/evidence perf <pr>` | AEP `perf_validation` only (local/uncommitted graph — see [caveat](#perf_validation-caveat)). |
| `/evidence preflight` | Health-check the local stack; bring up what's down. No run. |
| `/evidence status <run-id>` | Poll `GET /v1/runs/:id`; print stage timeline + `evidenceBundle.artifactRefs`. |
| `/evidence evidence <pr> [--run <id>]` | Assemble + publish a bundle from an existing run and/or complementary sources (Sentry/screens/devtools). No new AEP run. |
| `/evidence lane <id> <pr>` | Run a single [catalog](references/evidence-catalog.md) lane by id (e.g. `lane F1`, `lane C3`, `lane D3`) — for the non-AEP lanes where you know the claim type. |
| `/evidence compare <pr>` | Paired A/B for a perf or refactor claim. Two arm kinds — pick by what the claim varies: **`ref`** (default) builds base + head, captures the lane on both, diffs; avoids the stale-baseline trap (catalog C5). **`substitution`** holds a **fixed head** and varies one *artifact* instead of the ref — replace the PR's hand-written type/schema/constant/policy with the authoritative equivalent and diff a checker's output (catalog D6); no build, no rebase, no merge boundary. **Per-arm checks first, one per kind:** for `ref`, verify the mechanism under test is actually active in each arm (chunk split present, span emitted, flag evaluated) — a null arm without delivered treatment is a no-op, not a control (2026-07-22, #42795 bisect lesson). For `substitution`, verify the unmodified arm is **silent** and that each diagnostic fires for the reason claimed — a noisy Arm A destroys attribution, and a diagnostic tripping one property early scores as a confirmation it isn't (trustworthiness gate item 19; 2026-07-30, #44397). |

`<pr>` is a number or URL on `MetaMask/metamask-extension` unless another repo is given. Every variant runs Step 1 (extract the Claim Card) first — the claim decides the lane, even when you named one.

## Running AEP

The hosted instance is dead; everything runs locally. Bring-up, submit/poll/fetch, and
teardown are in **[references/aep-local-run.md](references/aep-local-run.md)** — read it
once you have decided an AEP run is warranted, not before.

It is the heaviest lane here: the full stack plus autonomous-agent tokens. Weigh that
against a lighter lane that closes the same falsifier (see [Sufficiency](#sufficiency--how-much-is-enough)),
and **tear the stack down on every exit path** — pass, refutation, or abort.

## Complementary evidence

AEP is primary but rarely sufficient alone. Pull whatever the claim needs — **and proactively suggest evidence the PR author likely didn't think of**. The catalog is grouped into 7 families; full menu with verified capture commands and "what it proves": **[references/evidence-catalog.md](references/evidence-catalog.md).** Families:

- **A. AEP** — `visual_validation` / `perf_validation` / bundle byproducts (primary autonomous engine).
- **B. Behavior & flow** — mm-CLI visual, E2E trace+video, **⭐ falsifying regression test** (fails on main, passes on branch — the strongest bug proof), Storybook/component, a11y, flaky-stability rerun.
- **C. Performance & render** — startup/custom traces, web-vitals (**INP/FCP/LCP/CLS** via `stateHooks`), long-task **TBT** (separate observer), React render/selector (WDYR), benchmark A/B (paired), DevTools/CDP profiling, memory-over-flow, **same-window app+DevTools capture** (C8 — UI + console evidence in one frame, OS-level region recording).
- **D. Build output** — bundle-size, chunk membership, **LavaMoat policy diff**, manifest permissions diff, build-variant matrix.
- **E. Production telemetry** — Sentry links (span-volume → `/sentry-quota`), Tempo traces, error-event shape.
- **F. Extension integrity** — **⭐ state migration**, vault/keyring, tx simulation, provider/dapp, feature-flag matrix, snaps, i18n.
- **G. CI/review/process** — check links, coverage delta, reviewer bot, manual repro.

Screen recordings (motion a still can't prove): `mm` + a Playwright `recordVideo` preload → `ffmpeg` two-pass palette GIF (webm/mp4 don't render inline). See [references/evidence-publishing.md](references/evidence-publishing.md).

## Sufficiency — how much is enough

Match the bar to the claim; stop when the claim's falsifier is closed. Don't over-instrument a copy fix; don't under-prove a high-stakes claim.

- **One lead lane that closes the falsifier** is enough for low-risk, single-claim PRs (a copy fix → one screenshot; a bug fix → the falsifying test).
- **Weigh AEP's cost before reaching for it.** A `visual_validation`/`perf_validation` run spins the full stack *and* burns autonomous-agent tokens — by far the most expensive lane. Use it when the claim genuinely needs autonomous capture of a reachable surface; when a lighter lane closes the same falsifier (a single `mm` screenshot, a falsifying test, a CDP capture, an artifact CI already produced), prefer it and skip the stack. Whenever you do start it, tear it down after (see [references/aep-local-run.md](references/aep-local-run.md)).
- **Lead + one corroborator** for perf/telemetry (a number *and* its source) and for anything user-facing that also moves a metric. **For a perf-targeting PR the lead lane is the measured impact itself** — a paired A/B benchmark at the current head (C5) or equivalent — never mechanism evidence alone (chunk membership, netlog exclusion prove the improvement is *possible*, not that it *happened*). A perf PR also always carries correctness + non-regression lanes: changed-surface tests green at head, affected flows exercised, neutral profile within noise. (2026-07-22, #42795 lesson.)
- **Lead + integrity lane** for high-stakes surfaces regardless of size: persisted-state (migration + vault), money (tx simulation), permissions (LavaMoat + manifest), security/keyring. Size-S doesn't lower the bar here.
- **Per-claim** for mixed PRs — each Claim Card needs its own closed falsifier; a strong UI proof doesn't cover the metric it also shifts.
- **Rely on CI for routine coverage — don't re-collect what CI already establishes.** Lint, build, typecheck, the full test suite, changelog validation: CI is the authoritative source; **cite the check result** (e.g. "423 pass / 0 fail at head") instead of re-running it locally. Spend independent evidence only on (a) the claim's load-bearing falsifier, (b) specifically important/noteworthy areas (security, money, permissions, the exact changed surface), or (c) where the trust-gate warns a green result could be vacuous/misattributed. This is the economy counterpart to *"don't trust green blindly"*: that gate polices the **claim-critical** lane; this rule spares the **routine** coverage — re-collecting what CI covers is bundle noise. (#9628: cited CI's pass matrix for build/test, ran independent evidence only for the load-bearing homogeneity + resolution lanes.)

Stop when each claim has one trustworthy artifact that would have shown its falsifier. More evidence past that is noise.

## Publishing the evidence bundle

**Public, outward-facing — always confirm the rendered section with the user before writing
a PR body.**

### Non-negotiables — these are here, not in a reference, because a requirement you have to fetch is advisory

**1. Ship an artifact the reader can check without trusting you.** Terminal text you pasted is
indistinguishable from terminal text you invented; it carries the weight of your assertion, not
of a measurement. Running the check justifies *your* belief. It becomes *evidence* only when the
reader can confirm it independently: a committed test CI executes, a link to a run, a capture with
visual provenance, an artifact at a URL. **If every character of the output is one you typed, you
have published an assertion.**

**2. `proven` requires execution; reading yields `unverified`.** Reading a test establishes its
shape, never its power. A test is evidence when it *fails* on the base arm — so run arm B, including
against your own probe. A probe that passes with the mechanism deleted is measuring something else.

**3. There is no "what would close it" section.** If you know what would close the falsifier, close
it. Three legal endings: proven with artifact attached · unproven, stated flatly and nothing
prescribed · an open question that is genuinely a human's product decision. Imperative-mood prose
(*run*, *switch*, *assert*) means the artifact does not exist.

**4. Write to the reviewer who arrives, not whoever commissioned the run.** They have a stake in
this PR and none in your tooling. Cut calibration rationale, prior hypotheses, and corrections to
drafts they never saw. One line of disclosure that the output is automated and needs no action is
for them; everything explaining why you are running this is not.

**5. Delete findings whose entire content is test quality** — code correct, test weak — unless the
untested path touches funds, keys, persisted state, user-visible wrongness, or silent corruption.

**6. Privacy and security findings are routed, never published here.** File them in the private
planning tracker. Subject matter triggers this, not severity: the code cannot distinguish a missing
gate from a deliberate one.

**7. Measure the pull request, which is a range, not a commit.** `$SHA^..$SHA` is one commit's
diff. On a twenty-six-commit branch it is a twenty-sixth of the change, and it looks exactly like a
finished measurement — same runner, same green run, same artifact. Take the head from
`.head.sha` and the base from `merge_base_commit.sha` on the compare endpoint, and say the range in
the comment so a reader can see what was covered. `.base.sha` is the base branch's tip, which moves
under you and is not where the branch left.

**8. The label on a number is part of the number.** A runner reads a field out of a line its probe
printed; it knows the field's name and not what was counted. When a probe for a claim about value
identity counts distinct values, publishing that under a fixed heading of "renders" ships a correct
measurement of the wrong quantity, and every check passes. Whatever names the number is caller-
stated, like the verdict — and the comment points at the probe, which is the definition.

**9. An instrument reports what it did, never what it was asked to do.** A mutation runner that
echoes its `--replace` argument into the artifact cannot detect its own misfire, because the two
are the same string by construction. They came apart once: `awk -v r="$REPLACE"` escape-processes
the assignment, so a replacement of `/^[\s\S]{1,4096}$/u` was written to the file as
`/^[sS]{1,4096}$/u` — narrowing the regex it was meant to widen. Arm B ran the same test count as
arm A, so every guard was satisfied, a different test failed than the one targeted, and the run
reported the suite as having power over a mechanism it never touched. Read the mutated line back
off disk and publish that; keep the requested text beside it. The rule generalises past mutation:
wherever a runner takes an instruction and performs an effect, the artifact carries the effect.

### The claim is scoped to what the run could see

A run measures a diff, a file, a probe. What sits behind an interface it calls is not in the
measurement, and a comment that speaks past that boundary is asserting rather than reporting.

The instrumentation lanes make this concrete: a diff can show that a span is created and that a
flag gates it, and cannot show how often the surrounding package invokes the callback. That is not
a gap to apologise for — it is the finding. *"Cost scales with a call frequency decided in another
package, so nothing here bounds it"* is a real conclusion, and the reviewer is the person who knows
the number.

Say where the edge is, in the comment, in the reviewer's terms.

### The runner, not the recipe

`scripts/falsify-probe.sh` proves a test is falsifying by mutation rather than by reading, and
**writes the artifact itself** — the operator never transcribes output:

```bash
scripts/falsify-probe.sh \
  --test ui/hooks/perps/coalesceBackgroundRequest.test.ts \
  --source ui/hooks/perps/coalesceBackgroundRequest.ts \
  --line 54 --replace '  const existing = undefined as Promise<TResult> | undefined;'
```

Runs arm A, mutates one line, runs arm B, restores the source, and emits
`evidence-artifacts/falsify-<label>.{json,md}` plus both raw logs. **The exit code is the
verdict**, so CI can gate on it: `0` falsifying · `1` vacuous · `2` arm A already failing · `3`
usage error.

Every artifact pins `HEAD`, node version, `yarn.lock` hash, and the tracked-change count, so two
operators on different machines produce comparable results or visibly do not.

Prefer this over a hand-run test in every case. A hand-run test yields a number you then retype,
which returns the provenance to you and reintroduces exactly the problem the probe solves.

### `capture.sh` — for every lane that already has an analysis script

`retention-scan.py` (C9), `policy-audit.py` (D3), and any jest or selector probe all print to
stdout, which makes the operator the capture device. Wrap them instead:

```bash
scripts/capture.sh --label bgconn-retention --lane "C9 retention-path analysis" \
  --claim "every retention primitive this diff introduces is paired with a release" \
  -- python3 retention-scan.py "ui/store/background-connection.ts:pr.patch"
```

Writes `<label>.log` (verbatim), `<label>.json`, and `<label>.md` — the attachable block, quoting
the log rather than summarising it — with `HEAD`, tracked-change count, node, python, and
`yarn.lock` hash pinned in each. The wrapped command's exit code passes through unchanged.

**`--verdict` is stated by the caller, never inferred from the exit code.** A wrapped tool's exit
convention is its own: `policy-audit.py` exits `0` while listing sixteen newly granted
capabilities, so inferring would print "pass" over a page of findings. With no `--verdict`, the
artifact says *ran to completion — read the output, no verdict asserted*, which is the honest
default.

A crashing command produces an artifact containing the traceback, not a fabricated result.

### `selector-recompute.sh` — lane C4

A memoization claim is a claim about a count, and `reselect` publishes the count. Generates a
probe, runs it, deletes it, writes the artifact:

```bash
scripts/selector-recompute.sh --module ui/selectors/multichain-accounts/account-tree \
  --export getWalletsWithAccounts --fixture test/data/mock-state.json \
  --slice metamask --perturb pinnedAccountList
```

Three conditions, of which the middle one discriminates:

| Condition | narrowed inputs | whole-slice input |
|---|---|---|
| identical state reference | 1 | 1 |
| fresh slice, **unrelated** field | **1** | **6** |
| a real input changed | 6 | 11 |

A selector taking narrowed input selectors is unmoved by an unrelated write; one reading
`state.metamask` wholesale recomputes on every unrelated write in the app. Both rows above are
measured, not illustrative — `getWalletsWithAccounts` and `selectRampsControllerState` on
`main`.

### `tsc-substitution.sh` — lane D6 (`tsc-blindspots`)

Whether a hand-written type agrees with the source it restates is a question only the compiler
can settle; assignability is not obvious by inspection, which is the reason the lane exists.

```bash
scripts/tsc-substitution.sh --file shared/lib/transactions-controller-utils.ts \
  --line 146 --replace '      topics?: string;' \
  --probe-line 150 --probe '    const _probe: string[] = txReceiptLogs[0].topics;'
```

Arm A typechecks the baseline, arm B applies the substitution, and the finding is the **error
diff**. Source is restored on exit including on interrupt.

**A silent arm B is not proof of agreement.** Existing call sites often satisfy both shapes —
indexing and `.match()` compile against `string` and `string[]` alike — so use `--probe` to
inject a deliberately-typed sink that only the authoritative shape accepts. Without one this
lane reports false clean.

If arm A already fails, the run stops and states that nothing was established, alongside the
count of module/export errors (TS2305/TS2307/TS2724), which usually indicate an incomplete
install rather than a repo defect. It does not classify from that ratio — on a real run 124 of
280 errors were install artifacts while tripping no majority rule, because other codes are
downstream of the same cause.

### `attest-gate.sh` — run this before publishing anything

Eight mechanical checks over the artifact as it will ship. No model is asked anything until
these pass, because a model asked "is this good evidence?" answers from inside the frame that
produced the text.

```bash
scripts/attest-gate.sh comment.md            # exit 0 = proceed, 1 = BLOCKED
```

Marker pair · canonical header · verdict line · environment pinned · **a captured artifact** ·
no "what would close it" · no first-person process narration · `proven` only with an execution
artifact.

Check 5 is the one that matters and the easiest to slip past: if every character of the output
is one the operator typed, the run published an assertion. Pass `--reference <showcase>` to
compare capture density against a known-good artifact.

This is phase 0 of `/attest`; phases 1 and 2 dispatch
`/outframe ‖ /missing ‖ /press` then `/trim` to fresh instances, because those passes cannot be
self-run — the author is positionally the wrong reader.

### Runner registry — what each establishes, and what it cannot

Route a claim to a runner by what the claim asserts. **Read the limit column before quoting a
result**: every runner has a shape of claim it cannot reach, and reporting past that line is how
a run stops being evidence.

| Runner | Establishes | Cannot establish |
|---|---|---|
| `falsify-probe.sh` | a test fails when its mechanism is removed | that the fix is *correct* — only that the test has power |
| `selector-recompute.sh` | recomputation counts across three input conditions | component render counts; a selector without `.recomputations()` |
| `render-count.sh` | renders of one named consumer over one interaction | that other consumers behave the same; needs a hand-written probe |
| `tsc-substitution.sh` | a hand-written type disagrees with its source | agreement — **a silent arm B means the probe was too weak** |
| `retention-scan.py` | acquire/release pairing within one file | that the release site is *reachable* from the acquire |
| `policy-audit.py` | capability delta and override scope | whether a grant is acceptable — intent is not in the files |
| `egress-delta.py` | egress added, protections removed | whether a flow is acceptable, or what happens off-diff |
| `capture.sh` | a verbatim artifact for any command | any verdict — the caller states it or none is claimed |
| `attest-gate.sh` | eight mechanical publication checks | whether the claim under test was the right one to test |

Exit codes are uniform: `0` the checked property holds · `1` it does not · `2` no conclusion
available · `3` usage error. **A `2` from any runner caps the whole run at unproven** — one
inconclusive arm is not offset by another lane passing.

### Synthesising a run from several runners

1. **Lead lane first.** Pick the runner whose output *is* the claim. A corroborator strengthens
   a lead; it never substitutes for one.
2. **Correctness gates measurement.** `selector-recompute` fails outright on an unstable value,
   and that ordering generalises: a performance number over changed behaviour is not a
   performance result, it is a missed regression.
3. **A `2` is load-bearing.** Report it as its own line. Averaging it away, or quoting the lanes
   that passed, converts "we could not tell" into "it is fine".
4. **Security and privacy findings route privately** regardless of what the other lanes say. A
   green performance lane does not make an egress finding publishable here.
5. **State the residue.** Name the part of the claim no runner reached, in the artifact, rather
   than letting the covered part imply coverage.

### The bar: float concerns, do not close them

A run succeeds when it puts **concerns, falsifiers, and avenues of deeper inquiry** in front of a
reviewer. It is not required to catch every concern, resolve each correctly, or carry any to a
conclusion. That is a lower bar than being right, and a much higher one than staying silent
unless certain.

Three consequences worth being explicit about:

**A coverage gap is not a failed run.** No runner here checks a diff against an architectural
decision record. A run that says *"this touches deeplinks, which are ADR-governed; the falsifier
is whether these parameters are covered by the signature"* has done its job while resolving
nothing.

**Incomplete analysis is reportable, not suppressible.** Withholding anything short of fully
established throws away the run's actual product. An unresolved concern with a named falsifier is
the deliverable.

**This does not license speculation.** Floating a concern still requires naming what would settle
it. *"This might be unsafe"* is noise. *"Unsigned parameters on a signed link skip the
interstitial — check whether the signature covers them"* is actionable. The difference is whether
the next step is stated.

The runners raise questions with evidence attached; they are not oracles. Their limits are
publishable content, which is why the table above lists what each cannot establish.

**Worked case.** A merged PR added deeplinks accepting unsigned parameters, justified as
"read-only screens, so unsigned routing params are safe". It was reverted after review. The
justification misreads the model: signed links skip the warning interstitial, so an unsigned
parameter inherits the signature's trust without being covered by it — exploitable whether or not
the destination writes anything, via navigation hijacking, request forgery, phishing through
trusted chrome, or attribution poisoning. No runner would have caught it. A run that merely
flagged *"deeplink surface, ADR-0011 governs parameter signing, is this param in the signed
set?"* would have been enough.

### Canonical output shape

Every validation-run output — PR comment *or* PR-body section — uses exactly this, so re-runs
replace idempotently instead of accumulating:

```markdown
<!-- VALIDATION_RUN_START -->
## 🧪 Validation Run

**Verdict:** ✅ proven — **Claim:** <one-line falsifiable behavior under test>
head `<sha>` · <YYYY-MM-DD> · lanes: <lane ids>

<one sentence: what kind of evidence follows>

<the captured artifacts, unfolded>

**Follows from the above**
<terse bullets — each one a consequence of a number in an artifact above>

**Open for review:** <the single question this run hands to a human, about THIS diff>
<!-- VALIDATION_RUN_END -->
```

**The exhibits are the comment.** A reviewer opens this to see a measurement, so the
captured blocks go in the body, not behind a `<details>`, and they should outweigh your
prose — 70% exhibit is a reasonable floor. Everything you write around them is a caption.

**A fenced block is not the evidence.** Nothing in it distinguishes real stdout from invented
stdout, or from real stdout that has since drifted from its source — and whatever would
fabricate it is what formats it. Where fabrication, hallucination, or drift is a concern at
all, and that is nearly all plaintext, the medium is wrong.

The qualifying media are the ones where verification does not route through you:

- an **image of the tool's own surface** — the run page, the Discover view, the waterfall;
- a **link that re-executes or re-renders** — a CI run, a query permalink, a dashboard;
- a **hosted artifact the reader fetches** — the log at a URL, not a quotation of it.

Paste the fenced block *beside* one of those, never instead of one. This is also why a
plaintext check can never close the gap: every property of text is forgeable by whatever emits
the text, so the gate asks for a different medium rather than for better text.

**The exception — plaintext where every claim is a citation.** The rule is about where
verification routes, not about pixels. Line-level links are externally verifiable: the reader
clicks and sees exactly what you saw. That is the *normal* case for the audit lanes —
`supply-chain-audit`, `lavamoat-policy`, `privacy-egress-diligence` — whose findings
are facts about code that exists rather than results of running something. There an image would
be worse: a screenshot of a policy diff is less checkable than a permalink to it.

The bar for those lanes is comprehensive linking, not a link somewhere nearby:

- every capability grant → a permalink to its **call site** in the dependency's source, at the
  installed version, with the line;
- every *"no call site uses this"* → the **search that establishes the absence**, re-runnable;
- every version, advisory, or policy claim → the file and line it came from.

An audit row naming a package and a capability with no link is the same defect as a bare
console block — a claim on your word, wearing a technical register.

The general form: ask what the reader must do to check a claim. *Trust the transcription* means
the medium is wrong whatever it looks like. **Cite what exists; capture what you ran.**

**Automation is what removes the capture — watch for it.** The runs built by hand, before these
runners existed, attached images and hosted logs: eight of eleven carry a capture a reader can
open. The runs built by the runners attached one in twelve. Nothing was neglected; the causation
runs the other way. A runner emits clean stdout, clean stdout formats beautifully into a fenced
block, and a fenced block looks like evidence. The hand-built runs had no such thing to reach
for, so they went and got a real one.

Every runner now states this in its own artifact: in CI it prints the run URL, and on a local
machine it prints *"no reader-verifiable capture — re-run through the evidence workflow before
publishing."* The confession is in the exhibit rather than left for a gate to catch.

**If the artifact is small, nothing was attached.** The reference showcase runs to 2 MB because
it carries 31 embedded captures. Uploading costs a step and a decision about what may be
published; that cost is the price of the reader not having to trust you, and a pipeline with no
upload step has no evidence step.

**Run the measurement in CI, not locally.** `assets/evidence-run.yml` lives in one repo and
measures any other — `target_repo` is an input and the checkout is read-only, so the repo under
review needs no workflow, no fork, and no change of any kind. This is not about convenience: a local run's
only witness is you, so it cannot meet the requirement above, and every defect class this suite
has shipped was a local-environment one — a helper in `/tmp`, a probe deleted after the run, an
absolute path, a drifted toolchain, a contended host whose numbers had to be retracted. None of
those is expressible in CI, where the workflow file is the recipe, the workspace is the repo,
and the run URL is itself the capture.

It also carries two controls worth having by default: a `baseline` input, because twice a run
reported "no finding" when what it lacked was a comparison; and a determinism check that runs
the head arm twice and refuses to endorse numbers that move.

**Never restate an artifact's number in your own prose.** A figure that appears only in a
sentence you typed is a figure on your word, which is the one thing this whole skill exists
to avoid. Cite by pointing at the block; a summary table above the exhibits duplicates the
artifact's own table and downgrades it.

**Prose is the failure mode.** Lead with the conclusion, then the exhibits, then bullets.
Paragraphs of explanation read as an infodump and bury the finding; if a bullet needs three
sentences the exhibit is not doing its job.

**There must be a finding.** A run ends with something the reader can agree or disagree with —
this holds, or it does not. Running the instruments and publishing what they printed is not
that. `📋 measured, no verdict asserted` is not a verdict, and neither is a headline that
reports a delta: *"494 → 651 packages, 24 rows escalated"* is a measurement in a verdict's
clothes, leaving the reader to work out whether it is good news.

The tell is a verdict line you cannot restate as a sentence with a subject and a verb.
Withholding the conclusion feels like the rigorous move under this skill's standards, but the
numbers came from an instrument the reader does not have; the run is the only party holding the
context to interpret them, and declining to is offloading rather than restraint. State the
conclusion **and** its limits — floating a concern is the residue of a finding, not a
substitute for having one.

When no finding presents itself, the usual cause is a missing comparison rather than a
genuinely inconclusive result: a number with nothing to hold it against. Find the baseline that
turns it into a claim — a sibling artifact, the other build target, the previous release, the
arm the change did not touch.

Verdict icons: `✅` proven · `❌` failed · `ℹ️` otherwise. Never `❌` for a gap in *evidence* — that
reads as a verdict on the author's work.

The template itself, slot by slot, and how a run is assembled from it:
**[references/output-templates.md](references/output-templates.md)** — that file is the
generator, so a correction to how a run reads belongs there rather than in the comment it was
noticed on.

Full recipe — image re-hosting, recordings, AEP mirroring, the privacy scrub:
**[references/evidence-publishing.md](references/evidence-publishing.md).**

The parts that decide *whether* to publish, rather than how:

- **Surface follows ownership** — the PR body when you authored it, a comment when validating
  someone else's. Never publish a failure to another author's PR unprompted.
- **Post complete, once.** A comment is push: its audience is notified at post time and edits
  are silent, so hold until every planned lane is present, and put changed verdicts in a new
  comment referencing the original. The PR body is pull, so an idempotent marker upsert is
  correct there.
- **Lead with the canonical header** `## 🧪 Validation Run`, then verdict and claim.
- **Falsifier-forward** — what would have made this false, and what rules it out, before any
  lane inventory.
- **Don't restate CI.** Lint, build, and test results are already on the Checks tab.
- **Scrub** local paths and usernames; failure summaries leak them.

### The reader is a reviewer on this PR, not a user of this skill

They have a stake in the change and none in the tooling. Everything internal to how the
evidence was produced is noise to them, and several of these leaked into a published run
before anyone noticed:

| Leaks | Publish instead |
|---|---|
| Lane ids — `B3`, `C4`, `D3` | The category in words: *falsifying test*, *render count* |
| A runner's generic limits, identical on every run | One open question about **this** diff |
| The runner's own name as though it means something | `Produced by <tool>` provenance, and nothing more |
| Your process — drafts, retractions, what you tried first | The measurement as it stands now |
| Anything calibrating the skill rather than the change | Nothing; delete it |

The runners cooperate with this: their generic limits go to stderr and to the `.json`, not
into the `.md` exhibit, precisely so a reviewer never reads the same paragraph about the
instrument under three consecutive blocks. Read them there and synthesise **one** question.

The test: would this sentence still be worth reading if the skill did not exist? If it is
only interesting to someone who knows how the tool works, cut it.

## Validation output format

When reporting back (before publishing), lead with the verdict and the claim it tests:

```
PR #<n> — <title>
Claim: <the falsifiable behavior under test>
Verdict: ✅ proven / ❌ refuted / ⚠️ inconclusive (vacuous pass — 0 artifacts)
Evidence:
  - visual_validation run <id> — N screenshots (before/after <surface>)
  - perf_validation run <id> — M/M assertions proven
  - Sentry: <before/after link>
Artifacts: <local paths or re-hosted URLs>
Next: publish to PR body? (y/N)
```

If a lane comes back inconclusive, say so and name what's missing — never upgrade a vacuous pass to "proven".

### When validation refutes the claim (❌)

A refutation is a *successful* validation — the skill did its job. Report it constructively, do **not** publish a public "Failed" section to the author's PR unprompted:

- **Lead with the falsifier you hit:** "Claim refuted — under privacy mode the Perps balance is still visible (screenshot)." Show the evidence that disproves it.
- **Localize:** which lane, which surface, the exact observation vs the expected. Tie it to the diff if you can see why.
- **Separate refuted from inconclusive:** refuted = evidence shows the claim is false; inconclusive = evidence couldn't be captured / was untrustworthy (trust-gate fail). Don't conflate.
- **Hand back, don't fix:** this skill proves behavior; fixing is the author's loop (or a `bug_fix`/`pr_feedback` run). Offer the repro, not a patch.
- Surface privately first; only post to the PR if the author asks or it's your own PR.

## Safety & privacy

- **`publishEvidence: false` on every local submit.** Publish manually, only after a real pass, only with confirmation.
- **Re-host before linking** — never put a `localhost` URL or a local file path in a public PR body.
- **Scrub** usernames/paths from narratives. Failure summaries are the usual leak.
- **Don't trust green blindly** — assert non-empty `artifactRefs` (vacuous-pass trap).
- **Confirm before any PR-body write.** One PR's approval doesn't carry to the next.

## Worked example

PR claims privacy mode now hides the Perps balance (the demo bug #42683):
1. `gh pr view` → claim = "with privacy mode on, the Perps tab balance is masked like everywhere else."
2. Lane = `visual_validation` (visible). Preflight stack.
3. Submit with `description: "Onboard, enable privacy mode in Settings, open the Perps tab, confirm the balance is masked. If the Perps tutorial modal blocks, use the Shield entry modal as the reachable surface."` + `publishEvidence:false`.
4. Poll to completion; assert `artifactRefs` has the before/after pair (not a vacuous skip).
5. Fetch the two PNGs; re-host to `aep-evidence`; assemble the `AEP_VISUAL_VALIDATION` section with the `raw.githubusercontent` URLs injected into the template's `### After`.
6. Show the rendered section; on confirm, upsert the PR body.

End-to-end examples for **non-visual** claims (perf, migration, flag-gated, refactor/no-op): **[references/worked-examples.md](references/worked-examples.md).**

## Positioning: AEP vs recipes vs evidence

Three adjacent things; keep the boundary clear so they compose instead of collide:

- **AEP** — governed *fleet orchestration*: sandboxes, Temporal, autonomous runs at scale. The heavy engine.
- **ADR-0058 recipes** ([decisions#173](https://github.com/MetaMask/decisions/pull/173)) — a *dev-machine inner-loop* proof artifact: a declarative per-PR recipe run against the live app over CDP, emitting `summary.json`/`trace.json`/manifest.
- **evidence** (this skill) — the *claim→evidence methodology + taxonomy* both draw on. The Claim Card is the bridge from a PR's claim to the right proof target; the [evidence catalog](references/evidence-catalog.md) is the lane vocabulary; [lane-assertions.md](references/lane-assertions.md) maps each lane to a recipe assertion (and flags the out-of-band, non-UI lanes — the gap raised in review of decisions#173).

evidence is the one a human drives; it can dispatch an AEP run or author a recipe as its capture step.

## Workflow integration

Where evidence sits in the PR lifecycle (see the public `pr-workflow` siblings):

- **After `create-pr`, before `pr-review-queue`:** validate the claim, attach the bundle, *then* request review — reviewers get the before/after up front.
- **On force-push / requested-change:** re-run the affected lane(s); re-validation keeps a stale evidence section honest.
- **`/triage` push items:** a `push`-state PR isn't done until its claim is proven; evidence produces the evidence that lets it move.
- **Not a CI gate** (same scope line as ADR-0058) — it's the author's inner loop, complementing unit/e2e, not replacing them.

## Boundaries

- **Executes, with a confirmation gate on publish.** It runs the harness and captures evidence autonomously; it does not write to the public PR body without showing you the section first.
- **Local-only AEP.** No hosted instance. The skill drives the local stack.
- **Proves behavior, not code.** Pair with `/review` / `/code-review` for correctness and `/sentry-quota` for span-volume risk.
- **No persisted state.** Each run is fresh. To keep a validation record, ask — nothing writes by default.

## Related

- [references/claim-extraction.md](references/claim-extraction.md) — Step 1: turn a PR into a falsifiable Claim Card.
- [references/evidence-catalog.md](references/evidence-catalog.md) — the full menu of evidence kinds, verified capture commands, and what each proves.
- [references/evidence-trustworthiness.md](references/evidence-trustworthiness.md) — the anti-reward-hacking gate before believing/publishing a lane.
- [references/evidence-publishing.md](references/evidence-publishing.md) — PR-body format, non-visual/multi-lane rendering, image re-hosting, recordings→GIF, privacy scrub, ADR-0058 artifact contract.
- [references/worked-examples.md](references/worked-examples.md) — end-to-end runs for perf / migration / flag-gated / refactor claims.
- [references/lane-assertions.md](references/lane-assertions.md) — lane → declarative recipe-assertion mapping (ADR-0058 bridge).
- [references/aep-local-run.md](references/aep-local-run.md) — full local-stack bring-up + every gotcha.
- `~/Code/metamask/metamask-autonomous-engineering-platform` — the AEP repo (`docs/demo-runbook.md`, `packages/agent-chain/src/graphs/{visual,perf}-validation/`, `packages/github/src/pr-body-builder.ts`).
- `MetaMask/decisions#173` — ADR-0058 Recipe-Based Verification (the adjacent inner-loop proof system).
- `/sentry-quota` — sibling skill for span-volume PR review; `/review`, `/code-review` — code correctness.
- **Engine skills — delegate the analysis, package the result.** Each owns a category in
  [references/evidence-catalog.md](references/evidence-catalog.md); all run standalone too.

  | category | engine |
  |---|---|
  | B3 falsifying regression test | `/red-on-base` |
  | B7 deterministic interleaving (concurrency / ordering) | `/race-condition-repro` |
  | C4 React render & selector proof | `/react-render-delta` |
  | C9 memory leak | `/memory-leak` |
  | D supply-chain / dependency change | `/supply-chain-audit` → delegates capability grants to `/lavamoat-policy` |

  **An engine that defines its own output contract publishes in it.** `lavamoat-policy`
  is the live case: read-level triage, no verdict, its own header and marker pair. Do not
  re-frame it as a Validation Run — see *One comment per evidence kind* in
  [references/evidence-publishing.md](references/evidence-publishing.md).
- [references/aep-local-run.md](references/aep-local-run.md) — the local-run procedure this skill encodes.
