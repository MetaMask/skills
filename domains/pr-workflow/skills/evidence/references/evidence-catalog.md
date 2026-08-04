# Evidence catalog

The menu of evidence kinds for validating a MetaMask **extension** PR, with **what each proves**, **how to capture it (verified against the live repo)**, and **when to reach for it**. AEP is the primary autonomous engine; the rest are complementary. The skill's job is to **match evidence to the claim** and to **proactively suggest kinds the author didn't think of**.

Pick the evidence that would **falsify the claim if it were false**. Prefer a lane that yields an artifact a reviewer can independently re-check (a link, an image, a number, a replayable trace) over prose. Don't run the whole menu — match, then capture. Capture commands cite `~/Code/metamask/metamask-extension`; verify script names against its `package.json` (they drift).

Legend: **first-class lanes** are `##`-headed; closely-related variants are sub-bullets. Capture marked *(manual)* has no repo helper — it's a DevTools/CDP action.

---

## Lanes at a glance

43 lanes in 7 families. Each lane below has a full spec in its own section — what it proves, how to capture it, and its trust gate. Family G is written as one-liners rather than full sections, because those lanes are links and counts rather than captures.

| Family | Lanes | |
|---|---|---|
| **A. AEP harness (primary, autonomous)** | 3 | `A1` visual_validation · `A2` perf_validation · `A3` AEP bundle byproducts |
| **B. Behavior & flow proof** | 7 | `B1` Visual before/after via the mm CLI · `B2` E2E trace + video · `B3` Falsifying regression test · `B4` Component / Storybook visual · `B5` Accessibility · `B6` Flaky-stability rerun · `B7` Deterministic interleaving test |
| **C. Performance & render** | 9 | `C1` Startup / custom traces + phase segmentation · `C2` Web vitals · `C3` Long-task / TBT · `C4` React render & selector proof · `C5` Benchmark A/B · `C6` DevTools / CDP profiling · `C7` Memory stability over a flow · `C8` Same-window app + DevTools capture · `C9` Retention-path analysis |
| **D. Build** | 7 | `D1` Bundle-size diff · `D2` Chunk membership / source-map · `D3` LavaMoat policy / supply-chain capability diff · `D4` Manifest permissions diff · `D5` Build-variant matrix · `D6` Authored-vs-authoritative substitution A/B · `D7` Build & rebuild duration A/B |
| **E. Production telemetry** | 3 | `E1` Sentry query links · `E2` Tempo distributed traces · `E3` Sentry error-event / breadcrumb shape |
| **F. Extension integrity (high-stakes, extension-specific)** | 8 | `F1` State migration / upgrade · `F2` Vault / keyring round-trip · `F3` Transaction simulation / gas · `F4` Provider / dapp connectivity · `F5` Feature-flag matrix · `F6` Snaps / multichain execution · `F7` i18n usage · `F8` SES lockdown / runtime containment |
| **G. CI, review & process** | 6 | `G1` CI check links · `G2` Coverage delta · `G3` Automated-reviewer output · `G4` Manual reproduction steps · `G5` CI-workflow change, run on a test fork · `G6` CI job-duration delta |
---

# A. AEP harness (primary, autonomous)

## A1. visual_validation — before/after screenshots
- **Proves:** a visible UI change on the real surface. Deterministic state seed + agent navigation; PNG artifacts in `evidenceBundle.artifactRefs`.
- **Capture:** `taskClass: visual_validation`, `payload.prUrl` + `description` hint. See [aep-local-run.md](aep-local-run.md).
- **Reach for it:** anything a human would screenshot for the PR's `### After`.

## A2. perf_validation — falsifiable network/static/smoke assertions
- **Proves:** non-visible behavior (hover-preload, no double-fetch, chunk membership, smoke boot). CDP netlog / phase segmentation / source-map membership.
- **Capture:** `taskClass: perf_validation` (local/uncommitted graph; needs `yarn webpack --test`). Falls back to C6/D2 manually if the graph isn't present.

## A3. AEP bundle byproducts (free with any run)
- Test results (`executionResult`/`checkResults`), diff stats, automated `reviewResult` findings, and the **LangSmith trace** of the run. Include the relevant subset; link the trace for auditability.

---

# B. Behavior & flow proof

## B1. Visual before/after via the `mm` CLI (`visual-testing`)
- **Proves:** UI behavior on a real headed build, with controlled state/network. Defers to the public `visual-testing` skill.
- **Capture:** `yarn build:test:webpack` → `dist/chrome`; `yarn mm launch` → `mm describe-screen` / `mm screenshot` / `mm click` / `mm type` / `mm navigate`. README: `test/e2e/playwright/llm-workflow/`.
  - **Degraded-path:** `mm mock-network` to force error/slow responses (session-scoped; add after launch, before the action; can't intercept pre-launch startup).
  - **a11y / DOM:** `mm accessibility-snapshot` and `mm cdp` (per the `visual-testing` skill; `a11yRef`s are ephemeral — re-describe after navigation).

## B2. E2E trace + video (Playwright / Selenium)
- **Proves:** a full flow works, replayably. The strongest "it works end-to-end" artifact.
- **Capture (Playwright):** `yarn playwright test <spec>`; trace is `'on'` by default (`playwright.config.ts`), video is `'off'` (enable in config if needed). View: `yarn test:e2e:pw:report`. Artifacts under `public/playwright/`.
- **Capture (Selenium):** `yarn test:e2e:single <path> --browser chrome|firefox|all [--retries n]`; screenshots auto-captured on failure to `test/test-results/e2e/`.

## B3. Falsifying regression test ⭐
- **Proves — strongest single proof a fix targets the bug:** a new test that **fails on `main` and passes on the branch**. Show both runs.
  - **Engine: the `red-on-base` skill.**
- **Capture:** add the test, run it on the PR branch (pass) and on the PR's **merge-base** (fail) — pin the base, don't use whatever `main` points at today. Pair with the PR's `Fixes #N`. **Read the base failure's message, not its exit code:** it must fail on the assertion that encodes the bug. A `ModuleNotFoundError`, a missing fixture, or an unrelated pre-existing red produces an identical non-zero exit and falsifies nothing.
- **Reach for it:** every bug-fix PR. If you can't write a test that fails on main, question whether the fix addresses the reported bug.

## B4. Component / Storybook visual
- **Proves:** a component renders across states/props in isolation.
- **Capture:** `.storybook/` present; `yarn storybook` (port 6006), `yarn storybook:build`, `yarn test-storybook` (visual + a11y via `@storybook/addon-a11y`). Jest snapshot diffs for serialized output.

## B5. Accessibility (a11y)
- **Proves:** no a11y regression / an a11y improvement.
- **Capture:** `yarn test-storybook` (Storybook a11y addon) for components; `mm accessibility-snapshot` for live flows. (No axe-core in the e2e suite — don't claim it.)

## B6. Flaky-stability rerun
- **Proves:** a flow/test is not flaky (or that a fix removed flakiness).
- **Capture:** Playwright retries `1` on CI / `0` local (`playwright.config.ts`); Selenium `--retries n`; benchmarks default `--retries 2`. Run N× and report the pass rate. See `e2e-flakiness-patterns`.
- Sub: jest snapshot diffs; a unit run for just the changed module (`yarn test:unit <path>`); fuzz/property tests for parsers/encoders.

---

## B7. Deterministic interleaving test (concurrency / temporal-ordering) ⭐
- **Engine:** `race-condition-repro` — run it rather than hand-rolling the harness.
- **Proves:** an ordering guarantee under interleaving — retry, cancellation, supersession, debounce, locks, queues, async state machines — where the correctness *is* the ordering under races, not a value.
- **Capture:** force each race deterministically — `jest.useFakeTimers()` + `advanceTimersByTimeAsync(DELAY)` to fire the delayed action at a known point; `Promise.all([opA, opB])` to overlap operations; `advanceTimersByTimeAsync(0)` to step to a precise interleaving point; then assert the ordering/cancellation outcome for **each** guarantee, including asymmetric ones (one path canceled → its recovery event `.not.toHaveBeenCalled()`; another must complete → `.toHaveBeenCalledWith(...)`). Corroborate with transition telemetry; for the integration path, a live forced-race capture (C8/CDP, the #44610 technique).
- **Trust-gate:** the test must **actually interleave** — time advanced into the pending window, the superseding op injected *during* it. A sequential run exercises no race and is a vacuous green. Verify the interleaving, not just the assertion.

# C. Performance & render

## C1. Startup / custom traces + phase segmentation
- **Proves:** which startup phase moved (init → FirstRender → interactive), per named span.
- **Capture:** `shared/lib/trace.ts` `TraceName` enum (UIStartup, LoadScripts, FirstRender, …); read in test/debug via `window.stateHooks.getCustomTraces()`. LCP fallback mark: `performance.mark('mm-hero-painted')`. `driver.collectMetrics()` aggregates paint/navigation/long-task/custom traces in e2e.

## C2. Web vitals — INP / FCP / LCP / CLS
- **Proves:** a user-centric metric moved. `ui/helpers/utils/web-vitals.ts` via `web-vitals/attribution` (attribution names the causing element).
- **Capture:** `window.stateHooks.getWebVitalsMetrics()` (test/debug) → `{inp, fcp, lcp, cls, *Rating}`. Thresholds: INP good<200/poor>500, FCP<1800/3000, LCP<2500/4000, CLS<0.1/0.25.
- **Caveat:** **INP fires on all pages; FCP/LCP/CLS do not fire on popup pages** (sidepanel/E2E only). For extensions, INP is the high-value runtime metric.

## C3. Long-task / TBT
- **Proves:** main-thread blocking during an interaction dropped. This is where **TBT** lives (the web-vitals lib lane does *not* collect TBT).
- **Capture:** `ui/helpers/utils/performance-observers.ts`; `window.stateHooks.getLongTaskMetricsWithTBT()` → `{count, totalDuration, maxDuration, tbt, tbtRating}`. TBT good<200 / needs-improvement<600 / poor>600. Sampled 10% prod / 100% test.

## C4. React render & selector proof
  - **Engine: the `react-render-delta` skill.** Delegate the measurement to it; it runs the source/delivery/metric gates, derives the needle from real build output, repeats the capture, and returns a band (or "not resolvable at this n" with an MDE). evidence packages the result.
- **Proves:** a component/selector stopped over-rendering (cascade-amplification before/after).
- **Capture:** WDYR via `ENABLE_WHY_DID_YOU_RENDER` (`.metamaskrc` or env) — wired in `app/scripts/development/wdyr.ts` (`trackAllPureComponents`); console logs each unnecessary re-render. `yarn devtools:react` for the Profiler flame graph. Selectors use `reselect`'s `createSelector`, which **does expose a real `.recomputations()` counter** — read it (sample on an interval if the count should visibly climb) rather than injecting a log into the selector body; an injected log is an authored claim, a library API is an observation. *(This entry previously said there was no built-in counter. There is.)*
- **Bar:** the delivery check comes before the number. An arm whose manipulation cannot be observed in the built bundle produces a null indistinguishable from "small effect" — and reports as the second.

## C5. Benchmark A/B
- **Proves:** a startup/journey/interaction timing moved, with a distribution not one sample.
- **Capture:** `yarn test:e2e:benchmark` (`test/e2e/benchmarks/run-benchmark.ts`); presets in `shared/constants/benchmarks.ts` (`startupStandardHome`, `sendTransactions`, `swap`, `dappPageLoad`, …).
- **Caveat:** the rolling baseline (`MetaMask/extension_benchmark_stats`) can **silently freeze** behind a green check (the `store-benchmark-stats` step is `continue-on-error`; happened 2026-04-02, PR #42947). Prefer a **paired A/B** (build both refs now, compare directly) over the stored baseline.
- **Treatment check first** — before trusting any delta, confirm the mechanism under test is actually active in each arm (split chunk present in head and absent in base; the span emitted; the flag evaluated). An arm without the treatment delivered is a no-op, not a control (2026-07-22, #42795).
- **A null needs its power stated** — "no change" and "underpowered" print the same result. When the run-to-run spread exceeds the effect under test, report **not resolvable at this n** and name the smallest detectable effect; never let it read as "no effect". Correcting a known bias (discarding a warm-up, alternating the starting arm) removes *that* bias and nothing more — it is not a trust gate, and the confounds you did not enumerate (thermal drift, background load, ordering within a round) stay live.

### Capturing an authenticated view (the in-situ requirement)

Headless Chrome's `--screenshot` cannot set cookies, so an authenticated dashboard
(Grafana/Tempo, Sentry Discover, an internal panel) screenshots as a login page. Drive
Chrome over CDP instead — inject the session cookie, navigate, capture:

```bash
COOKIE_NAME=grafana_session COOKIE_VALUE="$sess" COOKIE_DOMAIN=<host> \
  cdp-shot "<deep-link URL>" out.png 25000 1500 2400
```

- **Deep-link to the exact view** so the capture and the reader's verification path are the
  same URL (Grafana: `/explore?schemaVersion=1&panes=<urlencoded>`).
- **Wait generously** — a trace waterfall or Discover table renders well after `load`.
- **Capture tall + `captureBeyondViewport`**, then crop; the interesting span is usually
  below the fold, and cropping after the fact beats guessing a viewport.
- **Crop out the chrome that identifies the operator** (profile avatar, org switcher)
  before the image leaves the machine.
- **Keep the trace/query id, timestamp, and result count in frame** — that is what makes
  the exhibit reproducible rather than decorative.
- Never echo the cookie value, never commit it, never pass it to a subagent.

## C6. DevTools / CDP profiling *(manual)*
- **Proves:** a flame-chart hot path shrank, a request was removed/deferred, frame rate held, or it holds on slow hardware.
- **Capture (manual via DevTools or `mm cdp`):** performance profile / flame chart; network waterfall (HAR) + request-count delta; **CPU throttling** (CDP `Emulation.setCPUThrottlingRate` — *no repo helper*, set it in DevTools); **animation/Rive FPS / dropped frames** (DevTools rendering FPS meter — *no repo helper*); JS coverage for dead-code.

## C7. Memory stability over a flow *(manual)*
- **Proves:** a leak is fixed across repeated interactions (not one snapshot): retained heap stays flat, detached DOM nodes / listeners don't accumulate.
- **Capture:** DevTools heap snapshots before/after N cycles of the flow; compare retained size + detached nodes.
- Sub: redux dispatch/action count per interaction; network payload bytes; forced-reflow / layout-thrash count (DevTools Performance).

## C8. Same-window app + DevTools capture *(manual)*
- **Proves:** the UI behavior **and** its internal evidence (console log, network row, storage state) in **one frame** — cause and effect temporally correlated in a single artifact. Two separate captures can't prove they came from the same run; one frame can. Canonical use: "the toast does NOT appear *while* the console shows the silent-handling path executed".
- **Capture (macOS, OS-level — Playwright `recordVideo` sees only the page viewport, never DevTools):**
  1. Tab-target DevTools: launch Chrome with `--auto-open-devtools-for-tabs` so DevTools opens **docked in the same window** (dock side persists per profile; set once via the DevTools ⋮ menu if a fresh profile defaults to undocked).
  2. MV3 **service-worker console has no dockable host** — open its dedicated inspector (`chrome://extensions` → *Inspect views: service worker*) and tile it flush beside the app window: `osascript -e 'tell application "Google Chrome" to set bounds of front window to {x, y, w, h}'` (the SW inspector is a Chrome window too and tiles the same way; CDP `Browser.setWindowBounds` also works per `windowId`).\
  3. Record the union region, not a single window: stills `screencapture -x -R<x,y,w,h> out.png`; video `screencapture -v -V <seconds> -R<x,y,w,h> out.mov`, then ffmpeg two-pass palette → GIF (recipe in [evidence-publishing](evidence-publishing.md)). First use prompts for macOS Screen Recording permission for the terminal.
- **Legibility rule:** console text dies in GIF downscale. Keep the GIF ≥720px wide, and pair it with (a) a full-res PNG of the same frame and (b) a text dump of the console via CDP (`Runtime.consoleAPICalled` on the SW target, `npx mm cdp` or a 20-line ws script) so the log lines are quotable/searchable.
- **Trust note:** arrange windows *before* triggering the behavior so the recording shows trigger → console line → UI (non-)reaction as one continuous take; a post-hoc composite of separate captures is exactly what this lane exists to avoid.

---

## C9. Retention-path analysis — memory leak from code ⭐ *(static; lead for leak claims)*
- **Engine: the `memory-leak` skill.** For a memory-leak claim, delegate the analysis to `memory-leak` — it runs Phase-1 static pairing (and Phase-2 heap investigation if a primitive can't be paired) and returns the paired/unpaired sites + verdict. evidence keeps **memory leak** as the evidence category: it invokes the skill on the diff and packages the result (in-situ scan capture, plus the lifecycle test / retainer graph if Phase 2 ran) as the category's evidence. The lane spec below is the method that skill implements.
- **Proves:** "X is retained past its lifecycle boundary" / "collection Y grows unboundedly" — argued from code, no runtime needed. This is the lane that works at **review time** (does this PR *introduce* retention?) and leads fix-side validation (does the fix *break* the retention path?). C7 is the runtime corroborator, not the lead — leaks need many cycles to exceed noise.
- **Capture — the holder → held → boundary triple, per suspect:** (1) the **holder** (listener, closure, module singleton, accumulating collection, timer); (2) the **held set** — the *specific* objects pinned (list the closure's captures; note when a closure links two objects' GC); (3) the **outlived boundary** (`destroy()`, stream close, instance replacement, request completion). Method: **pair every acquire with its release site** (`on`↔`removeListener`, push↔drain, assign↔null) — the absence of the pair, cited at the acquire site, IS the finding. Four canonical shapes: unbounded accumulator (defeated guard, no drain) · stale-instance listeners on replacement · unremoved listener + capture set · retention past `destroy()`.
- **Scope to the diff, or you invent findings.** Classify every flagged primitive as *introduced by this PR* (in the added lines) vs *pre-existing* (already in the file). Charge only the introduced ones to the PR; report pre-existing un-paired primitives separately and uncharged. On extension#40684 the two new stream listeners each had a `removeListener` on `onStreamClosed` (the exact fix a reviewer suggested) and the new pending-request Map had its `.delete` — no leak introduced — while three pre-existing un-torn-down listeners were surfaced but left uncharged, matching how the human/bot reviewers treated them in-thread. This lane *is* the retention review automated; a heap snapshot (C7) is warranted only for an introduced primitive it cannot pair.
- **Corroborate:** a falsifying lifecycle test (force the boundary, assert release — listener count zero, singleton nulled, collection drained); C7 heap-over-flow with the **retainer graph naming the same path** the static argument named.
- **Trust-gate:** the triple must be specific ("this listener holds `patchStore` after `patchStore.destroy()`", not "might leak"); distinguish **bounded staleness vs unbounded growth** (severity differs); attribute **introduced vs pre-existing** honestly.

# D. Build

## D1. Bundle-size diff
- **Proves:** the build grew/shrank by a measured amount. Use the bundle-size CI output or a local build size comparison.

## D2. Chunk membership / source-map
- **Proves:** a module moved to the intended (lazy) chunk and no longer ships on the critical path. Requires the webpack build. Mirrors AEP `perf-chunks`.

## D3. LavaMoat policy / supply-chain capability diff
  - **Engine: the `supply-chain-audit` skill** (umbrella — lockfile/manifest diff, advisories, Socket Security, install scripts), which delegates capability grants to **`lavamoat-policy`** (per-grant call-site justification). Delegate the dependency change to the umbrella; it returns a disposition per lane. evidence keeps **supply-chain capability diff** as the evidence category and packages the output. Note the lanes are independent: a clean policy diff does not mean a safe dependency, and a known CVE never appears as a new grant.
- **Proves:** a dependency change (bump/add/lockfile) grants **no *unjustified* new capability** — the supply-chain-risk lane. Note the bar: for a bump the policy *will* change, so "empty diff" is the WRONG test; the right test is **every new grant is justified by the dep's function**..
- **Capture:** **Prefer the CI-generated policy whenever one is available.** `@metamaskbot update-policies` regenerates the policy files from a real run of the code and `validate-lavamoat-policies` fails the build on drift, so the committed policy on a bot-run PR *is* the authoritative artifact — diff that. Regenerating locally when a current CI policy exists only re-does a machine that is already trusted, and a local run's provenance is weaker (your node/OS/lockfile resolution, not CI's). **Local regen is the fallback**, for when the bot hasn't run yet, the branch is unpushed, or you need a variant CI didn't cover: `yarn webpack:lavamoat:policy:build` (`:mv2` / `:mv3` for variants) over `lavamoat/webpack/build/policy.json` (+ `policy-override.json`). Either way, `git diff` the policy across **all 8 variants** (mv{2,3}/{main,beta,flask,experimental}) — a grant can appear in one and not others. Then audit **grant-by-grant**: new **globals** (`fetch`, `importScripts`, `WebAssembly`) / **builtins** (`fs`, `child_process`) on a dep that shouldn't need them, new **packages** edges to powerful APIs, or an identifier substitution (`pkgC>name` replacing `pkgB>pkgA>name` = possible dep swap). Falsifier = a surprising grant ("I wonder what it's using this for"). Guide: lavamoat.github.io/guides/policy-diff/. `allowScripts` in `package.json` gates install scripts.

## D4. Manifest permissions diff
- **Proves:** no permission/host-permission scope creep.
- **Capture:** `git diff app/manifest/v3/_base.json app/manifest/v2/_base.json` (+ `chrome.json`/`firefox.json`). Flag new sensitive perms (webRequest, broad host patterns).

## D5. Build-variant matrix
- **Proves:** the change works across build types, not just main.
- **Capture:** `yarn build:test:flask` / `:beta` / `:mv2` (`ENABLE_MV3=false`, Firefox). Run the relevant lane per variant when behavior is build-type-gated.

## D6. Authored-vs-authoritative substitution A/B ⭐ *(fixed head; lead for "the artifact restates a source" claims)*
- **Proves:** whether an artifact the PR *hand-wrote* agrees with the source it restates — a type vs the value's real type, a hand-maintained schema vs the generated one, a vendored constant vs the upstream export, a checked-in policy vs `update-policies` output. The finding is the **delta in a checker's output**, not a reading of the diff.
- **Shape:** both arms sit at the **same commit**; they differ by a *substitution*, not by a ref — so there is no build, no rebase, and no merge boundary to confound.
  - **Arm A** — the PR as written, run through the checker. Must be **silent**. A non-empty Arm A means the instrument is broken and Arm B is unreadable (see trustworthiness gate item 19).
  - **Arm B** — same tree, with the authored artifact replaced by the **derived** equivalent, exercised exactly as the real code exercises it. Every new diagnostic is a disagreement the authored version concealed.
- **Capture (TypeScript worked example — extension#44397, 2026-07-30):**
  ```bash
  # Arm A — baseline. Expect zero errors.
  NODE_OPTIONS='--max-old-space-size=9216' npx tsc -p tsconfig.json --noEmit
  # Arm B — probe files that substitute the derived type and call it as the caller does.
  mkdir -p app/scripts/derive-probe && cp probe-*.ts app/scripts/derive-probe/
  NODE_OPTIONS='--max-old-space-size=9216' npx tsc -p tsconfig.json --noEmit   # diagnostics = the findings
  rm -rf app/scripts/derive-probe
  ```
  One probe per claim, each naming the authoritative source in a header comment and calling the derived type the way the real call site does. Keep the probes as the artifact — they are the re-runnable falsifier.
- **Why it finds what review and CI miss:** the authored artifact compiles, so CI is green *by construction*. In a partially-migrated repo the asymmetry is structural — with `checkJs` off, a type written for a function whose callers are still `.js` is checked against nothing, and drifts silently forever. Those boundaries are where the lane pays.
- **Traps:** (a) **a substitution can fail for the wrong reason** — a diagnostic on an earlier property short-circuits the one under test, and counting exit codes reads that as confirmation; assert on the *specific* diagnostic, and re-probe with the earlier cause neutralised (`NonNullable<…>`, a targeted assertion) to isolate each claim. Same hazard as B3's "fails on base for the wrong reason." (b) **no authoritative source may exist** — an unshipped package's types, a lib not in tsconfig `lib`, a genuinely new boundary the repo owns. Hand-writing is then *correct*; report it as a cleared falsifier, not a finding.
- **Pairs with:** [lane-assertions.md](lane-assertions.md) for the recipe form; D3 when the substituted artifact is a LavaMoat policy.

---

## D7. Build & rebuild duration A/B *(paired; lead for toolchain-change claims)*
- **Proves:** what a toolchain change costs or saves in the **dev loop** — a loader, transform, linter, or bundler swap. Distinct from `C5`, which times the shipped app at runtime; this times the build that produces it. The two move independently and in opposite directions often enough that measuring one and inferring the other is the failure this lane exists to prevent (`React Compiler` builds slower and runs faster; `thread-loader` builds faster and runs identically).
- **Shape:** paired A/B, both arms built now, on one machine, alternating order. **Cold and warm are separate questions and get separate numbers** — never one figure labelled "build time".
- **Capture:** N ≥ 5 per arm per mode, alternating. Cold: clear the cache explicitly between arms (`node_modules/.cache`, webpack `cache.cacheDirectory`) and state what was cleared. Warm: touch one source file, rebuild, discard the first result as pool warmup. Report median **and spread**; a median without spread hides a bimodal cache effect.
- **Falsifiers — each returns a favourable number when uncontrolled:** warm cache leaking into the "cold" arm (the largest confound, and the easiest to introduce by running arms in sequence); worker-pool startup counted once and amortised across rebuilds; core count, since parallel loaders scale with the runner and a laptop result does not transfer; watch-rebuild numbers presented as cold-build numbers.
- **Trust-gate:** state machine, core count, N, and cache handling per arm, or the number is unreproducible. A null result states the smallest effect the sample could have detected — "no difference" from N=3 is not a finding. Renders **no ship verdict**: a change that costs build time and buys runtime is a trade, and pricing it is not the same as taking it.
- **Corroborate:** `G6` for the CI half (different machine, different confounds), `C5` for the runtime half. A toolchain claim is not closed by one surface.

# E. Production telemetry

## E1. Sentry query links (before/after)
- **Proves:** error-rate / transaction count / latency moved in prod. A link a reviewer opens beats a chart screenshot.
- **Capture:** Sentry MCP (`search_events`/`search_issues`) → hand the discover/dashboard link with the before/after window, scoped to the release. Projects: `metamask` = prod, `metamask-performance` = CI.
- **Boundary:** PRs that *add/change span instrumentation* (volume/quota) → `/sentry-quota`, not this lane.
- **Perf-PR promotion (standard, not just complementary):** for a **performance-focused PR**, the main-branch Sentry **trend** for the affected metric across the PR's merge (before/after the merge commit's release) is **standalone lead evidence** — CI already sends every main/release `startupPowerUserHome` / journey benchmark to Sentry, so the trend is a real before/after on the actual metric, continuously tracked, with no local run. Prefer it over a local paired A/B when a clean merge-boundary window exists: it sidesteps the stale committed-baseline trap (`benchmark-baseline-staleness-paired-ab`). Still bound to the trust gate — a **windowed, release-scoped, one-click-resolvable** trend link with the merge boundary visible, never a prose "looks fine." A local interleaved paired A/B (C5) remains the precision complement when the merge window is noisy or the metric CI doesn't track (selector-eval count, re-render count, INP-on-typing — none of which CI captures).

## E2. Tempo distributed traces
- **Proves:** a span/transaction now appears / is shaped correctly (e.g. background-RPC tracing). Link the trace + note the release.

## E3. Sentry error-event / breadcrumb shape
- **Proves:** an instrumentation PR captures the intended error-event state / breadcrumbs (relevant after the Sentry-v10 error-event capture changes). Show the captured event payload.

---

# F. Extension integrity (high-stakes, extension-specific)

## F1. State migration / upgrade ⭐
- **Proves:** a persisted-state change doesn't corrupt existing users.
- **Capture:** migrations in `app/scripts/migrations/NNN.ts`, runner `app/scripts/lib/migrator/`; scaffold with `./development/generate-migration.sh NNN`. The `NNN.test.js` asserts `meta.version` and that the `changedKeys` Set covers only mutated controllers — i.e. untouched state is preserved. Run it; show old-state-in / new-state-out.

## F2. Vault / keyring round-trip
- **Proves:** no key/vault corruption; encrypt→decrypt is lossless.
- **Capture:** `app/scripts/lib/encryptor-factory.ts` (`@metamask/browser-passworder`, PBKDF2). E2E: `test/e2e/dist/vault-decryption-chrome.spec.ts`; `test/e2e/tests/vault-corruption/`. Storage-size via `getFileSize` on the encrypted blob.

## F3. Transaction simulation / gas
- **Proves:** tx behavior/balance-changes/gas are correct before submit.
- **Capture:** `app/scripts/lib/transaction/containers/enforced-simulations.ts`; e2e `test/e2e/tests/simulation-details/`; mock `test/e2e/tests/confirmations/mocks/simulation.ts` (returns `gasUsed`, `callTrace`, `stateDiff`, token balance changes). TX_SENTINEL_URL in `shared/constants/transaction.ts`.

## F4. Provider / dapp connectivity
- **Proves:** dapp integration works (injection, connect, requests).
- **Capture:** `yarn dapp` (serves `@metamask/test-dapp` on :8080); EIP-6963 `test/e2e/provider/eip-6963.spec.js`; multi-provider `test/e2e/multi-injected-provider/`; EIP-1193 reconnect tests under `test/e2e/tests/mm-connect/`.

## F5. Feature-flag matrix (on/off)
- **Proves:** correct behavior in both remote-flag states (the Perps-gating class of bug).
- **Capture:** remote-feature-flag-controller (`app/scripts/lib/update-remote-feature-flags.ts`); flags come from `client-config.api.cx.metamask.io/v1/flags` — **not** `.metamaskrc`. In e2e, mock the response (see `test/e2e/tests/remote-feature-flag/`) to force each state; read via `uiState.metamask.remoteFeatureFlags`.

## F6. Snaps / multichain execution
- **Proves:** snap behavior across multichain (e.g. `snap_startTrace`/`snap_endTrace`).
- **Capture:** `test/e2e/flask/snaps/preinstalled-example.spec.ts` (the snap-trace test), broader `test/e2e/snaps/`. Build flask (`yarn build:test:flask`).

## F7. i18n usage
- **Proves:** no hardcoded strings; locales resolve.
- **Capture:** `yarn verify-locales` (`development/verify-locale-strings.js`); locales in `app/_locales/`. `yarn verify-locales:fix` to auto-fix.

## F8. SES lockdown / runtime containment ⭐
- **Proves:** the runtime defenses are **actually in force in the shipped artifact** — SES `lockdown()` and its taming levels, LavaMoat global scuttling, Snow's anti-escape hooks, Snaps compartments. Distinct from D3: D3 is the build-time *policy* (what a package may reach), this is whether containment *holds at runtime*. A correct policy ships alongside a lockdown that silently failed, and no policy diff would show it.
- **Capture:** `Runtime.evaluate` over CDP against the **built variant under discussion** — `Object.isFrozen(Object.prototype)`; a scuttled global throws while an exception-list global still resolves; `typeof SNOW === 'function'`; the `lockdown({…})` options as they appear *in the bundle*. Pair a positive with a negative — a check that only confirms the permitted case passes in a completely unlocked environment.
- **Bar — three divergences make this a lane, not a checkbox:** (1) the `lockdown()` call is wrapped in `try/catch` that logs to Sentry and **continues unlocked** (added for Firefox v56 contentscript injection), so it is a runtime assertion, never a guaranteed precondition; (2) **scuttling is off entirely in DEV builds** (`shouldScuttle = entryTask !== BUILD_TARGETS.DEV`); (3) **TEST builds widen the scuttling exception list** for chromedriver (`Proxy`, `ret_nodes`, `browser`, `chrome`, `indexedDB`). So **a green e2e run is evidence about a wider-open global than users get** — always state which build variant produced the evidence.
- **Reach for it:** any change touching the lockdown call site or its ordering (lockdown must precede untrusted code), the scuttling exception list, a taming level, compartment boundaries, or a `@lavamoat/snow` bump (Snow is patched in-repo — re-read the patch; see `supply-chain-audit`'s patch lane).

---

# G. CI, review & process

- **G1. CI check links** — `gh pr checks <n>`; link the full suite (AEP's bundle is often `partial`). Always worth a one-line "all green" + link.
- **G2. Coverage delta** — `yarn test:unit:coverage` → `coverage/unit/` (and `yarn test:unit:webpack:coverage`); `codecov.yml`. Proves the new code is exercised.
- **G3. Automated-reviewer output** — independent bot (e.g. cursor[bot]) found nothing blocking. Complements, never replaces, behavior evidence.
- **G4. Manual reproduction steps** — human-followable steps that reproduce the fixed behavior; populates the PR template's Manual testing steps.
- **G5. CI-workflow change, run on a test fork** — a CI-YAML-only PR usually **cannot exercise the workflow it edits**: identical build output ⇒ builds reused from base ⇒ `needs-<X>=false` ⇒ the workflow is *skipped* (`get-requirements.yml:654`). Escape: push to a branch literally named **`main`** (or `stable`) on your own test fork of the repo — `IS_RUN_EVERYTHING_BRANCH` (line 48) disables `find-reusable-builds` (line 310), so the workflow runs; `IS_CROSS_REPO_PR` is false inside the fork. Requires the workflow's secrets on the fork (`INFURA_PROJECT_ID`, `TEST_SRP_*` for benchmarks; `vars.`-gated Sentry/AWS steps skip cleanly) and a fork sync first. **State fork-scope in the published evidence** — it proves the workflow logic, not a run on the canonical repo..
- **G6. CI job-duration delta** — compare job wall-clock across arms in the Actions UI or `gh run view`. **Falsifier: build reuse.** `get-requirements.yml` skips jobs when build output matches base, so a measured "speedup" is often a skipped job — confirm each arm actually ran the work before comparing. Runner class and queue time vary independently of the change; report job time, not wall-clock from push. Pairs with `D7`, which measures the same change on a machine you control.

---

# Matching guide (claim → lanes)

| The PR claims… | Lead with | Corroborate |
|---|---|---|
| a visible UI behavior | A1 / B1 visual | B2 recording for motion; B5 a11y |
| a fixed bug (any) | **B3 falsifying test** | A1/B1 if visible; E1 if it errored |
| preload / no-double-fetch / lazy-load | A2 perf | C6 netlog, D2 chunk |
| a render/over-render fix | C4 WDYR/profiler | C1 traces |
| interaction responsiveness | C2 INP, C3 TBT | C6 profile |
| startup/load timing | C5 benchmark (paired) | C1 phase traces, C2 FCP/LCP |
| smaller/cleaner bundle | D1 size | D2 chunk |
| a memory leak fixed / introduced | **C9 retention-path from code** (holder → held → boundary) | C7 heap-over-flow + retainer graph; falsifying lifecycle test |
| an error/crash fixed | E1 Sentry rate→0 | B3 test, A1 if visible |
| a dep change is safe | D3 LavaMoat + D4 manifest | D1 size; supply-chain-audit's patch/resolutions/ignore lanes |
| a mechanical migration / "rename-only" refactor | **D6 substitution A/B** (authored artifact vs its authoritative source) | B3 if behavior-visible; D1 for accidental output change |
| a hand-written type/schema/policy restates a source | **D6 substitution A/B** | G1 checks (as the *premise*: it compiles, which is why nobody noticed) |
| runtime containment / SES / scuttling | **F8 runtime containment** (on the shipped variant) | D3 policy; E1 for `Lockdown failed` events |
| persisted-state change | **F1 migration** | F2 vault |
| tx/confirmation behavior | F3 simulation | B2 e2e |
| dapp/provider behavior | F4 connectivity | B2 e2e |
| flag-gated behavior | F5 flag matrix | A1/B1 per state |
| snap behavior | F6 snaps | E2 trace |
| copy/localization | F7 i18n | A1 visual |
| CI workflow behavior | **G5 fork run** (branch named `main`) | G1 checks, G4 repro steps |

Run the cheapest lane that yields an independently re-checkable artifact, confirm the claim holds, then escalate. Don't over-instrument a one-line copy fix; don't under-prove a startup-latency or migration claim with a single screenshot.
