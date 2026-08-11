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
   for against the areas in Scope below, default to `swaps-screen` when
   nothing is named, and confirm the resolved scope before provisioning
   anything.
2. **Check the environment.** The skill provisions nothing. A human boots the
   simulator, runs the watcher, installs the dev build, opens the `mm` session
   and unlocks the wallet; one read-only script then verifies all of it and
   exits non-zero with the fixing command if anything is missing. A failed gate
   ends the run — report it to the user with the command it printed, then
   terminate the session. Never attempt to resolve the issue yourself, never
   work around it, and never type a password.
3. **Navigate to the surface.** Reuse recorded knowledge when it exists, observe
   before every action, and never assume wallet credentials.
4. **Sweep statically.** Rank candidate anti-patterns from the code. The sweep
   covers the whole Bridge directory regardless of scope — it costs seconds.
   Findings are hypotheses at this point, not facts.
5. **Instrument and measure.** Apply render, stylesheet, subscription-balance
   and reference-identity counters over Fast Refresh, drive whatever scenario
   the investigation calls for, and read the counters back through `mm cdp`.
   There is no fixed scenario catalogue right now (see the note above) — pick
   scenarios that isolate the hypothesis from step 4.
6. **Fix, re-measure, report.** Re-run the identical scenario and report
   before/after deltas per component, plus the area the audit covered. There is
   no conformance table to fill in until the standard is rebuilt.
7. **Revert instrumentation.** No counter may survive into the diff. The
   environment is the user's and was theirs before the run, so leave the
   simulator, the watcher and the session exactly as they were found.

The mobile procedure, the exact commands, and the test IDs are in the repo
overlay (`repos/metamask-mobile.md`).

**The conformance-check standard (`references/`) has been reset.** The areas,
scenarios, checks, instrumentation recipes and audit protocol that used to live
there — including calibrated, on-device-measured thresholds — were deleted
wholesale rather than repaired piecemeal, so there is currently no scored
checklist, no scenario catalogue and no report format to follow. Until it is
rebuilt, an audit is open-ended: sweep the Bridge tree statically, instrument
and measure what looks suspicious, and report findings with real numbers, but
do not claim conformance against checks that no longer exist. Propose
`references/checks.md`, `references/checks/<area>.md`,
`references/instrumentation.md` and `references/audit-protocol.md` as the
shape to rebuild into once a new run has fresh findings worth codifying.

## Scope

One area per run. There is no area file to load anymore (see the note in
Workflow) — these are just the named surfaces to resolve a request against:

| Area | Covers |
|---|---|
| `swaps-screen` | Amount input, quote details and selection, slippage, post-trade. **Default.** |
| `asset-picker` | Token list, search, network filter. |
| `batch-sell` | Batch sell selection, review, and its sheets. |

```
audit swaps performance            → swaps-screen (default)
audit the token selector modal     → asset-picker
why is the token list janky        → asset-picker
check perf of my slippage changes  → swaps-screen / slippage surface
audit batch sell review            → batch-sell
audit swaps, all of it             → each area in turn, one report each
```

An unrecognised screen is audited ad hoc the same way. An ambiguous request is
a question, not a guess.
