---
name: web-vitals-production-vs-benchmarks
domain: performance
description: Web Vitals need different collection in production (web-vitals lib) vs benchmarks (PerformanceObserver); no TBT in prod
---

# Web Vitals — Production vs Benchmarks

Collection differs by environment due to timing constraints.

## Production — `web-vitals` library
- Reports on `visibilitychange` / `pagehide`
- Handles browser quirks, bfcache, session windowing
- Attribution build shows which element/script caused the metric
- Metrics: **INP, LCP, CLS** (not TBT)

**Why no TBT in production:** TBT is cumulative and unbounded — it grows indefinitely over an open-ended session. INP is per-interaction → meaningful for real users. TBT fits bounded flows (benchmarks), not sessions.

## Benchmarks — direct `PerformanceObserver`
- Query on demand (not dependent on page hide)
- Fits an existing `collectMetrics()` pattern
