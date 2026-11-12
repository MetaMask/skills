---
name: auto-instrumentation
domain: observability
description: Which Sentry spans the browser SDK creates with no trace() call, when it creates them, and how a diff with no trace() site still moves span volume
---

# Auto-Instrumentation Coverage

`browserTracingIntegration()` creates most of the spans a browser client sends, and none of them has a `trace(` site. A review that counts only `trace(` sites and `TraceName` entries cannot see a change that makes these spans more frequent.

## What the SDK creates

| Span op | Option (default) | Created when |
|---|---|---|
| `pageload`, `navigation` | `instrumentPageLoad`, `instrumentNavigation` (on) | each page load and each route change. Both are idle spans, active until activity stops |
| `http.client` | `traceFetch`, `traceXHR` (on) | each `fetch` or XHR that starts **while a span is active** and passes `shouldCreateSpanForRequest` |
| `browser.*`, `resource.*`, `paint`, `mark`, `measure` | none; added from Performance API entries when a `pageload` or `navigation` span ends | one span per entry, so per page load or route change |
| `ui.long-animation-frame`, falling back to `ui.long-task` | `enableLongAnimationFrame`, `enableLongTask` (on) | each long frame or task under an active span |
| `ui.interaction.*` | `enableInp` (on) | slow interactions |

Sources, `@sentry/*` [10.38.0](https://github.com/getsentry/sentry-javascript/tree/ed7956a01f3f6962d3e76ebf91dc3683027e71d8):

- defaults: [browserTracingIntegration.ts L316-L326](https://github.com/getsentry/sentry-javascript/blob/ed7956a01f3f6962d3e76ebf91dc3683027e71d8/packages/browser/src/tracing/browserTracingIntegration.ts#L316-L326)
- entries added at span end: [L429-L438](https://github.com/getsentry/sentry-javascript/blob/ed7956a01f3f6962d3e76ebf91dc3683027e71d8/packages/browser/src/tracing/browserTracingIntegration.ts#L429-L438)
- request defaults: [request.ts L126-L127](https://github.com/getsentry/sentry-javascript/blob/ed7956a01f3f6962d3e76ebf91dc3683027e71d8/packages/browser/src/tracing/request.ts#L126-L127)

## The parent condition

The SDK creates an `http.client` span only if a span is active when the request starts ([fetch.ts L106-L109](https://github.com/getsentry/sentry-javascript/blob/ed7956a01f3f6962d3e76ebf91dc3683027e71d8/packages/core/src/fetch.ts#L106-L109), [request.ts L361-L364](https://github.com/getsentry/sentry-javascript/blob/ed7956a01f3f6962d3e76ebf91dc3683027e71d8/packages/browser/src/tracing/request.ts#L361-L364) for XHR). With no active span, the request carries a non-recording span and nothing is sent. A recorded span is kept or dropped with the trace it joins.

Two consequences follow.

- **An `http.client` count is a floor on requests.** Requests that start with no active span leave no span. The count matches the request count only for a call site that always runs inside an active span.
- **A `trace()` callback that awaits requests fans out.** The callback form keeps its span active until the callback settles, so every request inside becomes a child. Spans per trigger is one plus the requests made, and the children are kept at the rate the transaction was drawn at.

## A new timing trace may already be recorded

Before reviewing a new custom span for volume, ask whether an automatic span already records what it times. A time-to-content or load-duration trace usually waits on a request, and that request is often already an `http.client` span with a duration.

1. List the requests the traced interval waits on, in the realm where each one runs. A UI surface can wait on a request the background makes.
2. Query `span.op:http.client` with `span.description` matching each endpoint, grouped by `transaction`, with `p50(span.duration)`. Rows mean the request is already recorded, and the `transaction` column says which spans it is recorded under.
3. For a background request, check whether any row sits under the RPC or controller path the new trace depends on. A background request gets a span only when a span is active there, so a UI trigger can be recorded under a sampled `Background RPC: <method>` wrapper and nowhere else.
4. Put the difference to the author: what the new span measures that those spans do not, such as time in the UI after the response, Redux propagation, or render. A new span that only restates a request duration duplicates volume without adding signal.

Extension instance, 30 days to 2026-09-17: the carousel's Contentful `entries` request (`span.description:*promotionalBanner*`) was recorded under every UI page transaction, with a median of 58 to 78 ms by page. The notification list request (`POST .../api/v4/notifications`) was recorded under background transactions, among them `Background RPC: fetchAndUpdateMetamaskNotifications`. Both were already recorded before a PR added time-to-content spans that wait on them.

## What moves span volume with no `trace(` site

A diff can add spans when it:

- adds a request, or makes one fire more often: a new effect dependency, a refetch on a new trigger, a shorter poll;
- moves a request into a `trace()` callback, or wraps a request-making call in one;
- adds routes, page loads, or images, iframes and scripts to a page, since each Performance API entry becomes a span on sampled page loads;
- changes `browserTracingIntegration()` options or the `shouldCreateSpanForRequest` filter.

Estimate each as requests or entries per trigger × triggers × the kept rate of the trace the span joins. Under a UI `pageload` or `navigation` span that is the default `tracesSampleRate`. Under a context continued as sampled it is close to 1 (`span-sub-sampling`).

## Measured share, extension

In project `metamask` (273505), over the 30 days to 2026-09-17, `http.client` was about nine in ten billed-equivalent child spans. Billed-equivalent means `count()` × client rate, or `count()` where no client rate is recorded. Most of those `http.client` spans had no client rate and sat under background transactions such as `Simulate` and `Smart Transactions: Fetch Liveness`, which make requests inside their callbacks.

Queries: [child spans by op and client rate](https://metamask.sentry.io/explore/traces/?query=environment%3Aproduction+project.id%3A273505+is_transaction%3Afalse&aggregateField=%7B%22groupBy%22%3A%22span.op%22%7D&aggregateField=%7B%22groupBy%22%3A%22client_sample_rate%22%7D&aggregateField=%7B%22yAxes%22%3A%5B%22count%28%29%22%2C%22count_sample%28%29%22%5D%7D&mode=aggregate&sort=-count_sample%28%29&statsPeriod=30d&table=span), [`http.client` with no client rate, by transaction](https://metamask.sentry.io/explore/traces/?query=environment%3Aproduction+project.id%3A273505+span.op%3Ahttp.client+%21has%3Aclient_sample_rate&aggregateField=%7B%22groupBy%22%3A%22transaction%22%7D&aggregateField=%7B%22yAxes%22%3A%5B%22count%28%29%22%2C%22count_sample%28%29%22%5D%7D&mode=aggregate&sort=-count%28%29&statsPeriod=30d&table=span). The window rolls, so re-run them before citing the share.
