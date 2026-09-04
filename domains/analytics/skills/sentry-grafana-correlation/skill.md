---
name: sentry-grafana-correlation
description: Join one trace across Sentry and Grafana Tempo by trace id to see the whole client-to-backend path, and diagnose why a half is missing. Covers the split-store model (client spans reach Sentry through the SDK and survive only head sampling; backend spans reach Tempo through tail sampling and Sentry through environment routing), the classification of both-halves / client-only / backend-only outcomes with the sampling and routing rule that causes each, and the id-padding, time-window, and query-syntax traps that make a present trace look absent. Use when a trace looks truncated, a backend span has no parent, per-hop latency needs attributing across the seam, or you need to know which store should hold a given span. Triggers on cross-stack trace, orphaned span, trace id lookup, client-backend correlation, split waterfall, or "where did the rest of the trace go".
maturity: experimental
---

# sentry-grafana-correlation

One request produces spans in two stores, joined only by `trace_id`. Reading a trace end to end means querying both and knowing which absences are expected.

Prerequisite: `grafana-tempo-queries` for the Tempo side, `sentry-mcp-queries` for richer Sentry work.

## The model — what lands where, and why a half goes missing

| Span | Reaches | Gated by |
| --- | --- | --- |
| Client (`pageload`, `navigation`, `http.client`, custom) | Sentry, via the SDK transport | the client's `tracesSampleRate` head decision |
| Backend (`http.server`, internal, db, messaging) | Tempo, via the collector | collector tail-sampling policy |
| Backend, additionally | Sentry, if the collector forwards it | an environment attribute on the span matching a routing policy |

Three consequences drive every diagnosis below:

- **The client's sampled flag and the client's own retention are separate decisions.** The propagated `traceparent` flag tells the backend whether to record; the client's head sampling decides whether the client span is kept. When the flag says record and head sampling drops the client span, the backend records a span whose parent was never stored anywhere — an orphan. This is the normal case at low client sample rates, not an anomaly.
- **A `-00` (not-sampled) flag can suppress the backend span entirely**, because a parent-respecting sampler delegates to "never record" for an unsampled remote parent. No backend span is created at all — different from one being dropped later.
- **Backend spans only reach Sentry if their environment attribute matches a routing policy.** A service that expresses environment under a different attribute name matches nothing and is silently absent from Sentry while still present in Tempo.

## Setup

Keep organisation slugs, project ids, and hosts in your environment — do not commit them.

```bash
# SENTRY_ORG, SENTRY_PROJECT_ID (numeric), SENTRY_AUTH_TOKEN
# plus the grafana-tempo-queries variables for the Tempo side
```

## Query the Sentry half

```bash
curl -fsS -G "https://sentry.io/api/0/organizations/$SENTRY_ORG/events/" \
  -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  --data-urlencode "dataset=spans" \
  --data-urlencode "field=span.op" --data-urlencode "field=span_id" \
  --data-urlencode "field=parent_span" --data-urlencode "field=span.description" \
  --data-urlencode "field=timestamp" \
  --data-urlencode "query=trace:$TRACE_ID" \
  --data-urlencode "project=$SENTRY_PROJECT_ID" \
  --data-urlencode "statsPeriod=24h" \
  --data-urlencode "sort=-timestamp"
```

Two syntax traps that produce misleading emptiness:

- **Any field you sort on must also be selected.** Sorting by `-timestamp` without requesting `timestamp` returns `400 orderby must also be in the selected columns or groupby` — and a script that swallows errors reports it as no results.
- **`has:parent_span` is not valid**; request `parent_span` as a field and filter client-side.

Use `project=-1` to search every project at once when you do not yet know which one should hold the span — that is how you tell "in the wrong project" apart from "absent".

## Procedure — Tempo to Sentry

Use when you have a backend trace and want its client context.

1. Find client-originated backend traces: search your services in Tempo, then keep the results whose `rootServiceName` reports the root was never received. Those reference a client parent that is not in Tempo.
2. **Zero-pad each trace id to 32 characters** before querying Sentry. Tempo search strips leading zeros, and an unpadded id returns nothing for a reason that looks like absence.
3. Query Sentry for `trace:<id>`, first in the client's project, then with `project=-1`.
4. Classify with the table below.

## Procedure — Sentry to Tempo

Use when a Sentry trace looks truncated at the network boundary.

1. Take the trace id from the Sentry trace view.
2. Look for a matching `http.server` span in Sentry itself first — if the collector forwards backend spans for that environment, both halves may already be in one place and no cross-store hop is needed.
3. Otherwise fetch the trace from Tempo by id, with a time window that brackets the client span's timestamp.
4. If Tempo has nothing, the backend either never recorded it (a `-00` flag), or its trace fell outside the tail-sampling policy.

## Classification

| What you find | Meaning | Where to look next |
| --- | --- | --- |
| Client and backend spans, backend parented on the client's request span | Healthy join; per-hop latency is attributable | — |
| Client and backend spans, backend parented on an enclosing operation root | Propagation is attaching the wrong parent, so the backend span sits beside its caller instead of beneath it | The client's header-injection path |
| Backend spans only, client parent referenced but nowhere | Orphan: the flag instructed recording, head sampling discarded the client span | Client sample rate, or decoupling the flag from head sampling |
| Client spans only, no backend span anywhere | Either no header was propagated to that host, or the flag was `-00` so the backend never created a span | Propagation targets, then the flag |
| Backend in Tempo but not in Sentry when it should be | Environment attribute does not match a forwarding policy | The service's environment tagging |
| Nothing in either store | Head-sampled out end to end | Expected at low sample rates |

## Checking whether a backend span nests correctly

The parent identity, not the picture, is what determines nesting. Take the backend `http.server` span's `parentSpanId` (hex-decode it from Tempo's base64), then look that id up among the client's spans in Sentry:

- Resolves to an `http.client` span whose description matches the same URL → correctly nested beneath the request that caused it.
- Resolves to a transaction root or custom operation span → the backend span is a sibling of its caller; hop latency cannot be read off the waterfall.
- Resolves to nothing in either store → orphan.

## Traps

- **Time windows differ per store.** Tempo retention is typically much shorter than Sentry's, so an older trace legitimately exists in one and not the other. Confirm the window before concluding a half is missing.
- **Verify credentials on both sides first.** A Grafana token without datasource scope and an out-of-scope Sentry token both present as empty results, which read as "no data" rather than as "not allowed". Confirm each side returns something before concluding a half is missing.
- **A relative time window on a shared link expires.** Pin absolute ranges when the link needs to outlive the incident.
- **One sampling decision can be shared across a long-lived trace id.** If a client reuses a trace id across many operations, the proportion of spans marked sampled will not match the nominal client rate; do not read that ratio as an effective sample rate.
