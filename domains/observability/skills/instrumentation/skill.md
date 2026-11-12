---
maturity: experimental
name: instrumentation
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

1. **Check what already records this interval.** Most spans a browser client sends have no `trace()` site: `pageload`, `navigation`, `http.client` and the Performance API entries all come from `browserTracingIntegration()`. A timing span that waits on a request is usually waiting on one that already carries an `http.client` span with a duration. Query `span.op:http.client` with `span.description` matching each endpoint the interval waits on, grouped by `transaction`. Rows mean the timing exists; the new span then has to measure something those do not, and the PR should say what. See `auto-instrumentation`.
2. **Register a named trace entry** in the repo's trace name enum before writing any span code. Unnamed spans are invisible in Sentry filters.
3. **Use the repo's `trace()` wrapper**, not raw `Sentry.startSpan()`. Wrappers handle cross-process context propagation, active-span inheritance, and consistent tag injection.
4. **Inherit parent automatically** — when no `parentContext` is provided, the wrapper inherits from `Sentry.getActiveSpan()`, making the new span a child of the active parent (e.g., a `pageload` span). That parent is whichever span is active at the call, not necessarily the one that caused the work, which metamask-extension#45527 (stop spans silently attaching to whatever trace happens to be active) proposes to fix. A span started by `trace()` without a callback is active only inside that call, so spans created before its `endTrace()` do not nest under it.

### Updating a Span

- `trace()` takes `tags`, `endTrace()` takes `data`. There is no post-start tag path, so a value that must be a tag has to be known when `trace()` is called
- A `tags` entry is routed by the type of its value. A non-numeric value becomes a tag; a numeric one is skipped and set as a Sentry measurement instead, so it never becomes filterable as a tag. Put a number in `tags` only when a measurement is what you want
- Adding a tag: no governance required
- Renaming a trace name enum entry: grep all callsites; update enum and references atomically
- Changing an `op` value: breaks saved queries and dashboards — coordinate with whoever owns them
- Moving a span's start (`trace()`) or end (`endTrace()`): changes what its duration measures, so a release-over-release delta mixes a performance change with a definition change

### Timing To Content

**End the span on the state the UI renders from, not on the request settling.** A loading flag flips when the response arrives; the data reaches the component later. In metamask-extension the background's `sendUpdate` is debounced 200 ms with a 1 s `maxWait`, so a span ending on a loading flag excludes 200 to 1000 ms plus render. That excluded window is the only part an `http.client` span does not already cover, so the span measures time-to-response under a time-to-content name.

**Falsifier, before the span ships:** on a cold load, assert the content is in the store at the moment `endTrace` runs. If it is not, the end condition is wrong. A test that only asserts the span ended cannot see this.

### Cross-Platform Parity

**Parity is a property of the definition, not of the name.** Two platforms sharing a trace name and an `op` produce one queryable series, so a dashboard puts them side by side whatever the code does. They are comparable only if the start point, the end condition and every tag derivation match.

- Read the other platform's implementation before choosing the name, not after.
- A tag derived differently means one value selects different populations. Extension and mobile both emit `source: cold|warm` under `notification.performance`: mobile takes `cold` from the render immediately before the span ends, the extension from any loading render since the span started, and the extension span also waits on `isPending`, so it ends at least a render later.
- Where the thing timed differs, no naming makes the numbers comparable. Mobile's banner trace times a Braze banner with SDK targeting in its path; the extension carousel times a Contentful fetch.

---

## MetaMetrics / Segment Events

### Creating an Event

1. **Check the event name enum** — event may already exist under a different phrasing.
2. **Check the segment tracking plan** — event may be registered under a different name than the enum key.
3. **Add to the enum**, then implement the `trackEvent` call.
4. **Pass `excludeMetaMetricsId: true` only for an event that must not carry the user's identity.** It sends the event under the shared anonymous id and drops the profile ids, for every user, not only those who have not opted in. Event names matching `/^send|^confirm/iu` get it by default unless the caller passes `excludeMetaMetricsId: false` (see data domain `knowledge/metrametrics-identity.md`).
5. **Open a data governance review** before merging. There is usually no CI enforcement on schema registration — this step is easy to skip (see data domain `knowledge/segment-governance.md`).
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
3. **Read the `count()` aggregate.** Span datasets already extrapolate it by each span's sample weight, so it is the estimate. Do not multiply it by `1 / tracesSampleRate`, which extrapolates twice.
4. **Interpret as upper bound** — endpoint may have callers outside the event path.

Caveats: sample population is MetaMetrics opted-in users only. The extension's Sentry integration drops every event unless `consentDecisionMade && optedIn`, and Segment gates differently, so attribution across the two pipelines holds at install granularity, not per session. For longer-range (30D+) or release-over-release queries, the sampled count is **not** comparable at face value — older releases are downsampled / retention-truncated and `.0` releases are sample-thin; see `sentry-mcp-queries` (Longer-Range Queries and Percentile Fidelity) and the `performance-attribution` skill.

---

## Common Pitfalls

| Mistake | Correct Approach |
|---------|-----------------|
| `excludeMetaMetricsId: true` on an event that needs user identity | It sends the event under the shared anonymous id for every user. Reserve it for events that must be anonymous |
| Ship event without tracking-plan registration | No CI gate — add governance review explicitly to PR checklist |
| Raw `Sentry.startSpan()` instead of the repo's `trace()` wrapper | Use the wrapper — handles cross-process context and active-span inheritance |
| New span with no trace name enum entry | Register enum entry first; unnamed spans are invisible in Sentry filters |
| Multiply a span `count()` by `1 / tracesSampleRate` | `count()` is already extrapolated, so read it as the estimate |
| Treat Sentry estimates as exact counts | Probabilistic sample — state sample size and confidence |
| New timing span for a request that already has an `http.client` span | Query the endpoint first, and say what the new span measures that the automatic one does not |
| Span ends when the fetch settles, under a "time to content" name | End on the state the UI renders from; a debounced store update sits between the response and the render |
| Same trace name as another platform, different end condition or tag derivation | Parity is the definition. Match start, end and every tag, or use a different name |
| A value that must be a tag, passed to `endTrace` | `tags` are start-only via `scope.setTag`; `endTrace` data becomes attributes |
| Effect that owns a span listing dependencies it never reads | React Compiler's effect-dependency validation errors and skips the whole function, so the hook ships unmemoized behind a green build |
