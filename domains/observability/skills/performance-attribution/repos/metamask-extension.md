---
repo: metamask-extension
parent: performance-attribution
---

## Source & Project

Primary source is Sentry **Trace Explorer** (not Dashboard 219877): <https://metamask.sentry.io/explore/traces/>

- Project `metamask` (ID `273505`), `environment:production`
- Mode `Aggregates`, **Group By** `release`, **Visualize** `p75(span.duration)` and `p95(span.duration)`
- Time `90d` (primary). Dashboard 219877 (30d) is legacy/context only.

## Key Transactions

| Transaction | What it measures |
|---|---|
| `UI Startup` | Extension click → interactive UI. Service-worker boot is a separate trace, rooted under `/service-worker.js`, so background startup work is not in it |
| `/home.html` | Home page render |
| `Asset Details` | Token/NFT detail view render |
| `/notification.html` | dApp confirmation popup (approvals/signatures) — high-frequency for power users, compounds with usage |

## Query Template

```
is_transaction:true environment:production transaction:"UI Startup" (release:metamask-extension@13.11.2 OR release:metamask-extension@13.12.2 OR release:metamask-extension@13.13.1 OR release:metamask-extension@13.14.2 OR release:metamask-extension@13.15.0)
```

Swap the `transaction:"…"` value per metric; keep `statsPeriod=90d`.

## Version Selection — Highest-Sample Patch Per Minor

Anchor each minor line on its highest-sample patch, never the `.0`:

| Minor | Patch used | Rationale |
|---|---|---|
| 13.11 | 13.11.2 | Highest sample count |
| 13.12 | 13.12.2 | Highest sample count |
| 13.13 | 13.13.1 | Highest sample count |
| 13.14 | 13.14.2 | Highest sample count |
| 13.15 | 13.15.0 | Current release |

`.0` releases have **10–100× fewer samples** — never anchor a percentile on a `.0` when a higher patch exists in the same minor line.

## 90d vs 30d — Empirical

30d baselines ran **~2× higher** than 90d for the same metric (e.g. UI Startup p75 `9.39s → 3.47s` at 30d vs `4.40s → 3.34s` at 90d). Cause unconfirmed — residual-user population and/or sampling of residual traffic; **not** confirmed "power users" (no cohort segmentation). Report 90d; cite 30d only for context. Note: Sentry share links may render 30d in the UI even when the report figure is 90d — verify `statsPeriod=90d`.

## Hot-Path Files

| Path | Why it matters |
|---|---|
| `babel.config.js` | Build-time transforms (e.g. React Compiler) — broad scope |
| `ui/selectors/*.js` | Redux selectors — run on every state change |
| `ui/hooks/*.ts` | Hooks — component lifecycle |
| `ui/components/` | Virtualization / render patterns |
| `package.json` | Dependency runtime behavior + core-package bumps |

## Analysis Commands

```bash
git log v13.X.X..v13.Y.Y --oneline --no-merges | wc -l               # commit count between releases
git diff v13.X.X..v13.Y.Y --stat -- ui/selectors babel.config.js     # file-level change summary
git diff v13.X.X..v13.Y.Y -- <file>                                  # detailed diff for one file
git log v13.X.X..v13.Y.Y --oneline -- <paths>                        # commits touching specific paths
```

## Core Packages to Monitor

App-repo diffs miss work shipped as version bumps. Diff `package.json`, then read each package CHANGELOG:

| Package | Performance relevance |
|---|---|
| `@metamask/assets-controllers` | Token detection, balance fetching, NFT metadata |
| `@metamask/transaction-controller` | Transaction state size, history storage |
| `@metamask/network-controller` | RPC call handling, retry logic |

```bash
git diff v13.X.X..v13.Y.Y -- package.json | grep -E '^[-+] +"'   # every changed dependency, @metamask/* and others
```

Example findings:

- `@metamask/transaction-controller` v62.8.0 — deprecated `history` / `sendFlowHistory` from `TransactionMeta` → significant state-size reduction for power users (consumed in extension [#38665](https://github.com/MetaMask/metamask-extension/pull/38665)).
- `@metamask/assets-controllers` v94.0.0 ([core #7408](https://github.com/MetaMask/core/pull/7408)) — Account API v2 → v4 for token detection → fewer RPC calls, delegated detection.
- `@sentry/browser` 10.x: a CI benchmark ceiling breach was traced to this bump (benchmark harness, not production), so read bumps outside `@metamask/*` too.

## Worked Example: v13.11 → v13.15 (90d)

| Metric | p75 (typical) | p95 (tail) |
|---|---|---|
| UI Startup | 4.40s → 3.34s (-24%) | 15.65s → 9.11s (**-42%**, -6.5s) |
| /home.html | 1.69s → 1.19s (-30%) | 4.96s → 3.24s (-35%) |
| Asset Details | 100ms → 47ms (**-53%**) | 287ms → 94ms (**-67%**) |
| /notification.html | 1.36s → 1.05s (-23%) | 4.30s → 4.71s (+9%, **high variance — inconclusive**) |

Most UI Startup gains and the /home.html p95 gain landed in 13.12 (p95 UI Startup -40% in one release). /home.html p75 moved 1.69s → 1.56s in 13.12, 0.13s of its 0.50s drop, and its larger drops came in 13.14–13.15. Asset Details improved across 13.14 → 13.15. Treat the per-release header deltas as measured totals and attribute individual code changes as likely contributors only.

## Cross-Platform Trace Names

Trace names and ops are plain strings carrying no platform token, so a name the extension shares with `metamask-mobile` is a single series as far as a query is concerned.
At the shas cited below, 50 of the extension's 84 `TraceName` values and 10 of its 12 `TraceOperation` values also appear in mobile's trace module.
Two of the four Key Transactions above are in that shared set: `UI Startup` and `Asset Details`.

Any query whose scope spans both platforms' Sentry projects therefore returns one series, and a dashboard will place the two side by side whatever the code does.
The numbers are comparable only when the start point, the end condition and every tag derivation match. **A matching name is not evidence of a matching definition.**

Regenerate the shared set rather than trusting the counts above, since both enums move:

```bash
names() { awk '/^export enum TraceName/,/^}/' "$1" | grep -oE "= '[^']+'" | sed "s/^= '//; s/'$//" | sort -u; }
git show e24e5a017af7a84eeaac7f4f6053eb83cd237f5c:shared/lib/trace.ts > /tmp/ext-trace.ts
curl -sS https://raw.githubusercontent.com/MetaMask/metamask-mobile/945c2ade9ec8c2989de8769de26978a0ea68c164/app/util/trace.ts > /tmp/mobile-trace.ts
comm -12 <(names /tmp/ext-trace.ts) <(names /tmp/mobile-trace.ts)   # swap TraceName for TraceOperation to diff ops
```

### Notification List: One Tag Name, Two Populations

Both platforms emit `Notification List Time To Content` under op `notification.performance`, so the two land in one series ([extension `shared/lib/trace.ts` L40 and L108](https://github.com/MetaMask/metamask-extension/blob/e24e5a017af7a84eeaac7f4f6053eb83cd237f5c/shared/lib/trace.ts#L40-L41), [mobile `app/util/trace.ts` L315 and L395](https://github.com/MetaMask/metamask-mobile/blob/945c2ade9ec8c2989de8769de26978a0ea68c164/app/util/trace.ts#L315-L316)).
Both tag the span `source: cold` or `source: warm`, and those two tags select different populations.

Mobile holds `isLoading` from the previous run of the same effect and ends the span on the first run where `isLoading` is false, so `cold` means loading was true on the render immediately before the end ([mobile `useNotificationListPerformance.ts` L49-L69](https://github.com/MetaMask/metamask-mobile/blob/945c2ade9ec8c2989de8769de26978a0ea68c164/app/util/notifications/hooks/useNotificationListPerformance.ts#L49-L69)).

Extension latches `sawLoadingRef` on any render since the span started where `isLoading` was true and clears it only when a new span begins, so `cold` means loading was seen at any point in the span ([extension `useNotificationListPerformance.ts` L85-L115](https://github.com/MetaMask/metamask-extension/blob/e24e5a017af7a84eeaac7f4f6053eb83cd237f5c/ui/hooks/metamask-notifications/useNotificationListPerformance.ts#L85-L115)).
Extension also holds the span open while `isPending` is true, so it ends at least one render later than the mobile condition would.

The two differences interact.
A span whose `isLoading` flickers true then false before `isPending` clears tags `cold` on extension and would tag `warm` under mobile's rule, so **extension `cold` is a superset of mobile `cold`** and the extension span is the longer of the two by at least one render.

The hooks also take different inputs.
Extension takes an `error` argument and ends the span `success: false, reason: 'error'` with no `source` tag ([extension `useNotificationListPerformance.ts` L94-L101](https://github.com/MetaMask/metamask-extension/blob/e24e5a017af7a84eeaac7f4f6053eb83cd237f5c/ui/hooks/metamask-notifications/useNotificationListPerformance.ts#L94-L101)), while mobile's config has no error input at all.
What reaches mobile's `success: true` series on a failed fetch is decided by whatever its caller passes as `isLoading`, which is not visible in the hook and is not established here.

### Banner: Different Work, Not a Naming Mismatch

The banner traces differ in both fields, so they do not share a series today: extension emits `Home Banner Time To Content` under `banner.performance` ([extension `shared/lib/trace.ts` L41 and L109](https://github.com/MetaMask/metamask-extension/blob/e24e5a017af7a84eeaac7f4f6053eb83cd237f5c/shared/lib/trace.ts#L108-L109)), mobile emits `Braze Banner Time To Content` under `braze_banner.performance` ([mobile `app/util/trace.ts` L316 and L396](https://github.com/MetaMask/metamask-mobile/blob/945c2ade9ec8c2989de8769de26978a0ea68c164/app/util/trace.ts#L395-L396)).

Aligning those names would not make the numbers comparable, because the two spans time different work.
Mobile's span wraps the Braze React Native SDK ([mobile `useBrazeBanner.ts` L269-L276](https://github.com/MetaMask/metamask-mobile/blob/945c2ade9ec8c2989de8769de26978a0ea68c164/app/components/UI/BrazeBanner/useBrazeBanner.ts#L269-L276)), while the extension's carousel times a Contentful fetch and tags the span `banner_source: 'contentful'` ([extension `carousel.tsx` L32-L41](https://github.com/MetaMask/metamask-extension/blob/e24e5a017af7a84eeaac7f4f6053eb83cd237f5c/ui/components/multichain/account-overview/carousel.tsx#L32-L41)).

This is the case where no definition change helps. Renaming aligns a label over two different measurements.
