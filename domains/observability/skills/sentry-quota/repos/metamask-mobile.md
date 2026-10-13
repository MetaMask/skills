---
repo: metamask-mobile
parent: sentry-quota
---

## File Paths

| Path | Role |
|---|---|
| `app/util/trace.ts` | `TraceName` / `TraceOperation` enums = the custom-span registry; `trace({ name, op, data }, cb)` API |
| `app/util/sentry/utils.ts` | the app's only `Sentry.init`. Sets `tracesSampleRate` (`0.03` in production, `1.0` in dev and E2E) and `beforeSendTransaction`, which calls `excludeEvents` |

## There is no `tracesSampler` in this repo

One global rate applies to every transaction, so the extension's per-name rate table has no equivalent here. Verified on `main` against the file holding the only `Sentry.init`: exact `tracesSampler\b` returns 0, with `tracesSampleRate` returning 3 as a positive control.

**So "lower the sample rate for this span" is not an available mitigation.** Dropping the global rate to cap one new transaction caps every existing one with it, including whichever names are already the largest. Reaching Tier 2 of the mitigation ladder means adding a `tracesSampler` first, which is a separate change from any PR under review — say so rather than asking an author to sample more.

The nearest name-aware hook is `excludeEvents`, called from `beforeSendTransaction`. It drops by name rather than sampling by name, so it is a per-transaction kill switch and not a rate. A trace-id hash gate there is the cheapest path to a per-name rate.

## Commands

```bash
MOB=<metamask-mobile checkout>

# Span registry (the inventory)
rg -n 'enum TraceName|enum TraceOperation' "$MOB/app/util/trace.ts"

# All span creation sites — then read each enclosing scope for loop/poller/selector
rg -n 'trace\(|sendFinishedTransaction\(' "$MOB/app"

# A `trace` passed as an argument into an existing call — instrumentation with no trace( site
rg -n '\(\s*[^)]*\btrace\b\s*[,)]' "$MOB/app"

# Gate present before the span? (absence = the global rate is the only gate)
rg -n 'tracesSampleRate|tracesSampler|hashBucket|sampleSpan|Math\.random' <call-site-file>

# Kill-switch present?
rg -n 'SENTRY_[A-Z_]*DISABLED|featureFlag|process\.env\.MM_' <call-site-file>

# PR review — added instrumentation lines only
gh pr diff <n> --repo MetaMask/metamask-mobile \
  | rg '^\+' | rg 'TraceName|TraceOperation|trace\(|op:|sendFinishedTransaction'
```

## Architectural Notes

- **Every span counts, transaction or child.** On a span-metered plan a change's cost is its total span count, not its transaction count, so a root plus N children is N+1. A fixed-size child list is still a multiplier on the trigger rate.
- **Denominate against the plan's reserved monthly spans.** Never against a project's current consumption, and never against a sub-population of it such as its existing child spans: those denominators move when other teams ship instrumentation while the numerator stands still, so they rank emitters instead of sizing a change against the budget. Totals live on **Stats & Usage** (accepted spans); Explore's `count_sample()` is what Sentry stored and is for shares between names, not against the plan.
- **Child spans are rare here, which makes a child-heavy change look larger than it is.** Measured 2026-10-13 on project `2299799` over 30d: 54.6M transactions against 12.4M child spans, a ratio of 0.23 children per transaction. A change adding a dozen children per occurrence is a large relative move in that population and can still be a small share of the plan. Report the share of the plan.
- **Durations can ride on the root instead of on child spans.** Where a change emits one child span per stage *and* writes each stage's duration into the root's span data, the children are a waterfall view and the numbers survive without them. That makes dropping the children a visualization decision rather than a measurement one, and it is usually a better lever than cutting the trigger or the rate.
- **Sending already-ended spans as one finished transaction avoids the inherited-decision trap.** A fresh `traceId` per send means the payload does not inherit a long-lived parent trace's sampling decision, which is what makes background traces in other clients emit at full rate inside a sampled parent. Where a change does this, a per-send `Math.random()` roll is correct rather than a defect: the deterministic trace-id hash rule exists to keep gated spans *within one trace* kept or dropped together, and a single-transaction trace has no sibling whose decision could diverge.
