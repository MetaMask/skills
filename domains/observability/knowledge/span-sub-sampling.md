---
name: span-sub-sampling
domain: observability
description: Deterministic per-trace sub-sampling for high-frequency custom spans — span sub-rate, traceId-hash bucketed
---

# Span Sub-Sampling

Durable fix for a custom span that fans out and eats the span budget. Gate the span with a per-trace sub-rate, keyed on the trace id so every gated span in a trace is kept-or-dropped together. Source: [PR #39891](https://github.com/MetaMask/metamask-extension/pull/39891) (`shared/lib/wrapper-sampling.ts`).

## Rate Math

```
effective rate = sample rate of the trace context the span joins × span sub-rate
```

- A span that joins its own realm's head-sampled trace inherits the global `tracesSampleRate` (extension prod: 0.5%), so the sub-rate cuts on top: `0.5% × 1% = 0.005%`.
- A span that joins a context propagated as sampled inherits a rate of 1, not the global rate. The extension background continues every UI context it receives as sampled, so its `rpc.handler` spans are kept at the sub-rate alone unless a per-name override or the remote `sentry.tracesSampleRate` ceiling applies.
- PR #39891 ships a sub-rate of 0.5% (`WRAPPER_SAMPLE_RATE = 0.005`) — a conservative pilot — and names 5% as the step-up once the denylist is confirmed effective in production.

Pick the sub-rate from how many sampled traces the metric needs to stay useful — not from the quota alone. Too low and the metric goes dark.

## Pattern

```ts
const WRAPPER_SAMPLE_RATE = 0.005;

// Deterministic: same answer for the same traceId, so every gated span in a
// trace is kept or dropped together. The trace's root is sampled separately.
export function shouldSampleWrappers(traceId: string | undefined): boolean {
  if (!traceId || traceId.length < 8) {
    return false;
  }
  const hashBucket = parseInt(traceId.slice(0, 8), 16) % 10000;
  return hashBucket < WRAPPER_SAMPLE_RATE * 10000;
}
```

**Why deterministic, not `Math.random()` per call:** independent per-span sampling shreds a trace into partial waterfalls (some spans present, siblings missing) — useless for attribution. Hashing the trace id makes keep/drop the same for every gated span in the trace. It does not tie them to the trace's root, which head sampling draws on its own: with a 0.5% root rate, about 99.5% of traces that keep wrapper spans are expected to lack their root.

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
