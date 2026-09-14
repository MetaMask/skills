---
repo: metamask-extension
parent: instrumentation
---

## Key Files

| Content | Path |
|---------|------|
| Sentry trace wrapper | `shared/lib/trace.ts` |
| Trace name enum | `shared/lib/trace.ts` → `TraceName` |
| MetaMetrics controller | `app/scripts/controllers/metametrics-controller.ts` |
| Anonymous-event marking (`excludeMetaMetricsId`) | `app/scripts/controllers/analytics/analytics.ts` → `applyAnonymousEventOptions()` |
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

Without propagation: Sentry shows two disconnected operations. With propagation, the background span joins the UI's trace under whichever UI span was active at the call, which is not necessarily the span that caused it. `submitRequestToBackground` attaches a context only when a UI span is active at call time. Without one, `createMetaRPCHandler` runs the handler with no `rpc.handler` span and outside the UI's trace.

## Sentry Sample Rate

```bash
grep -n "tracesSampleRate" app/scripts/lib/setupSentry.js
# The fallback rate. tracesSampler (app/scripts/lib/sentry-traces-sampler.ts) takes precedence over it
```

## Sentry Traces Explorer Query (Volume Estimation)

```
Environment: production | Time range: 30 days | Mode: aggregate
Query: span.op:http.client span.description:*{endpoint}*
Group by: span.description, transaction
Sort: -count(span.duration)
```

## Detect `excludeMetaMetricsId` Misuse

```bash
grep -rn "excludeMetaMetricsId: true" app/ ui/ shared/ --include="*.ts" --include="*.tsx" --include="*.js"
# Each hit sends its event under the shared anonymous id. Confirm the event must not carry identity.
# Event names matching /^send|^confirm/iu are anonymous by default: check new event names too.
```

## Data Council Contact

- Slack: `#metamask-metametrics`
- Team: `@consensys/data-council`
