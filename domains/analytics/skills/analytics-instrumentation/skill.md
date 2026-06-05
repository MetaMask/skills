---
maturity: experimental
name: analytics-instrumentation
description: Create and update Sentry spans, MetaMetrics events, and Segment events — methodology, policies, common pitfalls
---

# Analytics Instrumentation

## When To Use

- Adding or modifying a MetaMetrics (Segment) event
- Adding or modifying a Sentry performance span
- Estimating event or span volume from production data
- Auditing existing instrumentation for correctness

---

## Do Not Use When

- Adding local debug logging with no telemetry destination
- Investigating an existing Sentry error report (use `sentry-mcp-queries`)
- Internal feature flag evaluation not surfaced as an analytics event

---

## Sentry Spans

### Creating a Span

1. **Register a named trace entry** in the repo's trace name enum before writing any span code. Unnamed spans are invisible in Sentry filters.
2. **Use the repo's `trace()` wrapper**, not raw `Sentry.startSpan()`. Wrappers handle cross-process context propagation, active-span inheritance, and consistent tag injection.
3. **Inherit parent automatically** — when no `parentContext` is provided, the wrapper inherits from `Sentry.getActiveSpan()`, making the new span a child of the active parent (e.g., a `pageload` span).

### Updating a Span

- Adding a tag: no governance required
- Renaming a trace name enum entry: grep all callsites; update enum and references atomically
- Changing an `op` value: breaks saved queries and dashboards — coordinate with whoever owns them

---

## MetaMetrics / Segment Events

### Creating an Event

1. **Check the event name enum** — event may already exist under a different phrasing.
2. **Check the segment tracking plan** — event may be registered under a different name than the enum key.
3. **Add to the enum**, then implement the `trackEvent` call.
4. **Do NOT use `isOptIn: true` outside the onboarding opt-in flow.** It strips user identity unconditionally for all users, not just non-opted-in ones (see Reference Knowledge: metrametrics-identity).
5. **Open a data governance review** before merging. There is usually no CI enforcement on schema registration — this step is easy to skip (see Reference Knowledge: segment-governance).
6. **Register in the team's segment tracking plan** before shipping.

### Updating an Event

- Adding a property: requires governance review and schema update
- Renaming an event: deprecate old + add new in tracking plan; coordinate on migration window
- Removing an event: confirm no active dashboards depend on it before removing

---

## Volume Estimation via Sentry

When direct Segment access is unavailable, estimate from Sentry production span data:

1. **Find a correlated HTTP endpoint** — one that fires 1:1 with the event.
2. **Query Sentry Traces Explorer** (aggregate mode):
   ```
   span.op:http.client span.description:*{endpoint}*
   ```
3. **Extrapolate:**
   ```
   estimated_actual = sampled_count × (1 / tracesSampleRate)
   ```
4. **Interpret as upper bound** — endpoint may have callers outside the event path.

Caveats: sample population is MetaMetrics opted-in users only; verify the current `tracesSampleRate` before calculating (it changes between releases).

---

## Common Pitfalls

| Mistake | Correct Approach |
|---------|-----------------|
| `isOptIn: true` on post-onboarding events | Strips user identity for all users; only valid in onboarding flow |
| Ship event without tracking-plan registration | No CI gate — add governance review explicitly to PR checklist |
| Raw `Sentry.startSpan()` instead of the repo's `trace()` wrapper | Use the wrapper — handles cross-process context and active-span inheritance |
| New span with no trace name enum entry | Register enum entry first; unnamed spans are invisible in Sentry filters |
| Multiply sampled count by `tracesSampleRate` | Multiply by inverse: `sampled × (1 / rate)` |
| Treat Sentry estimates as exact counts | Probabilistic sample — state sample size and confidence |
