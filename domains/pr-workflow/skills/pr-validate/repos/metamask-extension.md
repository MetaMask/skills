---
repo: metamask-extension
parent: pr-validate
metadata:
  type: pr-validation
---

# PR Validation — Extension

Prove a PR does what it claims with **objective, reviewer-grade evidence**, then attach that evidence to the PR. This is the orchestration layer above the capture skills: it decides *what* evidence a PR needs and *assembles* it. For capture mechanics it defers to siblings — `visual-testing` (mm CLI screenshots/flows), `performance-testing`, `pr-manual-testing`, `pr-description` — and to the MetaMask Autonomous Engineering Platform (AEP) for autonomous runs.

Complements `pr-readiness-check` (which checks that tests and guidelines are *present*); this skill proves the *behavior* is correct.

## When to Use

- Before marking a PR ready for review, or after a force-push, to produce the before/after a reviewer expects.
- To back a perf, telemetry, or UI claim with an artifact a reviewer can independently re-check.
- To assemble and publish an evidence bundle into the PR's Screenshots/Recordings section.

Not for code-correctness review.

## The core move: match evidence to the claim

A PR makes a **falsifiable claim** ("privacy mode now hides the Perps balance"; "hovering the asset row preloads the chart with no double-fetch"; "this cuts startup latency"). Validation = pick the evidence that would **falsify the claim if it were false**, then capture it. Don't run a fixed checklist.

First, write a **Claim Card** (`Given <precondition>, when <action>, then <observable>` + surface, falsifier, baseline) from the PR body, the linked issue, and the diff — the linchpin; every lane is only as good as the claim. Full rubric, anti-patterns, and special cases (refactor/no-op, bug-fix, perf, migration, flag-gated): `references/claim-extraction.md`. Then choose lanes:

| Claim shape | Lead with | Capture via |
|---|---|---|
| Visible UI change (layout, copy, show/hide, theme) | before/after screenshots | `visual-testing` (mm CLI), or AEP `visual_validation` |
| Motion / multi-step flow | screen recording → GIF | `visual-testing` + ffmpeg |
| Non-visible perf behavior (preload, no double-fetch, lazy-load, chunk membership) | falsifiable network/static assertions | DevTools/CDP netlog, AEP `perf_validation` |
| Latency / startup timing | benchmark numbers | `performance-testing`, DevTools profile |
| Telemetry / error-rate / latency in prod | Sentry query link (before/after window) | Sentry MCP / dashboard |
| Bundle / build output | bundle-size diff, chunk membership | build + source-map analysis |
| Behavior with no UI | targeted tests + repro | `pr-manual-testing`, CI checks |

A PR that mixes claims (a UI fix that also shifts a metric) needs more than one lane, assembled into one bundle. Full lane menu with capture pointers: `references/evidence-catalog.md`.

## AEP — autonomous validation

The MetaMask Autonomous Engineering Platform (`MetaMask/metamask-autonomous-engineering-platform`) can validate a PR autonomously. Submit a task for the PR head with `taskClass: visual_validation` (visible behavior) or `perf_validation` (falsifiable network/static/smoke assertions). It checks out the PR, **deterministically seeds** extension state, has an agent **navigate** and capture, and returns an `evidenceBundle` of artifacts (screenshots / proven assertions) that it can publish to the PR body.

The split that makes the evidence trustworthy: **seeding is deterministic (the platform), navigation is the agent.** That separation is why a screenshot proves the change instead of reward-hacking a loading screen.

Output modes: `validation_only` (the default for these task classes), plus `pull_request` / `report_only` / `evidence_only`. See the AEP repo's `docs/` for how to run it.

## Vacuous-pass discipline

A green result is real only if the evidence bundle is **non-empty** and contains the expected media. An agent chain can "pass" by skipping with zero artifacts. Always confirm artifacts exist — and show the claimed surface — before believing a pass or publishing. Never upgrade a zero-artifact run to "proven".

## Publishing evidence to the PR body

Put the evidence where a reviewer expects it: the PR template's **Screenshots/Recordings → Before / After** section (see `pr-description`).

- Host images somewhere GitHub renders inline (an asset store the PR can reach) — a `localhost` or local file path will not render.
- Convert recordings to GIF (e.g. `ffmpeg` two-pass palette); webm/mp4 don't render inline in PR bodies.
- Scrub local paths, usernames, and internal URLs from any narrative before posting.

## Reporting

Lead with the verdict and the claim it tests:

```
PR #<n> — <title>
Claim:   <the falsifiable behavior under test>
Verdict: ✅ proven / ❌ refuted / ⚠️ inconclusive
Evidence: <lane> — <artifact or link>, ...
```

If a lane comes back inconclusive, say so and name what's missing.

## Boundaries

- Orchestration + methodology; defers capture to `visual-testing` / `performance-testing` / AEP.
- Proves behavior, not code quality (pair with review skills) and not readiness *presence* (`pr-readiness-check`).
- Confirm before writing to a public PR body.
