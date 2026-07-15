---
name: metrics-pipeline-design
domain: performance
description: Four-layer metric pipeline architecture for E2E benchmarks, with domain-specific statistical bounds and split reporting paths.
---

# Metrics Pipeline Design

Architecture for adding metric types to an E2E benchmark suite. Separates collection, running, statistics, and reporting into independent layers.

## Architecture

```
Collector → Runner → Statistics → Reporter
```

| Layer | Responsibility |
|-------|----------------|
| **Collector** | Extract raw metric from browser/extension per iteration |
| **Runner** | Per-iteration capture + aggregation orchestration |
| **Statistics** | Domain-specific filtering, outlier detection, percentiles |
| **Reporter** | Per-run spans (for quality gate comparison) + aggregated structured logs (for dashboards) |

Flow files call the collector and return snapshots alongside timers. No flow file does statistics or reporting.

## Adding a New Metric Type

1. **Create collector** — function returning typed snapshot with nullable fields for unobserved metrics
2. **Define types** — per-run snapshot, aggregated (reuse `TimerStatistics` for numeric fields), summary
3. **Add domain-specific bounds** — each numeric field gets `{ min, max, allowZero }`
4. **Wire into runner** — collect alongside timers, call aggregation
5. **Add reporter** — per-run spans with `setMeasurement`, aggregated summary as structured log

## Domain-Specific Statistical Bounds

Generic timer bounds (1ms–120s, zero=invalid) silently discard valid data from other domains.

```typescript
// WRONG: CLS values (0–1) all rejected by min=1ms floor
const result = filterBySanityChecks(clsValues); // → empty array

// RIGHT: per-metric bounds
const BOUNDS = {
  inp: { min: 1, max: 30_000, allowZero: false },  // ms
  lcp: { min: 1, max: 60_000, allowZero: false },  // ms
  cls: { min: 0, max: 10,     allowZero: true  },  // unitless ratio
};
```

**Rule:** When adding a new metric type, verify whether existing `filterBySanityChecks` assumptions (ms units, zero=invalid) hold. If not, define metric-specific bounds.

`allowZero` is the critical distinction: CLS=0 means perfect stability (valid); timer=0ms means measurement error (invalid).

## Split Reporting Path

| Data | Mechanism | Rationale |
|------|-----------|-----------|
| Aggregated statistics (mean, p75, p95) | Structured log | Low cardinality, dashboard-friendly |
| Per-run snapshots | Sentry spans + `setMeasurement` | Preserves granularity, enables quality gate comparison via Mann-Whitney U |

`tracesSampleRate: 1.0` required in CI so all per-run spans are captured.

## SDK Isolation Pattern

When CI benchmark scripts run in Node but the extension uses a browser SDK (e.g. `@sentry/node` vs `@sentry/browser`): these never share a process. The package manager resolves separate versions per dependency tree. No compatibility issue — they are fully isolated under different lockfile entries.

Risk: a shared module accidentally importing from the wrong SDK at bundle time. Mitigation: keep the CI SDK as a devDependency excluded from extension builds.
