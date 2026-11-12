---
repo: metamask-extension
parent: sentry-quota
---

## File Paths

| Path | Role |
|---|---|
| `shared/lib/trace.ts` | `TraceName` / `TraceOperation` enums = the custom-span registry; `trace({ name, op, data }, cb)` API |
| `shared/lib/wrapper-sampling.ts` | `shouldSampleWrappers(traceId)` — the Tier-2 deterministic sub-sample gate |
| `shared/lib/messenger-tracing.ts` | `wrapMessengerWithTracing` + `isReadOnlyAction` read-only denylist (~90% volume cut before sampling) |
| `app/scripts/lib/createMetaRPCHandler.ts` | `rpc.handler` span — gated behind `shouldSampleWrappers` |
| `app/scripts/lib/setupSentry.js` | global `tracesSampleRate` fallback (`0.005` = 0.5%); `browserTracingIntegration()` options, with `enableLongAnimationFrame: true`; and `shouldCreateSpanForRequest`, which drops `http.client` spans for `sentry.io`, `segment.io`, `chainid.network`, `acl.execution.metamask.io` and extension-local snap, locale and hashed-bundle reads. Any other request under an active span is a span |
| `app/scripts/lib/sentry-traces-sampler.ts` | `tracesSampler`: per-name rates (`DEFAULT_TRANSACTION_SAMPLE_RATES`) and the remote-rate ceiling. It takes precedence over `tracesSampleRate` |

Core controller instrumentation lives in the **`MetaMask/core`** monorepo: per-package `TraceName` in `packages/<pkg>/src/**/{constants/traces,utils/trace}.ts` (e.g. `bridge-controller/src/constants/traces.ts`). Controllers don't import Sentry — they call an injected `trace` callback (`traceAsControllerCallback` in the extension).

## Commands

```bash
EXT=<metamask-extension checkout>
CORE=<core monorepo checkout>

# Span registries (the inventory)
rg -n 'enum TraceName' "$EXT/shared/lib/trace.ts"
rg -n -g '**/{traces,trace}.ts' 'enum TraceName' "$CORE/packages"

# Locate a culprit's emit site
rg -n '<SpanName>|TraceName.<SpanName>' "$EXT" "$CORE/packages"

# All span creation sites — then read each enclosing scope for loop/poller (fan-out)
rg -n 'trace\(' "$EXT/app" "$EXT/shared" "$CORE/packages/<pkg>/src"

# Gate present before the span? (absence = always-on)
rg -n 'shouldSample|tracesSampleRate|hashBucket|Math.random' <call-site-file>

# Kill-switch present?
rg -n 'SENTRY_[A-Z_]*DISABLED' "$EXT" "$CORE/packages/<pkg>/src"

# PR review — added requests, which become automatic http.client spans under an active span
gh pr diff <n> --repo MetaMask/metamask-extension \
  | rg '^\+' | rg 'fetch\(|fetchWithCache|XMLHttpRequest|setInterval|startPolling|setIntervalLength'

# PR review — added instrumentation lines only
gh pr diff <n> --repo MetaMask/metamask-extension \
  | rg '^\+' | rg 'TraceName|trace\(|shouldSampleWrappers|SENTRY_.*DISABLED|op:'
```

## Architectural Notes

- **Gate location differs by repo.** Extension spans go through `trace()` — gate at the call site or in the wrapper. Core controller spans go through the injected callback — gate in the package's trace util or the callback so every consumer (extension, mobile) inherits the cap.
- **`BackgroundRpc` / `MessengerCall`** (the `TraceName` tail) are the already-gated wrapper spans from [PR #39891](https://github.com/MetaMask/metamask-extension/pull/39891) — the reference implementation of the Tier-2 sub-sample pattern and the `SENTRY_DISTRIBUTED_TRACING_DISABLED` kill-switch.
- **Tier-0 fix path is a core PR + a patch on the extension release branch.** Controller instrumentation originates in `MetaMask/core`; the release branch is where the cherry-pick lands. The sev-1 blocker goes on the in-flight release milestone — e.g. [issue #43211](https://github.com/MetaMask/metamask-extension/issues/43211) ("Assets Controller Sentry Instrumentation exceeding quota").
- **Spotting the culprit first:** `sentry-mcp-queries` → Volume Estimation (`span.op` aggregate `count()`) ranks span contributors by span count; this skill takes over once you have the offending span name. A span-count ranking is not a ranking by billed volume: retention differs per name, so no single factor rescales it, and on a plan metered in transactions it can invert.

## Requests Already Recorded as `http.client` Spans

A PR adding a timing span around a request is reviewed against what the request already records. The procedure is in `knowledge/auto-instrumentation.md` and the query that runs it is `sentry-mcp-queries` → Checking Whether an Endpoint Already Has Timings. The extension supplies a measured instance of each answer, one where the spans that exist are enough and one where they are not.

Both requests were already recorded before a PR proposed adding custom time-to-content spans that wait on them.

Figures are `environment:production`, project `metamask` (273505), window 2026-08-19 to 2026-09-17, grouped by `transaction`. Counts move with the window, so re-run before citing them.

No Sentry Explore link is given, deliberately. Explore takes a relative `statsPeriod`, so a constructed URL would return a different window from the figures printed here and read as a citation that refutes them. Reproduce these through the events API with an absolute window, and check `meta.dataScanned` is `full`.

### `promotionalBanner`: already under the transaction a new span would measure

```
span.op:http.client span.description:*promotionalBanner*
```

This is the Contentful `entries` request the carousel issues from the UI process ([`fetchCarouselSlidesFromContentful.ts` L132-L136](https://github.com/MetaMask/metamask-extension/blob/7d02d2d041b0d7817c577b2dd893dc7db42060a3/ui/hooks/useCarouselManagement/fetchCarouselSlidesFromContentful.ts#L132-L136)). 26,251,098 spans over 6 transactions. Four of the six are page transactions and hold all but 13,694 of the total.

| transaction | spans | p50 |
|---|---|---|
| `/sidepanel.html` | 21,882,917 | 60.7 ms |
| `/popup.html` | 2,918,216 | 77.2 ms |
| `/home.html` | 1,422,554 | 57.5 ms |
| `/notification.html` | 13,717 | 51.8 ms |

The other two are `UI Startup` at 12,554 and `Bridge Balances Updated` at 1,140.

The request runs in the UI process, so its span is already a child of the page transaction a time-to-content span would be measuring. The per-page duration is readable today, by page, from the table above. A new name over that interval adds a label rather than a measurement, and the reviewer's question to the author is what it measures that the `p50` column does not, such as time after the response in Redux propagation or render.

### `POST /api/v4/notifications`: recorded, but under whichever trace was active

```
span.op:http.client span.description:*notification*
```

The figures below are the rows for `POST https://notification.api.cx.metamask.io/api/v4/notifications`. The filter above is broader than that endpoint and returns more. 1,020,538 spans over 16 transactions.

| transaction | spans |
|---|---|
| `Provider Create Accounts (v2 - batched)` | 197,600 |
| `/service-worker.js` | 192,207 |
| `BackendWebSocketService Connection` | 186,468 |
| `Background RPC: fetchAndUpdateMetamaskNotifications` | 26,113 |

The UI thunk hands the work across the RPC boundary ([`actions.ts` L7170-L7172](https://github.com/MetaMask/metamask-extension/blob/7d02d2d041b0d7817c577b2dd893dc7db42060a3/ui/store/actions.ts#L7170-L7172)), so the request is issued in the background, where it is recorded only if some span happens to be active at that moment (the parent condition, `knowledge/auto-instrumentation.md`). The transaction named for the operation holds 26,113 of the 1,020,538, about 2.6%, and the three largest parents have nothing to do with the notification list.

For what a dedicated span could add beyond these, the other half of the answer is `instrumentation` → Debounced Background State Update, which records the lag between a background response and the store update.

So the spans exist and no query reads a list latency off them, because the grouping tracks whatever else the background was doing. That is a real argument for a dedicated name here, and it is the argument the banner case does not have. Review the two on their own merits rather than on the count they share.
