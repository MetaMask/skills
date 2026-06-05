---
repo: metamask-extension
parent: sentry-mcp-queries
---

## Organization and Projects

```
mcp__sentry__find_organizations  → confirm org slug
mcp__sentry__find_projects       → metamask-extension (Chrome/MV3 + Firefox/MV2)
```

## Standard Filter Set for Extension Errors

```
environment:production
installType:normal
```

Then add `dist:mv3` or `dist:mv2` to isolate by manifest.

## Sample Rate

Production `tracesSampleRate` = `0.0075` (0.75%) → multiplier ≈ 133×

```bash
# Verify current value before using
grep "tracesSampleRate" app/scripts/lib/setupSentry.js
```

## Volume Estimation — Worked Example

`AssetsFirstInitFetchCompleted` correlates 1:1 with `accounts.api.cx.metamask.io/v1/supportedNetworks` (fires once per init) — **not** `/v4/multiaccount/balances` (fires per account):

```
/v1/supportedNetworks:    2.6M sampled (30d) × 133 ≈ 346M event fires / month
/v4/multiaccount/balances: ~26M sampled × 133 ≈ 3.5B balance API calls / month  (per-account — NOT the event rate)
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
