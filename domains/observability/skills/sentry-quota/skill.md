---
maturity: experimental
name: sentry-quota
description: Catch quota-risky Sentry span instrumentation in code and PRs — fan-out × ungated × not in the sampler's rate table — before it blows the span budget
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
- Product-analytics events (Segment / `trackEvent`) — that's `instrumentation`, with data domain `knowledge/segment-governance.md` for Segment governance.
- The span is already named in the sampler's rate table and, where it is a span family on a hot path, gated at the call site — already mitigated.
- Error volume. Errors are metered separately from spans and transactions, so no change here moves the error quota.

## Breach Triad

A custom span is a quota risk when these stack. The first three together are the breach profile.

| Signal | Static signature | Why it blows quota |
|---|---|---|
| **Fan-out** | span created in a loop / `.map` / `.forEach` / per-asset / per-account / per-chain / poller, or a `trace()` callback that awaits requests | N spans per trace, not 1. Each request inside an active span is an automatic `http.client` child |
| **Always-on** | no `tracesSampleRate` sub-rate, no hash gate before the span | every qualifying call emits |
| **No per-name rate** | the transaction name is absent from the sampler's rate table | cutting it needs a release, because a runtime throttle can only act on a name it holds |
| Hot path | data-source / update-pipeline / network callback, not a discrete user action | high call frequency |

Low fan-out + discrete user action + already gated = fine. Don't flag healthy spans.

**The subtlest fan-out has no visible loop: a memoized selector.** A `trace` passed into a memoized selector (`createSelector` / `reselect`, or any function called from `useSelector`) fires on every input change by reference. If the selector also iterates entities, it is fan-out × recompute-frequency. Its volume tracks internal state-churn, not user action, so no user-facing metric predicts it — you cannot capacity-plan it. Treat any `trace` reaching a selector as fan-out.

## Workflow

### PR review (pre-merge gate)
1. `gh pr diff <n>` — scan **added** lines for three things, not two: new `TraceName` entries, new `trace(` call sites, **and a `trace`/trace-callback passed as an *argument*** into a call (`fn(…, trace)`). The third is the one reviews miss — a caller wiring up a function's optional `trace?` param adds instrumentation with no `trace(` site and no `TraceName` entry.
2. Check what already emits. For every trace name the diff adds, maps or reroutes, query the target project over the last 90 days (`sentry-mcp-queries`). A name that already emits is not new instrumentation. Review it as a change to measured volume, and say so first in the verdict, because a reviewer who believes it is new will look for a history that already exists. For a name that is new to the target, the other client where it already ships is the reference class. Before carrying that client's volume over, list which of its top names the diff can actually start in the target. For a timing span, also check whether the requests it waits on are already recorded as automatic `http.client` spans, and ask what the new span adds beyond them (`knowledge/auto-instrumentation.md`).
3. Score each against the breach triad: is the enclosing scope a loop, poller, **or selector**? is there a gate? a kill-switch?
4. Block if a new always-on span has no gate — require a sub-sample gate (`span-sub-sampling`) before merge. Cheaper than a post-ship cherry-pick.
5. If the diff adds no `trace(` sites, no `TraceName` entries, **no `trace` argument passed into a call, bumps no dependency, adds or changes no SDK integration, and adds or re-triggers no network request** → "no new instrumentation", stop. A dependency bump brings whatever instrumentation the package carries at the adopted version, which no grep of this diff can see, and that volume can be `http.client` traffic the tracing context surfaces rather than wrapper spans. An SDK integration such as `browserTracingIntegration()` emits `pageload`, `navigation` and `http.client` spans with no `trace(` site at all.

**A bump is reviewed by packing BOTH versions, never by reading the new one.** Resolve both from the lockfile at merge base and head, `npm pack <pkg>@<version>` each, and `find` what each arm actually ships before running any pattern. A single-arm read does not return "unknown", it returns a confident zero, and two mechanisms produce one with nothing about the grep looking wrong:

- **The span registry's identifier is per-package.** Grepping the consumer's name against a dependency is a search for a symbol that was never going to be there — `money-account-balance-service@2.4.3` and `money-account-api-data-service@0.4.1` both call theirs `TRACES`, so a `TraceName` grep returns 0 while 15 and 11 occurrences sit in the files.
- **The shipped file extensions differ between versions.** A dual `.cjs`+`.mjs` build against a `.js`-only predecessor both hides the whole new arm from an extension-scoped pattern and doubles a raw occurrence count across the bump, for a packaging reason with no instrumentation in it. A request the diff adds, or makes fire more often, becomes an `http.client` span whenever a span is active when it starts, so estimate it as requests × triggers × the kept rate of the trace it joins (`knowledge/auto-instrumentation.md`).

> **Instrumentation is not always added by an instrumentation PR.** The costliest spans arrive incidentally — a caller passes a `trace` argument into an existing function during an unrelated change (a bug fix, a refactor), so the PR's stated purpose gives no signal to review it for quota. Do not gate this scan on the PR *looking* like instrumentation. And accept the limit: a `trace` argument buried in a bug-fix diff will slip a human reviewer, which is why a runtime backstop is needed. Sentry metric alerts cannot target one transaction name's billed volume, only project and category totals, so the backstop belongs in the sampler (the per-name budget below). This skill lowers the rate; it does not eliminate the class.

### Locate (incident)
1. Grep the span name / `TraceName.X` across the consuming repo **and** the controller package source.
2. Open the call site; read the enclosing scope for the fan-out verdict (loop/poller?).
3. **No grep hits ≠ safe** — the culprit may be on a release ref not checked out. Verify the package version / `gh pr checkout` the shipping ref before concluding clean.

### Audit
1. Sweep the span registries (`TraceName` enums) + `trace(` call sites.
2. Rank by breach triad — surface ungated × hot-path × fan-out first.

### Mitigate
Pick the lowest tier that stops the bleed.

## PR Report

What the review emits, not a form the author fills in. Every field but the last is derivable from the diff plus one Sentry query; the last is the author's, and it is the term the estimate is most sensitive to.

| # | Field | Source |
|---|---|---|
| 1 | Names this diff adds or changes | diff |
| 2 | What starts each one, and what stops it | diff + repo |
| 3 | Every span that will be a child of it | diff + SDK config |
| 4 | What this measures that those spans do not | field 3 |
| 5 | Whether the names already emit | one query, 90 days |
| 6 | Which rate resolves, and where it lives | sampler source |
| 7 | Whether a call-site gate is warranted | fields 2 and 3 |
| 8 | Attributes, and the cardinality of each dynamic key | diff |
| 9 | Reach | **the author** |

1. **Names.** Every new `TraceName`, every new `trace(` site, and any `trace` passed as an *argument* into an existing call — the third has no `trace(` in the diff to find.
2. **Triggers.** What starts it and what stops it: a discrete user action, a page load, a poller, a selector, a loop. Follow mounts, subscriptions and inits, not only `trace(` sites, because a change can start a traced process with no span anywhere in its diff. "Nothing stops it" is a finding, not a blank.
3. **Children, enumerated rather than described.** A `trace()` callback holds its span active, so every request inside becomes an `http.client` child except those `shouldCreateSpanForRequest` drops, plus any nested traced call (`knowledge/auto-instrumentation.md`). This list is what makes one span more than one span, and it is what field 4 is answered against.
4. **What it adds.** Where the new span wraps a request that already carries an `http.client` span with a duration, say what the new name measures that the existing one does not. A timing span over an interval already recorded is a rename of existing data.
5. **Already emitting** — workflow step 2. Lead the verdict with the current count.
6. **Rate resolution**, in order: a remote per-name rate, then a build-time per-name rate, then the enclosing trace's decision, then the global default. **A span started inside a sampled trace inherits that decision and the global default never applies.** Say whether the per-name entry is in *this* PR; a rate that ships in a later ref does not cap this one.
7. **Gate** — see the next section. It is not a question about a kill switch.
8. **Attributes.** Span `data`, not scope tags. For every dynamic key, the number of distinct values it can take.
9. **Reach.** The share of sessions that reach the trigger. No static analysis reaches it, so the estimate ships as a range across it with the assumption written down, never folded into a single number.

The report closes on

```
spans  =  occurrences x spans per occurrence x the rate that applies
occurrences  =  reach x frequency x duration
```

with spans per occurrence from field 3 and the rate from field 6.

## Which Control To Ask For

**The per-name rate is the kill switch.** A remote name-to-rate map pins any transaction to zero at runtime, with no release, and it wins over the build-time table. So do not ask an author to build an env flag — ask that the name ship in the rate table alongside the code that emits it. Two limits belong in the report:

- **It reaches only builds that read it.** A rate published today does nothing for an installed build shipped before the sampler, which is why the release inbound filter (Tier 1) is a separate instrument rather than a redundant one.
- **It only sees transactions.** A span handed an explicit parent is a child span and the sampler is never called for it, so there the call-site gate is the only control.

**A call-site gate is for the two things a rate cannot do**, and asking for both by reflex is how a review spends its credit on redundancy:

- **Per-trace coherence.** The sampler draws independently per name, so a per-name rate leaves a trace showing some of its spans and not others. A deterministic hash on the trace id keeps a whole family together, which is what makes the waterfall readable (`knowledge/span-sub-sampling.md`). Never `Math.random()` per span.
- **Not creating the span at all**, rather than dropping it at send — the difference that matters on a hot path where building the span is itself the cost.

Warranted for a span family on a hot path. Not warranted for a single named transaction the rate table can cap.

## Mitigation Ladder

| Tier | When | Action |
|---|---|---|
| **0 — Immediate** | a span fans out and is actively breaching on the live release | publish the name at rate `0` in the remote per-name rate map — no release, effective at the next Sentry init on every build that reads the flag. Falls back to disabling the `trace()` call at source and **cherry-picking to the release branch** for a child span the sampler never sees, or for builds predating the sampler. Either way, file a sev-1 release blocker on the in-flight release milestone |
| **1 — Release containment** | spike concentrated in an old, already-patched release with lingering users. A sampler fix in a newer build does not change that release's rates unless it reads its rate remotely | Sentry **inbound filter** dropping `release:<bad>` spans + force-update. The only dashboard action. Filters target a whole release, not one span — don't filter a release you still want data from. There is no inbound filter by transaction name, only a fixed health-check one. Filtered events do not consume quota, so confirm the drop in the filtered outcomes (`stats_v2` grouped by `reason`), not in Explore. It is not instant: one recorded release filter took 3.8 days from filing to taking effect |
| **2 — Durable** | the span is justified long-term but ungated | deterministic `traceId`-hash sub-sample gate before the span (`span-sub-sampling`) |
| **3 — Wrong tool** | the metric needs full fidelity; sampling loses the signal | move the metric off trace spans — they are the wrong substrate for always-on high-cardinality metrics. Segment is the usual target, but its events can ship unregistered, with no CI check and no billing review (data domain `knowledge/segment-governance.md`), so it is not a free lunch |

Tier 0 + 1 stop the bleed; Tier 2 is the follow-up so the metric returns.

**Prevent the next one, not just this one.** Every tier above requires *naming* the offender first, so a new one runs unbounded until someone catches it. A per-transaction-name budget in the sampler — sample the first N of a name per session, then decay — bounds *any* name with no advance knowledge of which will misbehave. It is the only control that acts before the offender is named, and the only one that catches instrumentation added incidentally rather than deliberately.

## Common Pitfalls

| Mistake | Correct approach |
|---|---|
| Per-call random sampling (`Math.random()` per span) | Deterministic `traceId`-hash bucket — all gated spans in a trace kept-or-dropped together |
| Gate the span in Sentry config | Gate at the call site; for an injected-callback controller span, gate in the callback so every consumer inherits the cap |
| Inbound-filter a release you still need data from | Filters drop the whole release — fix in code (Tier 0/2) instead |
| "No grep hits, so it's safe" | The culprit may be on a release ref not checked out — verify the version/ref |
| Disable the span on `main` only | Cherry-pick to the active release branch — `main` alone leaves the live release breaching |
| Treat "move to Segment" as free | Segment events ship without CI governance or billing review (data domain `knowledge/segment-governance.md`) |
| Ship a new transaction whose name is not in the sampler's rate table | The name is the unit a runtime throttle acts on. In the table on day one, a later cut is a flag value; absent from it, a cut is a release |
| Ask the author for a bespoke env kill-switch | The per-name rate is the kill switch. Ask for a call-site gate only where per-trace coherence, or not building the span at all, is the point |
| An optional `trace?` param passes review because it emits nothing | It is a dormant fan-out — it detonates when any caller supplies the argument. Remove the *param*, not just the argument, so one line can't re-arm it. |
| Disable one entry point of a multi-path change | One change can reach the backend by more than one path (a controller callback *and* a selector param). Audit every entry point it added, not just the one that fired. |
| Read a span that "fires N million times" as one triggered too often | A total is transactions × spans per transaction. Check spans per trace before blaming the trigger: fan-out multiplies the count with no change in how often the trigger fires |
| Read the bumped version and conclude | A one-arm grep returns a confident zero, not an unknown. Pack both arms and list what each ships before any pattern runs |
| Count only `trace(` sites | Most child spans are automatic: in the extension project, `http.client` is about nine in ten billed child spans. Review added requests, refetch triggers and requests moved into a `trace()` callback the same way as a new span (`knowledge/auto-instrumentation.md`) |
| Filter a release before its successor is fixed | The filter redirects users onto the next build; if that carries the same span, volume only moves. Filter a release only once the build users update to is clean. |
