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
| Release stage | `dev`, `canary`, `nightly` | Non-production build — different error profile |
| Environment | not `production` | Development / staging noise |
| Manifest split | compare only within same `dist` | MV3 and MV2 populations have different error distributions |

**Rule of thumb:** use the newest release that has ≥ 3 days of production adoption **and** session volume comparable to the previous stable release. Everything in between is hotfix noise — skip it for regression comparisons unless investigating that specific patch.

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
