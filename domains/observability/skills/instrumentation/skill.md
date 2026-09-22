---
maturity: experimental
name: instrumentation
description: Create and update Sentry performance spans, and estimate span or event volume from Sentry span data — methodology, policies, common pitfalls
---

# Sentry Span Instrumentation

## When To Use

- Adding or modifying a Sentry performance span
- Estimating event or span volume from production data
- Auditing existing span instrumentation for correctness

---

## Do Not Use When

- Adding or modifying a MetaMetrics / Segment event (use the `analytics` skill, `platform/analytics`)
- Adding local debug logging with no telemetry destination
- Investigating an existing Sentry error report (use `sentry-mcp-queries`)
- Internal feature flag evaluation not surfaced as an analytics event

---

## Sentry Spans

### Creating a Span

1. **Register a named trace entry** in the repo's trace name enum before writing any span code. Unnamed spans are invisible in Sentry filters.
2. **Use the repo's `trace()` wrapper**, not raw `Sentry.startSpan()`. Wrappers handle cross-process context propagation, active-span inheritance, and consistent tag injection.
3. **Inherit parent automatically** — when no `parentContext` is provided, the wrapper inherits from `Sentry.getActiveSpan()`, making the new span a child of the active parent (e.g., a `pageload` span). That parent is whichever span is active at the call, not necessarily the one that caused the work, which metamask-extension#45527 (stop spans silently attaching to whatever trace happens to be active) proposes to fix. A span started by `trace()` without a callback is active only inside that call, so spans created before its `endTrace()` do not nest under it.

### Updating a Span

- Adding a tag: no governance required
- Renaming a trace name enum entry: grep all callsites; update enum and references atomically
- Changing an `op` value: breaks saved queries and dashboards — coordinate with whoever owns them
- Moving a span's start (`trace()`) or end (`endTrace()`): changes what its duration measures, so a release-over-release delta mixes a performance change with a definition change

---

## Volume Estimation via Sentry

When direct Segment access is unavailable, estimate from Sentry production span data:

1. **Find a correlated HTTP endpoint** — one that fires 1:1 with the event.
2. **Query Sentry Traces Explorer** (aggregate mode):
   ```
   span.op:http.client span.description:*{endpoint}*
   ```
3. **Read the `count()` aggregate.** Span datasets already extrapolate it by each span's sample weight, so it is the estimate. Do not multiply it by `1 / tracesSampleRate`, which extrapolates twice.
4. **Interpret as upper bound** — endpoint may have callers outside the event path.

Caveats: sample population is MetaMetrics opted-in users only. The extension's Sentry integration drops every event unless `consentDecisionMade && optedIn`, and Segment gates differently, so attribution across the two pipelines holds at install granularity, not per session. For longer-range (30D+) or release-over-release queries, the sampled count is **not** comparable at face value — older releases are downsampled / retention-truncated and `.0` releases are sample-thin; see `sentry-mcp-queries` (Longer-Range Queries and Percentile Fidelity) and the `performance-attribution` skill.

---

## Common Pitfalls

| Mistake | Correct Approach |
|---------|-----------------|
| Raw `Sentry.startSpan()` instead of the repo's `trace()` wrapper | Use the wrapper — handles cross-process context and active-span inheritance |
| New span with no trace name enum entry | Register enum entry first; unnamed spans are invisible in Sentry filters |
| Multiply a span `count()` by `1 / tracesSampleRate` | `count()` is already extrapolated, so read it as the estimate |
| Treat Sentry estimates as exact counts | Probabilistic sample — state sample size and confidence |
