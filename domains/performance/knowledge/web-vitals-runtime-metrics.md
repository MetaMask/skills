---
name: web-vitals-runtime-metrics
domain: performance
description: Core Web Vitals (INP, TBT) are runtime responsiveness metrics, not just page-load — high-value for extension UX gates
---

# Web Vitals as Runtime Metrics

Core Web Vitals (INP, TBT) measure **runtime responsiveness**, not just page load. For a browser extension this distinction is critical.

- **Page load is less relevant** — the popup opens fast; there's no traditional navigation.
- **Runtime interactions matter** — every button click, form submit, confirmation. INP and TBT measure responsiveness during interactions → high-value for extension UX quality gates.

## Orthogonal to distributed tracing

| | Web Vitals | Distributed Tracing |
|---|---|---|
| Question | "How did the user perceive it?" | "Which controller caused it?" |
| Scope | user perception | operation attribution |
| Granularity | per-interaction aggregate | per-operation breakdown |

Use both — perception (web vitals) + attribution (tracing) — not one instead of the other.
