# Audit protocol — scenarios, deltas, severity, report

The measurement discipline. Static reading produces hypotheses; only this loop
produces findings.

## Loop

- Resolve the scope to one area and confirm it (Step 0).
- Read that area's file under `checks/`, plus `checks/common.md` — their checks
  name the primitives they need, which decides part of what you instrument.
- Sweep statically and rank candidates; run the `static` checks here (Step 1).
- Instrument the top candidates (`instrumentation.md`).
- Measure the scenario set, including the idle baseline (Step 2), and compute
  deltas (Step 3).
- Evaluate every check in scope against those numbers (Step 5).
- Fix one class of problem, then re-measure the identical scenario set and
  re-evaluate the checks.
- Report before/after plus the conformance table (Step 6). Revert
  instrumentation (Step 7).

Two things make an audit complete: the open-ended investigation, which finds
what nobody has thought to check for yet, and the checks, which are the
properties the area is already known to need. Do both. An audit that reports
findings without a result for every check ID in scope is unfinished, and so is
one that walks the checklist and looks no further.

A hypothesis that survives the static sweep but never gets numbers is reported
as **UNVALIDATED**, never as a finding.

## Step 0 — Resolve the scope

An audit measures one area. There are three, each with its own file under
`checks/`:

| Area | Covers |
|---|---|
| `swaps-screen` | Amount input, quote details and selection, slippage, post-trade. **Default.** |
| `asset-picker` | Token list, search, network filtering. |
| `batch-sell` | Batch sell token selection, review, and its sheets. |

Match the request against the surface alias lists inside those files:

- **No area named** — use `swaps-screen`, the default, and say so in the
  report. "Audit swaps performance" means the main screen.
- **One match** — use it. A request naming a single surface still runs the
  area's checks, restricted to what that surface mounts.
- **Several matches, or a vague request** — ask which one. Do not average
  across areas.
- **A real screen that is not registered** — audit it ad hoc with this
  protocol, report that no conformance checks applied beyond `common.md`, and
  propose registering it. That is how the registry grows.
- **"Everything"** — run the areas in sequence with a separate report each.
  Warn first: each area costs its own scenario set, and instrumenting them in
  one pass exceeds the five-component ceiling in `instrumentation.md`.

State the resolved scope back to the user **before** asking them to set the
environment up. Bring-up takes minutes of their time and a misread scope wastes
all of it.

```
Scope: asset-picker → token-list surface (matched alias "token list")
Scenarios: COMMON-S0, PICKER-S1, PICKER-S2, PICKER-S3, COMMON-S6
Checks: COMMON-R001, R002, M001, M002, B001 — asset-picker has none of its own
Note: PICKER-S2 and S3 are unverified procedures; expect to correct them
```

`common.md` is in scope for every run. Its two static checks (`COMMON-M002`,
`COMMON-B001`) are seconds of ripgrep over the whole tree, so narrowing them
would save nothing and lose coverage.

If the area you resolved to has no checks of its own, say so up front rather
than letting the report imply the area is in good shape. An empty index means
nobody has measured it, not that it passed.

## Step 1 — Static sweep

Scope every search to the Bridge tree. Run these from the repo root:

```bash
BR=app/components/UI/Bridge

# useStyles called with an inline object literal → new vars ref every render
rg -n "useStyles\([A-Za-z]+,\s*\{" "$BR"

# StyleSheet.create reachable from a component body rather than module scope
rg -n "const createStyles = \(\) =>" "$BR"
rg -n "createStyles\(\)" "$BR"

# inline closures passed as props (defeat memo on the child)
rg -n "on[A-Z][A-Za-z]*=\{\(\) =>" "$BR"

# components not wrapped in memo that render per keystroke
rg -n "^export const [A-Z][A-Za-z]* = \(" "$BR"

# selector and hook-return stability
rg -n "useSelector\(.*,\s*isEqual\)" "$BR"
rg -n "JSON.stringify" "$BR"

# bundle: main-package lodash imports
rg -n "from 'lodash'" "$BR"
```

Cross-reference each hit against `mms-performance`
`references/mm-audit-playbook.md` and the guide it maps to. Honour that skill's
guardrails — notably: never flag missing `estimatedItemSize` (FlashList v2
deprecated it), and never propose `useMemo`/`useCallback` without evidence or a
concrete correctness reason.

## Step 2 — Scenario set

Scenarios are defined per area, not here. `COMMON-S0` and `COMMON-S6` live in
`checks/common.md`; everything else lives in the area file, next to the surfaces
that use it and the checks that read it. Run only the ones the selected surface
lists.

The rules that hold whatever the area:

- **Always run `COMMON-S0` first.** Without a baseline, no other number means
  anything.
- **Start each scenario from the surface's resting state** — the surface
  mounted, no modal open on top of it — and reset counters at the start of each.
- **`COMMON-S6` is the exception to resetting.** Reset once at its start and
  not between cycles; its counters are cumulative balances, and a mid-run reset
  discards the only signal they carry.
- **IDs are append-only within their prefix.** Checks cite them, so renumbering
  silently rewires the standard.
- **An unverified procedure is a draft.** Area files mark which scenarios have
  actually been driven on device. Correct the file when a drafted one turns out
  wrong — that correction is worth as much as the measurement.

Record raw counters per scenario:

```bash
yarn mm cdp Runtime.evaluate '{"expression":"globalThis.__mmPerf = {}; \"reset\""}'
# ...drive the scenario...
yarn mm cdp Runtime.evaluate '{"expression":"JSON.stringify(globalThis.__mmPerf)"}'
```

## Step 3 — Deltas

The number that matters is **scenario minus idle baseline, normalized per
interaction**:

```
attributable = raw(scenario) - raw(idle) * (scenario_duration / idle_duration)
per_keystroke = attributable / keystrokes
```

Interpretation:

- `styleCreate` greater than its mount count in *any* scenario means
  `StyleSheet.create()` is running during interaction. That is always a defect.
- `render` counts that scale with keystrokes are expected for the input itself
  and suspicious for everything else.
- A component whose render count moves during `COMMON-S0` is being driven by
  background state, not by the user. That is a selector or subscription
  problem, not a memoization problem, and it usually lives outside the Bridge
  tree.
- For a scroll scenario, "per interaction" means per row scrolled past, not per
  gesture. Record the row count or the delta is uninterpretable.

## Step 4 — Severity

| Severity | Criterion |
|---|---|
| Critical | Work that scales with a list or fires per frame; stylesheet creation inside a per-second timer; whole-screen re-render on every keystroke |
| High | Broken memoization on a component that renders per keystroke; a hook returning a new object or array each render into a memoized subtree |
| Medium | Unnecessary re-render of a leaf that is cheap to render |
| Low | Bundle-only issues (main-package imports), or work bounded to mount |

Severity comes from the measured delta, not from how the code reads.

## Step 5 — Conformance

Record a result for every check in the selected area's file plus every check in
`checks/common.md` — including the ones that pass and the ones you could not
run. A missing row is indistinguishable from a check that was skipped because
it was inconvenient.

Checks belonging to other areas are simply absent. They are out of scope, not
`SKIP`, and the scope line above the table is what accounts for them.

```markdown
Scope: swaps-screen / quote-entry (default — no area named in the request)

| ID | Result | Measured | Threshold | Note |
|---|---|---|---|---|
| COMMON-R001 | PASS | 0 | 0 | |
| COMMON-R002 | PASS | 0 | 0 | |
| COMMON-M001 | PASS | 0 | 0 | 5 cycles |
| COMMON-M002 | PASS | — | no orphans | 14 hits, all with cleanups |
| COMMON-B001 | WAIVED | 1 hit | 0 | pre-existing, out of scope for this change |
| SWAPS-R003 | FAIL | 4.2 / keystroke | <= 2.0 | vars object rebuilt each render |
| SWAPS-R004 | PASS | 1 | <= 1 | |
| SWAPS-R005 | PASS | 0 | 0 | |
| SWAPS-R006 | PASS | 9 | <= 10 | |
| SWAPS-N001 | SKIP | — | <= 2 | interceptor lost to Fast Refresh |
```

- `PASS` / `FAIL` — measured against the threshold.
- `SKIP` — could not be measured. Say why; a skip is a gap in the audit, not a
  pass.
- `WAIVED` — failed, understood, out of scope. Needs a reason and the measured
  value. Only for checks marked waivable.

A `FAIL` on a blocking check is a defect in the report regardless of whether
the change under audit introduced it.

**Provisional checks read differently.** A check marked `provisional` in its
area's index has a threshold nobody has confirmed on device (see the lifecycle
table in `checks.md`). A `FAIL` there means one of two things — the code has a
problem, or the threshold was guessed badly — and the audit's job is to say
which. If the measured number looks reasonable for what the screen does, fix
the threshold in the area file and report that you did; if it does not, report
the finding. Either way the check should come out of the run better calibrated
than it went in, and a provisional `FAIL` is never reported as a blocking
defect.

Mark provisional results in the table so a reader can weight them:

```markdown
| SWAPS-R007 | FAIL* | 6 / cycle | <= 2 | *provisional — threshold unconfirmed |
```

## Step 6 — Report

One table, raw numbers, both columns from the same scenario set:

```markdown
| Component | Metric | Before | After | Scenario |
|---|---|---|---|---|
| TokenInputArea (source) | styleCreate | 47 | 1 | SWAPS-S2 |
| TokenInputArea (source) | render | 52 | 12 | SWAPS-S2 |
| FlipQuoteButton | styleCreate | 31 | 1 | SWAPS-S2 |
| QuoteCountdownTimer | styleCreate | 10 | 0 | COMMON-S0 |
```

Publish the Step 5 conformance table next to it. State alongside both:

- **The area this audit covered, and that everything else was out of scope.**
  If the scope was the default rather than a choice, say that too — a reader
  who asked for "a swaps audit" should not have to guess that the token
  selector was never mounted.
- **Whether the area had any checks of its own.** An area with an empty index
  has never been measured; a clean report from one means far less than a clean
  report from `swaps-screen`.
- The device, the build, and the Metro port the numbers came from.
- The idle baseline that was subtracted.
- Anything measured but unchanged — a fix that moved nothing is a finding too,
  and per the measure/optimize/re-measure rule it should be reverted rather
  than shipped on faith.
- Any candidate that stayed **UNVALIDATED**, and what would validate it.
- Any defect you found that the area has no check for. If it is reducible to a
  primitive, a scenario and a number, propose the new check in that area's
  file — that is how the standard grows. If it is not yet reducible, add it to
  that file's Candidates section instead.
- Any scenario marked unverified that you drove for the first time, with the
  correction if the recorded procedure was wrong.

## Step 7 — Close out

- Revert every counter (`instrumentation.md` has the checklist).
- `yarn lint:changed:fix` and run the unit tests for the touched components.
- Leave the environment as you found it. The run booted no simulator and
  started no watcher, so there is nothing to release; releasing the user's
  `mm` session (`yarn mm cleanup --shutdown`) is theirs to decide.
