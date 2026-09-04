---
name: span-sub-sampling
domain: analytics
description: Deterministic per-trace sub-sampling for high-frequency custom spans — global tracesSampleRate × span sub-rate, traceId-hash bucketed
---

# Span Sub-Sampling

Durable fix for a custom span that fans out and eats the span budget. Layer a per-trace sub-rate **under** the global `tracesSampleRate`, keyed on the trace id so every span in a trace is kept-or-dropped together. Source: [PR #39891](https://github.com/MetaMask/metamask-extension/pull/39891) (`shared/lib/wrapper-sampling.ts`).

## Rate Math

```
effective rate = global tracesSampleRate × span sub-rate
```

- Global `tracesSampleRate` is already small (extension prod: 0.75%).
- The sub-rate cuts the custom span on top: `0.75% × 1% = 0.0075%`.
- PR #39891 ships a sub-rate of 0.5% (`WRAPPER_SAMPLE_RATE = 0.005`) — a conservative pilot — and names 5% as the step-up once the denylist is confirmed effective in production.

Pick the sub-rate from how many sampled traces the metric needs to stay useful — not from the quota alone. Too low and the metric goes dark.

## Pattern

```ts
const WRAPPER_SAMPLE_RATE = 0.005;

// Deterministic: same answer for the same traceId, so all spans in a trace
// are kept or dropped together — clean waterfalls, no partial gaps.
export function shouldSampleWrappers(traceId: string | undefined): boolean {
  if (!traceId || traceId.length < 8) {
    return false;
  }
  const hashBucket = parseInt(traceId.slice(0, 8), 16) % 10000;
  return hashBucket < WRAPPER_SAMPLE_RATE * 10000;
}
```

**Why deterministic, not `Math.random()` per call:** independent per-span sampling shreds a trace into partial waterfalls (some spans present, siblings missing) — useless for attribution. Hashing the trace id makes keep/drop a property of the whole trace.

## Gate Order (cheapest check first)

```ts
const traceId = sentryGetActiveSpan()?.spanContext().traceId;
if (!traceId || isReadOnlyAction(action) || !shouldSampleWrappers(traceId)) {
  return doWorkWithoutSpan();
}
return trace({ name, op, data }, doWorkWithSpan);
```

1. No active trace → no span.
2. Denylist → skip noise (below).
3. Sub-sample miss → skip this trace's spans.

## Denylist: cut before you sample

Drop spans with no timing/attribution signal before sub-sampling. In PR #39891, read-only verbs are ~90% of `messenger.call` volume:

```ts
const READ_ONLY_VERB = /^(?:get|has|find|is|peek)(?:[A-Z]|$)/u;
```

Removing ~90% of volume before the sample multiplies headroom — a higher sub-rate then yields the same span budget, so kept traces are denser and more useful.

## Where the Gate Goes

- **Consumer (extension):** spans go through `trace()`. Gate at the call site, or for a whole span family inside the wrapper. `traceId` from `sentryGetActiveSpan()?.spanContext().traceId`.
- **Controller package (core):** controllers call an injected `trace` callback. Gate in the package's trace util or the callback so every consumer inherits the cap. Pull the trace id from the controller's tracing context, not a fresh Sentry import.

## Kill Switch

Ship every always-on span family with an env disable flag (PR #39891: `SENTRY_DISTRIBUTED_TRACING_DISABLED` returns the messenger un-wrapped). It turns a future emergency cut into a config flip instead of a cherry-pick.
