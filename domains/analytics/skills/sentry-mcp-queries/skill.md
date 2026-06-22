---
maturity: experimental
name: sentry-mcp-queries
description: Query Sentry via MCP — error triage, tag distribution, volume estimation, replay retrieval
---

# Sentry MCP Queries

## When To Use

- Investigating a production error before attributing root cause
- Checking dist (MV3 vs MV2) error distribution
- Estimating event or span volume from production data
- Comparing error rates release-over-release for regression detection
- Retrieving session replay or profiling data

## Do Not Use When

- The error reproduces locally with a full stack trace
- Reading product analytics (Segment events, not Sentry errors/spans)
- Pre-merge investigation — Sentry data is post-merge only

## Setup

Run once per session:

```
mcp__sentry__whoami            → confirm auth
mcp__sentry__find_organizations → org slug
mcp__sentry__find_projects     → project slug(s)
```

All subsequent tools require `organization_slug` and usually `project_slug`. Slug mismatch causes silent empty results.

## Workflow: Error Triage

1. `mcp__sentry__search_issues` — find by title, fingerprint, or keyword
2. `mcp__sentry__get_issue_tag_values` — check `dist` distribution **before** attributing root cause
3. If 99%+ one dist → platform lifecycle root cause (see `extension-errors-debugging`)
4. `mcp__sentry__search_issue_events` — individual events for stack trace detail
5. `mcp__sentry__analyze_issue_with_seer` — AI-assisted hypothesis (validate against code)

## Workflow: Volume Estimation

Segment event volume is invisible from Sentry, but a correlated `http.client` span is not. Anchor estimation on an HTTP endpoint the event's controller calls **1:1** with the event firing.

1. Identify the correlated endpoint — the one that fires **once per event**, not per sub-call (e.g. a per-init call, not a per-account call). Picking a per-sub-call endpoint over-counts.
2. `mcp__sentry__search_events` aggregate mode, filter `span.op:http.client` + endpoint
3. Read sampled span count
4. Extrapolate: `estimated = sampled × (1 / tracesSampleRate)`
5. Treat as an **upper bound** — the endpoint may have callers beyond the event path. Sample population = MetaMetrics-opted-in users only (Sentry opt-in is tied to MetaMetrics). Sample rate changes — verify the current value.

## Workflow: Release Comparison

Compare error rates or metrics across releases for regression detection:

1. `mcp__sentry__find_releases` — list releases sorted by date
2. **Filter out unreliable releases** (see below) before comparing
3. `mcp__sentry__search_events` with `release:12.5.0` for baseline
4. `mcp__sentry__search_events` with `release:12.6.0` for comparison
5. **Normalize by sessions or users** — raw counts conflate traffic changes with error rate changes:
   ```
   rate = events / sessions_for_that_release
   ```
6. Report delta against baseline with sample-size caveat

## Filtering Unreliable Releases

Patch releases have uneven adoption — comparing raw counts against them produces false signal. Skip a release before comparing if:

| Filter | Threshold | Reason |
|---|---|---|
| Age since publish | < 48–72h | Browser auto-update rollout still ramping (Chrome/Firefox/Edge) |
| Session count | < ~50% of previous stable release | Sample too small for meaningful rates |
| Stored span count | < ~few hundred for p75, < ~few thousand for p95+ | Tail percentiles are computed over the *stored* sample — extrapolated counts hide how few events back them |
| Superseded patch | a higher patch in the same `X.Y.*` line exists **and** the active window (`first_seen`→`last_seen`) is short | Hotfixed-past releases collect few spans, biased to early-updaters during the rollout/migration window |
| Release stage | `dev`, `canary`, `nightly` | Non-production build — different error profile |
| Environment | not `production` | Development / staging noise |
| Manifest split | compare only within same `dist` | MV3 and MV2 populations have different error distributions |

**Rule of thumb:** use the newest release that has ≥ 3 days of production adoption **and** session volume comparable to the previous stable release. Everything in between is hotfix noise — skip it for regression comparisons unless investigating that specific patch.

## Longer-Range (30D+) Queries and Percentile Fidelity

Widening the window past ~30 days to gain sample size trades it back for **fidelity loss on older releases**. Three effects compound:

- **Sample-rate drift** — `tracesSampleRate` changes between releases, so absolute span counts across a 30D+ window mix different capture rates. Normalize each release by *its own* sample rate (or by sessions/users), never a single global rate.
- **Extrapolation hides thin samples** — span datasets report sample-rate-weighted (extrapolated) counts. A release with 40 stored spans at 0.75% extrapolates to ~5,300 — a real-looking number backed by 40 events. Always check the **stored** sample count, not the extrapolated total, before trusting a release.
- **Retention downsampling** — spans near the retention boundary are partially evicted, so an old release's count is truncated, not representative. Treat the oldest releases in a 30D+ window as lower bounds only.

**For p75+ analysis** (any tail percentile — p75/p90/p95/p99), sample size *and* quality both matter:

- **Size** — percentiles are computed over stored events. p50 stabilizes in the low hundreds; p75 needs more; p95/p99 need thousands of stored spans. Below that, a handful of outliers move the number — don't report a tail percentile you can't back with stored count.
- **Quality** — rollout-window spans (first-launch, cold cache, state migration) skew the tail high. A superseded patch release's spans are disproportionately these, so its p75+ reads worse than its steady state would.

**Resolving the size-vs-fidelity tension:** when a single release lacks the sample to support p75+, **collapse the patch chain** — aggregate `release:X.Y.*` across the minor line, or compare against the last *widely-adopted* patch — rather than extending the window into aged, downsampled, sample-rate-drifted territory. Reach for sample size *across adjacent stable patches inside the retention-safe window*, not by going further back in time. Use a longer (90d) window as the **primary, comparable-across-releases** source for p75/p95 and a 30d window only as **secondary context** — 30d over-weights the users still lingering on old versions and inflates baselines.

For attributing a confirmed p75/p95 movement to specific code changes, see the `performance-attribution` skill.

## Workflow: Replay and Profile

1. `mcp__sentry__search_issue_events` — find an event ID with replay/profile
2. `mcp__sentry__get_replay_details` / `mcp__sentry__get_profile_details` for that event ID

## Tag Filters

| Tag | Values | Use |
|-----|--------|-----|
| `dist` | `mv3`, `mv2` | Isolate by manifest version |
| `environment` | `production`, `staging` | Exclude non-prod noise |
| `installType` | `normal`, `development`, `sideload`, `admin` | Exclude developer-loaded builds |

**Do not conflate `environment` and `installType`** — a production build can have `installType:development` if loaded unpacked.

## Common Pitfalls

| Mistake | Correct Approach |
|---------|-----------------|
| Attribute root cause before checking `dist` distribution | Check tag values first — 99%+ MV3 → lifecycle, not app logic |
| Use raw sampled count as event volume | Multiply by `1 / tracesSampleRate` |
| Filter `environment:development` for dev builds | Filter `installType:normal` — environment ≠ install method |
| Skip `whoami` and guess org slug | Slug mismatch causes silent empty results |
| Treat Seer analysis as ground truth | Use as hypothesis to validate against code/traces |
| Compare raw event counts across releases | Normalize by sessions — traffic changes masquerade as regressions |
| Include a <48h-old release in a regression comparison | Wait for rollout; auto-update adoption takes 2–7 days |
| Treat every patch release as a comparison point | Most patches have low adoption — compare to the last *widely-adopted* release |
| Trust a release's p95 because its (extrapolated) span count looks large | Check the *stored* sample — p75+ needs hundreds-to-thousands of stored events to be stable |
| Compare span counts across a 30D+ window at face value | Normalize per-release sample rate; older releases are downsampled / retention-truncated |
| Anchor a percentile on a `.0` release | `.0` releases have 10–100× fewer samples — use the highest-sample patch in the minor line |
