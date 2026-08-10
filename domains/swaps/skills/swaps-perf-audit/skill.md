---
name: swaps-perf-audit
description: >-
  Run a measured performance audit of the MetaMask Mobile swaps/bridge screen
  on an iOS Simulator. Use when asked to audit, profile, or verify the
  performance of the swaps page, the Bridge view, the token input areas, the
  quote countdown, or any modal the swaps flow renders — and when a finding
  must be backed by on-device numbers rather than code reading. Audits one area
  per run — `swaps-screen` (amount input, quote details, slippage, post-trade)
  by default, or `asset-picker` (token list, search, network filter) or
  `batch-sell` when named. Verifies a human-provisioned environment through a
  read-only preflight (booted simulator, Metro, dev build, live `mm` session,
  unlocked wallet with accounts), drives the app, instruments render and
  stylesheet counters over Fast Refresh, reads them back through `mm cdp`, and
  reports before/after deltas. Trigger phrases include "audit
  swaps performance", "why does swaps re-render", "verify the swaps perf fix",
  "measure swaps renders on device", "audit the token selector", and "profile
  the bridge view". MetaMask Mobile only — iOS Simulator, dev build required.
maturity: stable
---

# Swaps Performance Audit

Measured performance auditing for the MetaMask Mobile swaps/bridge screen. This
skill owns the environment contract and the measurement protocol; the
optimization advice itself lives in the `performance` skill.

## When to use

Use when asked to:

- Audit or profile the swaps / bridge screen, or a modal it renders.
- Explain why the swaps screen re-renders, feels laggy, or drops frames.
- Verify that a swaps performance fix actually moved the numbers.

Do not use for:

- Correctness bugs, styling, or business logic in the swaps flow.
- MetaMask Extension — this skill is mobile-only and installs only there.
- Generic performance questions with no swaps scope. Use `performance`.

## Workflow

1. **Resolve the scope.** An audit measures one area. Match what the user asked
   for against the surface aliases in the area files, default to `swaps-screen`
   when nothing is named, and confirm the resolved scope before provisioning
   anything.
2. **Check the environment.** The skill provisions nothing. A human boots the
   simulator, runs the watcher, installs the dev build, opens the `mm` session
   and unlocks the wallet; one read-only script then verifies all of it and
   exits non-zero with the fixing command if anything is missing. A failed gate
   ends the run — report it and stop. Never work around it, and never type a
   password.
3. **Navigate to the surface.** Reuse recorded knowledge when it exists, observe
   before every action, and never assume wallet credentials.
4. **Sweep statically.** Rank candidate anti-patterns from the code. The sweep
   covers the whole Bridge directory regardless of scope — it costs seconds.
   Findings are hypotheses at this point, not facts.
5. **Instrument and measure.** Apply render, stylesheet, subscription-balance
   and reference-identity counters over Fast Refresh, run the scenarios that
   surface lists, and read the counters back through `mm cdp`.
6. **Evaluate the conformance checks.** Report a result for every check in the
   area's file and in `checks/common.md`, on top of whatever the open-ended
   investigation turned up. Checks marked `provisional` have thresholds nobody
   has confirmed on device — a failure there is a prompt to calibrate, and
   correcting the threshold in the area file is part of the run.
7. **Fix, re-measure, report.** Re-run the identical scenarios and report
   before/after deltas per component, the conformance table, and the area the
   audit covered.
8. **Revert instrumentation.** No counter may survive into the diff. The
   environment is the user's and was theirs before the run, so leave the
   simulator, the watcher and the session exactly as they were found.

The mobile procedure, the exact commands, and the test IDs are in the
repo overlay. Load these on demand:

- `references/checks.md` — how the standard is organised: areas, ID scheme, the
  mergeability rule, waivers, and how to contribute. Read it before adding
  anything.
- `references/checks/common.md` — always in scope, whatever the area.
- `references/checks/<area>.md` — the surfaces, scenarios and checks for the
  area this run is scoped to. This is the living part of the standard.
- `references/instrumentation.md` — counter recipes, `mm cdp` readout, the
  stable-identity rule, and the revert checklist.
- `references/audit-protocol.md` — scope resolution, scenario discipline,
  deltas, severity, report format.

## Scope

One area per run:

| Area | Covers | File |
|---|---|---|
| `swaps-screen` | Amount input, quote details and selection, slippage, post-trade. **Default.** | `checks/swaps-screen.md` |
| `asset-picker` | Token list, search, network filter. | `checks/asset-picker.md` |
| `batch-sell` | Batch sell selection, review, and its sheets. | `checks/batch-sell.md` |

```
audit swaps performance            → swaps-screen (default)
audit the token selector modal     → asset-picker
why is the token list janky        → asset-picker
check perf of my slippage changes  → swaps-screen / slippage surface
audit batch sell review            → batch-sell
audit swaps, all of it             → each area in turn, one report each
```

An unrecognised screen is audited ad hoc against `common.md` only, and the skill
proposes registering it. An ambiguous request is a question, not a guess.

`asset-picker` and `batch-sell` have no checks of their own yet — nothing there
has been measured on device. Both files carry surfaces, scenarios and
candidates, so a first audit has somewhere to start and somewhere to record
what it finds.
