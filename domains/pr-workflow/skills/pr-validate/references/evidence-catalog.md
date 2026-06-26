# Evidence catalog — extension

The menu of evidence kinds for validating a `metamask-extension` PR, with **what each proves** and **which skill or tool captures it**. This is a matching guide, not a capture cookbook — for capture mechanics it defers to the sibling skills (`visual-testing`, `performance-testing`, `e2e-test`, `e2e-flakiness-patterns`, `component-view-test`, `test-i18n-usage`, `unit-testing`, `ab-testing`) and to AEP.

Pick the evidence that would **falsify the claim if it were false**. Prefer a lane that yields an artifact a reviewer can independently re-check (a link, image, number, or replayable trace) over prose. Match, then capture — don't run the whole menu. Verify any `yarn` script name against the repo's `package.json`; they drift.

## Matching guide (claim → lanes)

| The PR claims… | Lead with | Corroborate |
|---|---|---|
| a visible UI behavior | visual (`visual-testing` / AEP `visual_validation`) | recording for motion; a11y |
| a fixed bug (any) | **falsifying test** — fails on `main`, passes on the branch | visual if visible; Sentry if it errored |
| preload / no-double-fetch / lazy-load | AEP `perf_validation` | DevTools CDP netlog, chunk membership |
| a render / over-render fix | WDYR + React DevTools | startup traces |
| interaction responsiveness | INP, long-task TBT | DevTools profile |
| startup / load timing | benchmark A/B (paired) | startup phase traces, FCP/LCP |
| smaller/cleaner bundle | bundle-size diff | chunk membership |
| a memory leak fixed | heap-over-a-flow | benchmark over time |
| an error/crash fixed | Sentry rate→0 | falsifying test, visual |
| a dependency change is safe | LavaMoat policy + manifest diff | bundle-size |
| persisted-state change | **state migration** (`changedKeys`, old→new) | vault round-trip |
| tx / confirmation behavior | transaction simulation | e2e trace |
| dapp / provider behavior | provider connectivity (EIP-1193/6963) | e2e trace |
| flag-gated behavior | feature-flag matrix (on/off) | visual per state |
| snap behavior | snaps execution | distributed trace |
| copy / localization | i18n usage | visual |

## Lanes by family

**Behavior & flow**
- **Visual before/after** — UI on a real headed build with controlled state/network. Capture via `visual-testing` (`yarn build:test:webpack` → `dist/chrome`; `mm launch` / `describe-screen` / `screenshot`; `mm mock-network` for degraded paths). Or AEP `visual_validation` (autonomous: deterministic seed + agent navigation).
- **E2E trace + video** — a replayable full-flow proof. Playwright: `yarn playwright test <spec>` (trace `on` by default; view `yarn test:e2e:pw:report`). Selenium: `yarn test:e2e:single <path> --browser chrome|firefox [--retries n]` (screenshots auto on failure). See `e2e-test`.
- **Falsifying regression test** — the strongest single proof a fix targets the bug: a new test that **fails on `main`, passes on the branch**. Show both runs. Reach for it on every bug fix.
- **Component / Storybook** — a component across states in isolation: `yarn storybook`, `yarn test-storybook` (visual + a11y via the Storybook a11y addon). See `component-view-test`.
- **Flaky-stability rerun** — run N× to prove non-flakiness (Playwright `--retries`, Selenium `--retries n`). See `e2e-flakiness-patterns`.

**Performance & render**
- **Startup / custom traces** — which phase moved: `TraceName` spans in `shared/lib/trace.ts`, read via `window.stateHooks.getCustomTraces()` (test/debug). LCP fallback mark `mm-hero-painted`.
- **Web vitals** — `window.stateHooks.getWebVitalsMetrics()` → INP/FCP/LCP/CLS (`ui/helpers/utils/web-vitals.ts`, attribution build). Note: INP fires on all pages; **FCP/LCP/CLS don't fire on popup pages** (sidepanel/E2E only).
- **Long-task / TBT** — main-thread blocking: `window.stateHooks.getLongTaskMetricsWithTBT()` (`ui/helpers/utils/performance-observers.ts`). TBT lives here, not in the web-vitals lane.
- **React render & selector** — WDYR (`ENABLE_WHY_DID_YOU_RENDER`, wired in `app/scripts/development/wdyr.ts`) for unnecessary re-renders; `yarn devtools:react` for the flame graph. Selectors use `reselect`; no built-in call counter — prove via WDYR.
- **Benchmark A/B** — `yarn test:e2e:benchmark` (presets in `shared/constants/benchmarks.ts`). The rolling baseline sits behind a `continue-on-error` step and can silently freeze — verify it's current and prefer a **paired A/B** (build both refs, compare directly). See `performance-testing` / `ab-testing`.
- **DevTools / CDP** *(manual)* — flame chart, network waterfall, JS coverage, heap snapshots over a flow (memory leaks), CPU throttling (`Emulation.setCPUThrottlingRate`), animation FPS. No repo helper — DevTools or `mm cdp`.

**Build output**
- **Bundle-size diff** — measured grow/shrink (bundle-size CI or local build comparison).
- **Chunk membership** — a module moved to the intended lazy chunk (webpack build; source-map membership).
- **LavaMoat policy diff** — no new global/builtin/package capability: regenerate `lavamoat/webpack/build/policy.json` (`yarn webpack:lavamoat:policy:build`) and `git diff`; new entries need justification.
- **Manifest permissions diff** — no scope creep: `git diff app/manifest/v{2,3}/_base.json`.
- **Build-variant matrix** — works across types: `yarn build:test:flask` / `:beta` / `:mv2`.

**Production telemetry**
- **Sentry query links** — before/after error-rate / transaction / latency, scoped to the release. For PRs that *add/change span instrumentation* (volume), use the analytics span-quota skill instead.
- **Distributed traces** — a span/transaction now appears / is shaped correctly.

**Extension integrity**
- **State migration** — a persisted-state change doesn't corrupt existing users: `app/scripts/migrations/NNN.test.js` asserts `meta.version` and that `changedKeys` covers only mutated controllers. Scaffold with `./development/generate-migration.sh NNN`.
- **Vault / keyring round-trip** — lossless encrypt→decrypt (`app/scripts/lib/encryptor-factory.ts`; `test/e2e/tests/vault-corruption/`).
- **Transaction simulation / gas** — balance-changes/gas correct before submit (`app/scripts/lib/transaction/containers/enforced-simulations.ts`; `test/e2e/tests/simulation-details/`).
- **Provider / dapp connectivity** — injection + connect + requests: `yarn dapp` (test-dapp on :8080); EIP-6963 `test/e2e/provider/eip-6963.spec.js`.
- **Feature-flag matrix** — correct in both remote-flag states: flags come from the remote client-config API (not local config); mock the response in e2e to force each state (`test/e2e/tests/remote-feature-flag/`).
- **Snaps / multichain** — snap behavior (e.g. `snap_startTrace`): `test/e2e/snaps/`, flask build.
- **i18n usage** — no hardcoded strings; locales resolve: `yarn verify-locales` (`app/_locales/`).

**CI, review & process**
- **CI check links** (`gh pr checks`), **coverage delta** (`yarn test:unit:coverage`; `codecov.yml`), automated-reviewer output, and **manual reproduction steps** (populates the PR template's Manual testing steps).

Run the cheapest lane that yields an independently re-checkable artifact, confirm the claim holds, then escalate. Don't over-instrument a one-line copy fix; don't under-prove a startup-latency or migration claim with a single screenshot.
