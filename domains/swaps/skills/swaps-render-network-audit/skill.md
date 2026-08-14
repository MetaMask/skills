---
name: swaps-render-network-audit
description: Run, analyze, and compare at least three successful repetitions of the deterministic MetaMask Mobile iOS Swaps performance scenario that opens Swaps, selects Ethereum USDC, enters 1 ETH, and waits for the first quote. Defaults to three runs when the user does not specify a count. Use when measuring this Swaps flow, collecting render counts and sanitized JavaScript network/console logs, comparing repeat runs, preparing temporary development instrumentation, or updating the checked-in scenario locators after the Swaps UI or test IDs change.
maturity: experimental
---

# Swaps Render and Network Audit

Orchestrate at least three successful iOS Simulator runs of scenario 001.
If the user already specified a count, use it. Otherwise ask how many
successful runs they want and default to 3 if they do not choose. Never
collect fewer than 3 successful runs. Call the `yarn performance:swaps`
commands and read the files they write. Do not reimplement the runner,
analyzer, or comparer.

Command details and artifact layout: `tests/performance/swaps/README.md`.

Run from the MetaMask Mobile repository root. Use iOS only for this scenario.

## When To Use

Use when the user:

- Wants to measure the MetaMask Mobile Swaps quote flow (open Swaps, select
  Ethereum USDC, enter 1 ETH, wait for the first quote).
- Asks to collect render counts and sanitized JavaScript network/console logs
  for that scenario, compare repeat runs, or prepare temporary development
  instrumentation.
- Needs the checked-in scenario locators updated after the Swaps UI or test
  IDs change.

Do not use for:

- Auditing an already-recorded Hermes `.cpuprofile` — that is
  `swaps-cpu-profile-audit`.
- MetaMask Extension, Android, or any scenario other than iOS Simulator
  scenario 001.
- Submitting the swap, reinstalling the app, or resetting wallet data.

## Workflow

### 1. Preflight before modifying source

1. Inspect `git status --short` and preserve all existing user changes.
2. Run `yarn performance:swaps status`. If it reports `partial`, stop and inspect
   the `SWAPS_PERF_ANALYSIS` markers; never overwrite partial instrumentation.
3. Run `yarn mm:doctor`. Do not prepare instrumentation until Xcode, `idb`,
   `idb_companion`, and a booted simulator pass.
4. Confirm a development build is installed. Do not install or reset the app
   unless the user explicitly requests it.
5. Ensure the installed wallet is on Login or unlocked on the Wallet view.
   Ethereum must have been selected before locking or starting the scenario.
6. If Metro is already running, stop it before preparing instrumentation so it
   cannot bundle an intermediate source state.

Tell the user before preparing temporary source instrumentation or pausing for
a manual prerequisite.

If automatic unlock may be needed, confirm `SWAPS_PERF_WALLET_PASSWORD` is set
in the agent shell without printing its value
(`test -n "${SWAPS_PERF_WALLET_PASSWORD-}"`). If it is missing, ask the user
to send a **dummy development password only** so the agent can export it.
Do not accept or use a real wallet password, seed phrase, or production
credential. Example of what the agent then runs:

```bash
export SWAPS_PERF_WALLET_PASSWORD='dummy-dev-password'
```

### 2. Prepare temporary render logs

```bash
yarn performance:swaps prepare
yarn performance:swaps status
```

Require status `prepared`. Do not run a formatter or edit marked regions while
instrumentation is prepared.

Then start Metro in a persistent terminal and note its port:

```bash
yarn watch:clean
```

Do not establish a long-lived `mm` session here. Launch a fresh session
immediately before each run.

### 3. Collect successful runs

Collect the agreed number of successful runs on the same commit, simulator,
Metro process, and scenario. Failed attempts remain visible in the comparison
but do not count toward the required successful runs.

Before the first run, inspect the target
`test-reports/swaps-performance/<date>-<commit>/<scenario>/` folder. The compare
command reads every direct JSON child. To compare exactly the new batch,
start with no existing JSON artifacts in that folder. Never delete or move
existing artifacts without the user's approval; if the folder is not empty,
explain that the comparison would include those runs and ask whether to include
them.

For each run:

```bash
yarn mm launch --metro-port 8081
yarn performance:swaps run --scenario 001 --metro-port 8081
```

Replace `8081` only when Metro uses another port. If `mm launch` fails because
Hermes did not attach (`HERMES_TARGET_NOT_FOUND` or a Hermes health-check
failure), run `yarn mm cleanup` and retry the same launch. Try at most three
launch attempts; it usually connects on the second. If all three fail, stop
and report the last error. Do not start `performance:swaps run` until launch
succeeds.

The runner reuses the session just launched, unlocks from Login when
`SWAPS_PERF_WALLET_PASSWORD` is set, measures the scenario, writes the JSON
and Markdown pair, restores Wallet, and calls `mm cleanup`. The next
iteration must `mm launch` again. If an attempt fails before runner cleanup,
run `yarn mm cleanup` before relaunching.

Count an iteration only after the runner reports a passed artifact. Do not
silently retry a deterministic scenario or precondition failure. Diagnose it and
ask for user action when required. Recoverable `mm` session or readiness failures
may be cleaned up, relaunched, and retried.

### Locator drift

Measured runs must stay deterministic. The checked-in scenario and
`locators.ts` are the only interaction contract. If an expected control is
missing, the run fails. Do not invent a fallback tap, coordinate gesture,
fuzzy ID, or alternate flow during a run or between runs in the same
comparison set.

Locator work is script maintenance, not measurement. Pause the batch, keep
the failed artifact, and update the scenario contract before collecting a
new comparable set.

The live iOS accessibility tree is the source of truth for what `mm` can
target. Finding a `testID` in React source or a unit test does not prove
`idb` can use it. A timeout often means the expected screen, UI variant, or
data row is not mounted, not that the string was misspelled.

When updating the script:

1. Run `yarn mm describe-screen` on the screen that should show the control.
2. Compare visible IDs with
   `tests/performance/swaps/scenarios/001-fetch-one-eth-quote/locators.ts`
   and the imported app `*.testIds.ts` modules.
3. Decide the cause: wrong starting state, a different conditional UI branch,
   a renamed or removed ID, a composite wrapper that does not expose the ID
   natively, dynamic content that is not ready, or a real change to the user
   flow.
4. If the same semantic control still exists, update `locators.ts` and/or the
   product test-ID module. Prefer importing app-owned constants over raw
   strings.
5. If the interaction path or phase boundaries changed, tell the user before
   changing the scenario.
6. Collect a new comparison set only after the updated script matches the
   live tree. Do not mix pre-fix and post-fix runs.

Prefer a unique native row or button ID over typing into search when both
reach the same deterministic action. Treat clickability and text extraction as
separate: `wait-for`/`click` success does not prove `get-text` read the same
node.

### 4. Review each run's analysis

The run command writes both the raw JSON artifact and its paired Markdown
analysis. After each attempt, read that Markdown and confirm status before
counting the run. Use the analyzer only to regenerate a missing or stale report:

```bash
yarn performance:swaps analyze --latest
```

Treat `fetch-first-quote` as driver wall-clock time that includes `mm`/idb
overhead. JavaScript `fetch` interception does not see native networking,
WebSockets, or all controller failures. Label conclusions from one
development-build run as single-run observations, not regressions.

### 5. Compare the successful runs

After collecting the agreed successful runs in one commit/scenario folder, run:

```bash
yarn performance:swaps compare \
  test-reports/swaps-performance/<date>-<commit>/<scenario>
```

Read the `comparison.md` it writes. In the user-facing summary, include a
markdown link to that file, for example
`[comparison.md](test-reports/swaps-performance/<date>-<commit>/<scenario>/comparison.md)`.
Treat the 20 percent variability finding as diagnostic guidance, not a
regression gate, and label the report as within-commit development-build
variability.

### 6. Always remove temporary instrumentation

Run this in a finally-style cleanup path whether preparation, any scenario run,
or comparison succeeds or fails:

```bash
yarn performance:swaps cleanup
yarn performance:swaps status
```

Require status to report that instrumentation is not installed. If cleanup
fails, stop, preserve the working tree, and report the marked files to the user.

## Guardrails

- Use only a dummy development password. Never ask for, accept, or store a
  real wallet password, seed phrase, or production credential. Do not write
  `SWAPS_PERF_WALLET_PASSWORD` into artifacts or reports.
- Never submit the swap; this scenario ends when a quote appears.
- Never use reinstall, reset-app-data, or destructive launch options.
- Preserve unrelated working-tree changes before, during, and after cleanup.
