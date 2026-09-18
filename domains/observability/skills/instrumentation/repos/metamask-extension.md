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
| Sentry `user.id` (set to the MetaMetrics `analyticsId`) | `app/scripts/lib/sentry-metametrics.ts` → `metaMetricsIntegration()` |
| Segment tracking plan | `Consensys/segment-schema` → `tracking-plans/metamask-extension.yaml`, which lists event libraries. Event definitions live in `libraries/events/<library>/` |

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

The serialized context carries no sampled flag, so the background continues every propagated trace as sampled. `tracesSampler` then keeps the background span at rate 1 unless a per-name override or a ceiling applies, so background spans can be stored for a trace whose UI root was sampled out.

The UI and background timestamps do not share a clock. In 17 of 96 measured traces they disagreed by up to 67 minutes, so a duration computed across the boundary is not reliable.

## Span Tags, Data and Measurements

`trace()` routes `tags` by the type of each value, and the field name does not show the split. Non-numeric values reach `scope.setTag` in [`initScope`](https://github.com/MetaMask/metamask-extension/blob/e24e5a017af7a84eeaac7f4f6053eb83cd237f5c/shared/lib/trace.ts#L618-L626). Numeric values never become tags: [`initSpan`](https://github.com/MetaMask/metamask-extension/blob/e24e5a017af7a84eeaac7f4f6053eb83cd237f5c/shared/lib/trace.ts#L635-L643) passes them to `sentrySetMeasurement(key, value, 'none')` so they can be queried numerically, which also means a numeric tag will not match a tag filter.

`trace()` takes `data` as well, and it becomes the span's `attributes` at creation in [`startSpan`](https://github.com/MetaMask/metamask-extension/blob/e24e5a017af7a84eeaac7f4f6053eb83cd237f5c/shared/lib/trace.ts#L536-L560).

`endTrace()` takes its own `data` and applies it with `span.setAttribute` immediately before ending the span, at [trace.ts L303-L308](https://github.com/MetaMask/metamask-extension/blob/e24e5a017af7a84eeaac7f4f6053eb83cd237f5c/shared/lib/trace.ts#L303-L308).

`scope.setTag` is called in one place in the file and `initScope` runs only from `startSpan`, so no path adds a tag after start. A value that must be a tag has to be known when `trace()` is called.

## `endTrace()` No-Ops

The pending trace is keyed `<name>:<id>`, with `id` defaulting to `'default'` ([trace.ts L125](https://github.com/MetaMask/metamask-extension/blob/e24e5a017af7a84eeaac7f4f6053eb83cd237f5c/shared/lib/trace.ts#L125), [L596-L605](https://github.com/MetaMask/metamask-extension/blob/e24e5a017af7a84eeaac7f4f6053eb83cd237f5c/shared/lib/trace.ts#L596-L605)). [`endTrace`](https://github.com/MetaMask/metamask-extension/blob/e24e5a017af7a84eeaac7f4f6053eb83cd237f5c/shared/lib/trace.ts#L292-L301) looks that key up in `tracesByKey`, and on a miss it logs `No pending trace found` and returns without ending anything. A mismatched `id` between `trace()` and `endTrace()` produces no span and no error, so nothing reaches Sentry and the case is indistinguishable there from a span that was never started.

[`startTrace`](https://github.com/MetaMask/metamask-extension/blob/e24e5a017af7a84eeaac7f4f6053eb83cd237f5c/shared/lib/trace.ts#L442-L468) writes `tracesByKey` unconditionally, so a second `trace()` under the same name and `id` overwrites the first entry. The first span becomes unreachable by `endTrace` and never ends. Concurrent traces sharing a name need distinct `id` values.

The `data` block in `endTrace` is additionally guarded on `pendingTrace.span`, which is `null` when `globalThis.sentry` is absent ([trace.ts L693-L704](https://github.com/MetaMask/metamask-extension/blob/e24e5a017af7a84eeaac7f4f6053eb83cd237f5c/shared/lib/trace.ts#L693-L704)). That is the Sentry-not-loaded case, not the sampled-out case.

## Debounced Background State Update

`sendUpdate` is a debounced wrapper, `MILLISECOND * 200` with `{ maxWait: SECOND }`, assigned in the controller constructor at [metamask-controller.js L465-L469](https://github.com/MetaMask/metamask-extension/blob/e24e5a017af7a84eeaac7f4f6053eb83cd237f5c/app/scripts/metamask-controller.js#L465-L469). The underlying [`privateSendUpdate`](https://github.com/MetaMask/metamask-extension/blob/e24e5a017af7a84eeaac7f4f6053eb83cd237f5c/app/scripts/metamask-controller.js#L6218-L6220) is what emits `update` with `this.getState()`.

A UI loading flag flips when the RPC response arrives, but the data reaches the Redux store only on that debounced update. A span ending on a loading flag therefore excludes 200 to 1000 ms plus render, and measures time to response under a time to content name.

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
