---
maturity: experimental
name: benchmark-design
description: Design, run, and analyze E2E performance benchmarks — session hygiene, per-round reporting, artifact grouping
---

# Benchmark Design

## When To Use

- Writing a new E2E benchmark flow
- Interpreting or presenting benchmark results
- Adding new metrics to existing benchmarks
- Diagnosing unexpected benchmark results

## Do Not Use When

- Adding unit, integration, or correctness E2E tests
- Profiling a single user-reported slowdown (use `selector-anti-pattern-review`)
- Writing micro-benchmarks outside the E2E harness

## Workflow

1. **Design the flow** — target ONE optimization vector per benchmark. Maximize ratio of optimization-affected time to total measured time.
2. **Run reference benchmarks first** in any session — session state degrades over time.
3. **Compute per-round statistics** before pooling. Check each round for stability (CV < 0.3 is a reasonable threshold).
4. **Group artifacts by timestamp**, not filename sort order.
5. **Report per-metric best subset** with explicit round attribution. Show pooled data as supplementary.

## Flow Design by Optimization Type

| Optimization | Primary cascade vector | Recommended flow |
|---|---|---|
| Selector memoization | State mutations | Multi-confirmation queue |
| Context memoization | Any state update | Account switching cycle |
| HOC stabilization | Route changes | Rapid route cycling (8+ transitions) |
| Dead code removal | Navigation | Return-to-home timer |

## Session Hygiene

System state degrades over long sessions — background load and memory pressure inflate variance and can **invert** treatment effects.

- Run reference/critical benchmarks first
- If a late round contradicts clean earlier rounds, suspect session degradation before re-running the full suite

## Artifact Grouping

Filenames use `{test}-iteration-{N}-{ISO-timestamp}.json`. Unpadded N produces incorrect lexicographic sort.

```javascript
// Extract seconds-since-midnight for round assignment
const match = filename.match(/T(\d{2})-(\d{2})-(\d{2})/);
const secondsOfDay = +match[1] * 3600 + +match[2] * 60 + +match[3];
// Group by time range — never by filename position or array index
```

## Adding Metrics

Extend `collectMetrics()` in `test/e2e/webdriver/driver.js` and register the metric key in `test/e2e/benchmarks/utils/constants.ts` → `ALL_METRICS`.

- **Performance API metrics** (paint, navigation timing): collect directly inside `collectMetrics()` via `window.performance.getEntriesByType(...)`.
- **Long Task / TBT metrics**: already wired — `collectMetrics()` reads `window.stateHooks.getLongTaskMetricsWithTBT()`. Adding new long-task-derived metrics requires extending the `stateHooks` observer, not the driver.

## Common Pitfalls

| Mistake | Correct Approach |
|---------|-----------------|
| Pool all rounds before checking per-round stats | Per-round first — late-session noise can invert the treatment effect |
| Sort artifacts by filename | Extract ISO timestamp; sort by numeric time value |
| Benchmark flow that exercises multiple vectors | One vector per flow — mixed flows produce ambiguous signal |
| Report pooled p-value as primary result | Report cleanest per-metric signal with round attribution; pooled is supplementary |
