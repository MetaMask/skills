---
maturity: experimental
name: sentry-quota
description: Catch quota-risky Sentry span instrumentation in code and PRs — fan-out × ungated × no-kill-switch — before it blows the span budget
---

# Sentry Span Quota Guard

Find and fix custom Sentry span instrumentation that blows the project span budget. Operates on **code and PRs**, not Sentry dashboards — you spot the culprit in Sentry (`sentry-mcp-queries`), this skill fixes it in code.

## When To Use

- A PR adds custom Sentry spans (`trace()` calls / `TraceName` entries) — review it before merge.
- A custom span/transaction dominates span volume in Sentry — locate where it's emitted and fix it.
- Auditing controllers/UI for always-on, fan-out-prone instrumentation.
- A custom span is the top span-count contributor and must be cut fast (release blocker).

## Do Not Use When

- Reading the live span counts themselves — that's `sentry-mcp-queries` (Volume Estimation).
- Product-analytics events (Segment / `trackEvent`) — that's `analytics-instrumentation` + `segment-governance`.
- The span is already behind a per-trace sample gate **and** a kill-switch — already mitigated.

## Breach Triad

A custom span is a quota risk when these stack. The first three together are the breach profile.

| Signal | Static signature | Why it blows quota |
|---|---|---|
| **Fan-out** | span created in a loop / `.map` / `.forEach` / per-asset / per-account / per-chain / poller | N spans per trace, not 1 |
| **Always-on** | no `tracesSampleRate` sub-rate, no hash gate before the span | every qualifying call emits |
| **No kill-switch** | not guarded by an env flag | disabling needs a release, not a config flip |
| Hot path | data-source / update-pipeline / network callback, not a discrete user action | high call frequency |

Low fan-out + discrete user action + already gated = fine. Don't flag healthy spans.

## Workflow

### PR review (pre-merge gate)
1. `gh pr diff <n>` — scan **added** lines for new `TraceName` entries and `trace(` call sites.
2. Score each new span against the breach triad: is the enclosing scope a loop/poller? is there a gate? a kill-switch?
3. Block if a new always-on span has no gate — require a sub-sample gate (`span-sub-sampling`) before merge. Cheaper than a post-ship cherry-pick.
4. If the diff adds no `trace(` sites and no `TraceName` entries → "no new instrumentation, no quota risk", stop.

### Locate (incident)
1. Grep the span name / `TraceName.X` across the consuming repo **and** the controller package source.
2. Open the call site; read the enclosing scope for the fan-out verdict (loop/poller?).
3. **No grep hits ≠ safe** — the culprit may be on a release ref not checked out. Verify the package version / `gh pr checkout` the shipping ref before concluding clean.

### Audit
1. Sweep the span registries (`TraceName` enums) + `trace(` call sites.
2. Rank by breach triad — surface ungated × hot-path × fan-out first.

### Mitigate
Pick the lowest tier that stops the bleed.

## Mitigation Ladder

| Tier | When | Action |
|---|---|---|
| **0 — Immediate** | a span fans out and is actively breaching on the live release | disable the `trace()` call at source (or env-guard it) + **cherry-pick to the release branch** + file a sev-1 release blocker on the in-flight release milestone |
| **1 — Release containment** | spike concentrated in an old, already-patched release with lingering users | Sentry **inbound filter** dropping `release:<bad>` spans + force-update. The only dashboard action. Filters target a whole release, not one span — don't filter a release you still want data from |
| **2 — Durable** | the span is justified long-term but ungated | deterministic `traceId`-hash sub-sample gate before the span (`span-sub-sampling`) |
| **3 — Wrong tool** | the metric needs full fidelity; sampling loses the signal | move the metric off trace spans — they are the wrong substrate for always-on high-cardinality metrics. Segment is the usual target, but it has its own ungoverned billing gap (`segment-governance`), so it is not a free lunch |

Tier 0 + 1 stop the bleed now; Tier 2 is the follow-up so the metric returns.

## Common Pitfalls

| Mistake | Correct approach |
|---|---|
| Per-call random sampling (`Math.random()` per span) | Deterministic `traceId`-hash bucket — all spans in a trace kept-or-dropped together, clean waterfalls |
| Gate the span in Sentry config | Gate at the call site; for an injected-callback controller span, gate in the callback so every consumer inherits the cap |
| Inbound-filter a release you still need data from | Filters drop the whole release — fix in code (Tier 0/2) instead |
| "No grep hits, so it's safe" | The culprit may be on a release ref not checked out — verify the version/ref |
| Disable the span on `main` only | Cherry-pick to the active release branch — `main` alone leaves the live release breaching |
| Treat "move to Segment" as free | Segment events ship without CI governance or billing review (`segment-governance`) |
| Ship new always-on instrumentation with no kill-switch | Add an env disable flag on day one — turns a future cut into a config flip, not a cherry-pick |
