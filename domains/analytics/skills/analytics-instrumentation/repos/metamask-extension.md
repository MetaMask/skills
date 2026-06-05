---
repo: metamask-extension
parent: analytics-instrumentation
---

## Key Files

| Content | Path |
|---------|------|
| Sentry trace wrapper | `shared/lib/trace.ts` |
| Trace name enum | `shared/lib/trace.ts` → `TraceName` |
| MetaMetrics controller | `app/scripts/controllers/metametrics-controller.ts` |
| Event enum | `shared/constants/metametrics.ts` → `MetaMetricsEventName` |
| Sentry setup + sample rate | `app/scripts/lib/setupSentry.js` → `getTracesSampleRate()` |
| Segment tracking plan | `Consensys/segment-schema` → `tracking-plans/metamask-extension.yaml` |

## Cross-Process Context (UI → Background)

The extension has two Sentry hubs — one in the UI process and one in the background service worker. A trace starting in UI and continuing in background requires explicit context propagation across the RPC boundary:

```typescript
// Serialize at UI call site
const context: SerializedTraceContext = {
  _name: TraceName.MyOperation,
  _traceId: span.spanContext().traceId,
  _spanId: span.spanContext().spanId,
}

// Background receives context, creates child span
trace({ name: TraceName.MyOperation, parentContext: context }, async () => { ... })
```

Without propagation: Sentry shows two disconnected operations. With propagation: complete tree from user action to RPC call.

## Sentry Sample Rate

```bash
grep -n "tracesSampleRate" app/scripts/lib/setupSentry.js
# Verify current value before calculating — it has changed between releases
```

## Sentry Traces Explorer Query (Volume Estimation)

```
Environment: production | Time range: 30 days | Mode: aggregate
Query: span.op:http.client span.description:*{endpoint}*
Group by: span.description, transaction
Sort: -count(span.duration)
```

## Detect `isOptIn` Misuse

```bash
grep -rn "isOptIn: true" app/scripts/ ui/ --include="*.ts" --include="*.tsx"
# Any occurrence outside the onboarding opt-in flow is suspect
```

## Data Council Contact

- Slack: `#metamask-metametrics`
- Team: `@consensys/data-council`
