---
repo: metamask-extension
parent: sentry-mcp-queries
---

## Organization and Projects

```
mcp__sentry__find_organizations  → confirm org slug
mcp__sentry__find_projects       → metamask (the extension: Chrome/MV3 + Firefox/MV2)
```

## Standard Filter Set for Extension Errors

```
environment:production
installType:normal
```

Then add `dist:mv3` or `dist:mv2` to isolate by manifest. Production releases are named `metamask-extension@<version>`, so filter `release:metamask-extension@13.47.0`, not `release:13.47.0`.

## Sample Rate

Production `tracesSampleRate` = `0.005` (0.5%), the fallback in `getTracesSampleRate()`. `tracesSampler` (`app/scripts/lib/sentry-traces-sampler.ts`) takes precedence over it: a per-name override, the remote `sentry.tracesSampleRate` flag and a sampled parent each set a span's effective rate, so no single multiplier converts stored spans to volume.

```bash
# Verify current value before using
grep "tracesSampleRate" app/scripts/lib/setupSentry.js
```

## Volume Estimation — Worked Example

`AssetsFirstInitFetchCompleted` correlates 1:1 with `accounts.api.cx.metamask.io/v1/supportedNetworks` (fires once per init) — **not** `/v4/multiaccount/balances` (fires per account):

```
/v1/supportedNetworks:     2.6M sampled (30d)   once per init: tracks the event rate
/v4/multiaccount/balances: ~26M sampled         per account: 10× the init count, NOT the event rate
```

Lesson: pick the once-per-event endpoint or you over-count by the fan-out factor.

## Common Issue Searches

| What you're looking for | Query |
|---|---|
| Background connection errors | `is:unresolved background connection` |
| MV3-only errors | `is:unresolved dist:mv3` |
| Errors spiking in recent release | `is:unresolved times_seen:>100` |
| Performance issues | `issue.category:performance` |

## Tag: `dist` Values

| Value | Meaning |
|-------|---------|
| `mv3` | Chrome (Manifest V3 — service worker) |
| `mv2` | Firefox (Manifest V2 — background page) |

## Seer Analysis Notes

Seer has access to the Sentry issue, stack traces, and recent events. It does not have access to the codebase. Validate its hypothesis against the actual handler chain in the source — especially for keepalive, lifecycle, and concurrency conclusions.

## Checking Whether an Endpoint Already Has Timings

Before adding a timer around a network request, ask whether the request already carries a duration:

```
mcp__sentry__search_events
  dataset: spans
  query:   environment:production span.op:http.client span.description:*<endpoint fragment>*
  fields:  transaction, count(), p50(span.duration)
  sort:    -count()
```

Rows mean the request is already recorded and already carries a duration, so the timing exists and the open question is where to read it from.

The `transaction` column answers that: it names the spans the request is recorded under. A single dominant `transaction` means one query reads the latency for that surface. A spread across many parents means no single query reads a per-surface latency off it.

## Retention Silently Truncates the Window

Sentry ignores a `start` older than the project's retention. It returns data for the shorter period with no error, and nothing in the response announces that the range moved.

The result is a count that reads as the window you asked for and covers the window retention allowed. State the window you actually got, not the one you requested.

The retention period for this project is not recorded here. Establish it before sizing any window that reaches back further than a few weeks.

The response does not echo the range it used, but `meta.dataScanned` reports whether the scan was complete: `full` when the requested window was served, `partial` when it was not. Read that field on any query with an absolute window, and treat `partial` as a truncated result rather than a slow one.

Verified against the events API with a control: the same span query over 2026-08-19 to 2026-09-17 returns `dataScanned: full`, and the same query with `start` set to 2025-01-01 returns `dataScanned: partial` with a count an order of magnitude apart.

## Absolute Windows Need the Events API

`search_events` takes `period` only, matching `^\d+[hdw]$`. It has no `start` or `end`, so an absolute window cannot be expressed through the MCP tool and has to go through the events API.

Other tools in the same catalog do accept absolute `start` and `end` (`get_monitor_details`, `search_ai_conversations`, `get_profile_details`), but none of them queries spans.

`search_issues` is narrower still. Its `period` is an enum of `24h`, `7d`, `14d`, `30d` and `90d`, so an arbitrary relative window is not available there either.
