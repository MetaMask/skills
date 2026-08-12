---
name: swaps-cpu-profile-audit
description: >-
  Parse an already-recorded Hermes / React Native Release Profiler
  `.cpuprofile` (ideally symbolicated with source maps) and audit it for slow
  frames, scoping every finding and fix proposal to the swaps/bridge screen
  and the modals or subpages it opens — quote select screen, post-trade
  modal, batch sell, asset picker/token selector. Use when a user hands you a
  `.cpuprofile` file (e.g. a `sampling-profiler-trace*.cpuprofile`, or its
  already-converted `*-converted.json`) recorded per
  `docs/readme/release-build-profiler.md` and asks to audit, analyze, explain,
  or find why the swaps/bridge flow is slow based on that trace. This is an
  offline, file-based analysis — no simulator, device, Metro, or `mm` session
  is required, unlike `swaps-perf-audit` (which measures live render counts on
  a running simulator). Findings and fix proposals are scoped strictly to
  `app/components/UI/Bridge/**`; hot frames elsewhere in the trace are never
  reported, not even as context. The report always leads with a timing table
  (capture metrics + by-area self time) and a short outcome line, and only
  adds a probable-cause/fix table when there's an actual swaps/bridge issue
  to fix — no speculative text beyond that. MetaMask Mobile only.
maturity: stable
---

# Swaps CPU Profile Audit

Turns a captured Hermes CPU profile into a swaps/bridge-scoped performance
audit: which frames under `app/components/UI/Bridge/**` actually burned time
in the capture, which surface they belong to (main screen, quote select,
post-trade, batch sell, asset picker, ...), and what to change. This skill
owns the profile-parsing protocol and the swaps-tree scoping; the fix recipes
themselves live in the `performance` skill, and the live on-device
measurement counterpart is `swaps-perf-audit`.

## When To Use

Use when the user:

- Hands you a `.cpuprofile` (or its converted JSON) and asks what's slow in
  swaps/bridge, or to audit/analyze/explain it.
- Asks "why is swaps slow" and already has a recorded trace, RC build
  profiling session, or Release Profiler capture in hand.
- Wants swaps performance fixes justified by trace evidence instead of a
  static code sweep.

Do not use for:

- Recording a *new* profile live on a simulator/device, or driving the app —
  that is manual, human-only work described in
  `docs/readme/release-build-profiler.md` (shake the device, Start, reproduce,
  Stop). This skill starts only once a `.cpuprofile` file already exists on
  disk.
- Live render-count / re-render measurement on a running simulator — use
  `swaps-perf-audit`.
- Non-swaps screens, or hot frames outside `app/components/UI/Bridge/**` —
  never report or propose fixes for these, not even as context; point the
  user at the general `performance` skill instead if they ask about
  app-wide performance.
- MetaMask Extension — Hermes/Release Profiler `.cpuprofile` capture doesn't
  exist there; this skill installs only for `metamask-mobile`.

## Workflow

1. **Locate the inputs.** You need the `.cpuprofile` path. Source maps are
   optional but strongly preferred — without them, frames stay at the
   minified-bundle level and almost nothing will resolve to
   `app/components/UI/Bridge/**`, which defeats the scoping this skill exists
   to do. If the user has sourcemaps (from a local `--sourcemap-path` or a
   `*-sourcemaps-<build>` CI artifact) but hasn't converted yet, do that next.
2. **Symbolicate.** Convert the raw profile with the project's own tool,
   which resolves bundle positions back to original `app/...` source paths:
   ```bash
   yarn react-native-release-profiler --local <profile.cpuprofile> --sourcemap-path <sourcemaps>
   ```
   This writes `<profile>-converted.json` next to the input. Skip this step
   only if the user already has a converted JSON, or has no sourcemaps at
   all (state clearly in the report that findings are then best-effort and
   file/line attribution is unreliable).
3. **Aggregate.** Run the bundled analyzer against the converted JSON (or the
   raw `.cpuprofile` as a fallback — see the repo overlay for exact usage).
   It reconstructs self time and total (inclusive) time per frame from the
   sampling data, buckets in-scope frames by swaps surface
   (`app/components/UI/Bridge/**` subfolder → BridgeView / QuoteSelectorView /
   PostTradeBottomSheet / BatchSell\* / BridgeTokenSelector / ... — see the
   repo overlay's area table), and drops out-of-scope frames from the printed
   report entirely (it only surfaces what % of the capture they accounted
   for, never a list of the actual out-of-scope files/functions). It also
   reports the capture's actual duration (no ideal/minimum comparison for
   now — just the raw timing).
4. **Read the code at the hot frames.** A `file:line` with high self time is
   a *symptom*, not a diagnosis — open the file, read the actual code at that
   location and its call sites, and identify the concrete anti-pattern (dead
   re-render, unmemoized sort/filter, unstable hook return, JSON.stringify in
   a dependency array, etc.). Cross-reference the `performance` skill's
   anti-pattern catalogue and per-pattern guides
   (`mm-selector-memoization.md`, `mm-unstable-hook-return.md`,
   `mm-redux-antipatterns.md`, `mm-hook-dependency-arrays.md`,
   `mm-context-performance.md`, `mm-eager-work-on-mount.md`, etc.) for the fix
   recipe rather than inventing one from scratch.
5. **Always report the timing table; keep prose minimal.** Every report
   leads with the timing data — the analyzer's `Metric | Value` block and its
   by-area self-time breakdown — regardless of whether an issue was found.
   Follow it with exactly one short line stating the outcome (whether
   swaps/bridge code showed up as a meaningful cost). Never report frames
   outside `app/components/UI/Bridge/**` — not as a fix target, not as
   context, not at all; if the trace's biggest cost genuinely lives
   elsewhere, simply omit it rather than mentioning it. Do not add
   speculation, hedging, or suggestions about what to check/run next beyond
   what's in Step 6 — the report is data plus outcome, nothing else.
6. **If an issue was found, add a probable-cause/fix table — nothing more.**
   One row per swaps-tree area with meaningful self time: the screen, the
   probable cause in plain language (what's happening and why — not
   "unmemoized selector" but e.g. "re-sorts the whole quote list every time
   you interact with the screen", with the concrete anti-pattern and
   `file:line`/self-ms/calls folded into that same cell), and the fix citing
   the relevant `performance` skill guide. Do not append anything after this
   table — no next-steps, no suggestion to re-run tests or capture a new
   profile, no broader speculation. The only exception is a single factual
   caveat line when something materially undermines the finding: no
   sourcemaps were available (best-effort file/line attribution) or the
   capture looks too short to cover the full journey (quote fetch, screen
   transitions, animations). Skip that caveat whenever the capture and
   findings look adequate.

The exact commands, the swaps-tree area map, and the bundled analyzer's usage
are in the repo overlay (`repos/metamask-mobile.md`).

## Output format

Always lead with the timing table (overview metrics + by-area self-time
breakdown), then exactly one short outcome line. Never include a row/section
for frames outside `app/components/UI/Bridge/**` — if the biggest cost in
the trace lives elsewhere, leave it out entirely rather than noting it as
context. Do not add anything beyond what's specified below — no
speculation, no assumptions, no suggestions about what to check or run
next.

**No in-scope issue found:**

```
# CPU Profile Audit — swaps/bridge

| Metric | Value |
|---|---|
| Capture length | ~<Xs> |
| Time spent in swaps/bridge | <Y>ms (<Z>% of all sampled time) |

| Area | Self time (ms) | % of swaps time | Hot spots |
|---|---|---|---|
| <Area> | <ms> | <%> | <n> |

No meaningful swaps/bridge performance issue in this capture — <one-line factual summary, e.g. "only <Y>ms of self time total, from <what/where>">.
```

**Issue(s) found** — same two tables, plus a probable-cause/fix table. Keep
it skimmable (a non-engineer should get the gist without decoding jargon);
fold `file:line`/self-ms/calls detail into the "Probable cause" cell rather
than adding separate columns:

```
# CPU Profile Audit — swaps/bridge

| Metric | Value |
|---|---|
| Capture length | ~<Xs> |
| Time spent in swaps/bridge | <Y>ms (<Z>% of all sampled time) |

| Area | Self time (ms) | % of swaps time | Hot spots |
|---|---|---|---|
| <Area> | <ms> | <%> | <n> |

Found <N> swaps/bridge issue(s) costing ~<Y>ms.

| Screen | Probable cause | Fix |
|---|---|---|
| <Area, e.g. "Quote select screen"> | <plain-language root cause, e.g. "re-sorts the whole quote list every time you interact with the screen"> — <self>ms, <calls>x, `<file>:<line>` | <concrete fix> (see `<guide>.md`) |

<optional single factual caveat line — only if sourcemaps were missing or the capture looked too short>
```
