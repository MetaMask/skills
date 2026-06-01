# Extension fix-ticket checklist

Use this target-specific checklist for `metamask-extension` bug tickets. Execute in order; mark every row in the copied `CHECKLIST.md` with `[x]`, `BLOCKED`, or `N/A: <reason>`.

## Live checklist template

Copy this file to the task artifact folder as `CHECKLIST.md` before product edits. Execute top-to-bottom. Every gate is mandatory unless marked `N/A: <reason>` in the copied file. After each gate, edit the copied file from `[ ]` to `[x]` and add the artifact/path/result below that line. Do not mark final complete with unchecked required gates.

- [ ] **0. Coffee handoff + progress file** — Human-facing handoff names the copied `CHECKLIST.md` path to monitor.
- [ ] **1. Ticket captured** — URL or pasted text, summary, requirements, ACs.
- [ ] **2. AC matrix written** — Verbatim numbered ACs; proof mode: `state`, `visual`, or `mixed`; primary evidence.
- [ ] **3. Target runtime selected** — Mobile/Extension + platform/env + rationale.
- [ ] **3a. Clean per-run branch prepared** — Worktree clean or previous loop stashed; model-specific branch created; Jira branches start with lowercased ticket key plus hyphen (for example `tat-3216-...`); base SHA recorded for later diff comparison.
- [ ] **3b. Clean generated harness/runtime state prepared** — Ignored stale outputs removed or task-local harness output selected; harness install path recorded.
- [ ] **4. Baseline/repro plan written before behavior edits** — Route, fixture/state setup, selectors/testIDs, expected before evidence.
- [ ] **5. `mms-recipe-harness` delegate completed install/verify** — Manifest + verify artifact path.
- [ ] **6. Baseline/no-state recipe authored by `mms-recipe-cook`** — Recipe path + exact command, or `BLOCKED: <reason>`.
- [ ] **7. Baseline/no-state recipe run** — `summary.json`, `trace.json`, screenshot/manifest paths, or blocked reason.
- [ ] **8. Minimal fix implemented** — Product diff summary; no harness/generated files counted as product diff.
- [ ] **8a. Surgical diff audit** — Every changed product line maps to an AC; no duplicate implementation surfaces; no unrelated cleanup/refactor.
- [ ] **9. Focused checks run** — Changed-file typecheck/Jest/lint results. This is not a stop gate.
- [ ] **10. After/with-state recipe updated by `mms-recipe-cook`** — Recipe path + exact command proving each AC.
- [ ] **11. Runtime recipe run** — `summary.json`, `trace.json`, artifact manifest, logs.
- [ ] **12. Visual evidence gate** — Read every PNG; for visual/mixed ACs, claimed UI is visible in viewport.
- [ ] **13. `mms-recipe-quality` delegate/subagent critique** — Verdict table; gaps assigned to product/recipe/fixture/harness/evidence.
- [ ] **14. Improvement/rerun loop** — One fix + rerun, or explicit “no rerun needed” from quality verdict.
- [ ] **15. `mms-recipe-evidence` package** — PR-ready evidence block/file with artifact paths and blocked gaps.
- [ ] **16. Resource cleanup prompt** — Ask whether to stop webpack/dev server/browser/CDP or keep runtime alive for review; record the answer.
- [ ] **17. Final response** — Fix, tests, recipe evidence, quality loop, task path, PR package path, remaining risk.

Extension-specific gates:

- Before starting or restarting any runtime command, record the exact command and approval state in this checklist. After read-only runtime discovery, if the caller/orchestrator requires explicit runtime-start approval, do not create `manual-prewarm`, `nohup`, background tmux, detached `sleep`, ad-hoc cache-warming helpers, repo aliases such as `yarn a:ios` / `yarn a:android`, or direct preflight/start scripts such as `scripts/perps/agentic/start-metro.sh --launch` to bypass it; mark `BLOCKED: pending runtime-start approval` with the exact command instead. Prefer installed harness cache/watch-first commands after approval, and do not use Mobile `auto`, `default`, `clean`, `rebuild-native`, manual bundle prewarm/cache warming, Extension `--start-test-watch`, raw `yarn build:test`, or Extension prepare/build unless that exact heavier mode was explicitly approved.
- Runner command form: Claude/Cursor use `/mms-recipe-*`; Codex/OpenAI agents use `$mms-recipe-*`. When this checklist names `/mms-recipe-harness`, `/mms-recipe-cook`, `/mms-recipe-quality`, `/mms-recipe-evidence`, or `/mms-recipe-wallet-control`, use the runner-appropriate command form or the installed delegate file path for the current runner.

- Generated harness state must be clean before harness install. Remove stale ignored outputs (`${RECIPE_HARNESS_ROOT:-temp/agentic/recipe-harness}/extension`) then install normally. For task-local recipe artifacts, pass `--out <task-local-recipes>` to harness `verify`/`live` (install does not take `--out`); do not let live verify fall back to stale/default installed runner recipes. Delete the stale outputs first; the extension install is idempotent and has no overwrite/force flag.
- Runtime discovery is portable: prefer `RECIPE_RUNTIME_CONTEXT`, `RECIPE_SLOT_ID`, `RECIPE_CDP_PORT`/`CDP_PORT`, `RECIPE_METRO_PORT`/`METRO_PORT`, `RECIPE_WATCHER_PORT`/`WATCHER_PORT`, simulator/device env, and installed harness summaries before probing fallback ports. If `temp/runtime/agentic-runtime.json` has `runtimeStart.approved: true` plus `runtimeStart.command`, recover runtime through `mms-recipe-harness` launch/live and let the harness run that approved command. Do not assume `9222` or start raw product builds when no context is present; record missing runtime context instead.
- Harness boundary: do not edit installed `mms-recipe-harness`/wallet-control/cook/quality/evidence delegate files, `${RECIPE_HARNESS_ROOT:-temp/agentic/recipe-harness}` overlays, or copied adapter scripts during a product/ticket run. Inspect summaries/logs only enough to classify failures. If a harness code change is required, stop the runtime lane as `BLOCKED: harness defect` with artifact paths.
- Delegate recovery order: runtime/CDP blockers go through `mms-recipe-harness` launch/live/verify with caller-approved context; wallet/login/account/route blockers go through `mms-recipe-wallet-control`; stateful setup blockers go through recipe/harness/wallet-supported real flows or documented pre-start fixtures. If the delegate cannot recover, stop with the concrete blocker and artifacts; do not jump to ad-hoc scripts, direct state mutation, or partial evidence packaging unless the human explicitly asks.

- Because `/mms-recipe-fix-ticket` was invoked, do not switch to the dev protocol or mark baseline/repro `N/A` merely because the Jira says POC/debug. Attempt a before/no-state recipe or record the concrete `/mms-recipe-cook` blocker.
- Name the browser context and UI target (`popup`, `sidepanel`, `fullscreen`, dapp tab, or service worker/controller).
- Do not ask whether to proceed with harness/recipe validation after typecheck or Jest. Proceed automatically.
- A stopped browser/dev server/CDP endpoint is not a user blocker only after runtime-start approval exists. If approval is required and absent, do not run prepare/watch/Chrome-launch/manual aliases; run static/no-start harness checks if useful, record `BLOCKED: pending runtime-start approval` with the exact command, and wait.
- Only mark runtime proof `BLOCKED` after a concrete harness or recipe command has been attempted and failed for an external reason.
- CDP bootstrap failure is a stop/root-cause gate, not a packaging gate. If a live Extension recipe cannot connect to the recorded CDP port, `/json/version` is unreachable, no extension target is available, or the runner emits no `summary.json`/`trace.json`, mark the runtime gate `BLOCKED: CDP bootstrap failed`, record the exact command/log path, stop before recipe-quality/evidence packaging, fix runtime/preflight root cause, then restart from clean generated harness state. Do not call this `pass-with-gaps` unless the human explicitly asks for a partial package.
- Direct app/browser scripts, DOM evals, or screenshots are supporting evidence only. They do not satisfy gates 5–15 unless `/mms-recipe-harness`, `/mms-recipe-cook`, `/mms-recipe-quality`, and `/mms-recipe-evidence` were explicitly invoked/followed and produced the recipe package artifacts.
- Do not claim recipe infrastructure is absent just because a repo-root `validate-recipe.js` is missing. Check installed skill delegate paths first (`.claude/skills/mms-recipe-harness`, `.agents/skills/mms-recipe-harness`, `.cursor/rules/mms-recipe-harness`) and follow their scripts/adapters. If no executable `recipe.json` plus harness-produced `summary.json` and `trace.json` exists, classify runtime/visual proof as `FAIL`/`BLOCKED: no recipe protocol`; ad-hoc CDP probes, manual evidence markdown, black screenshots, or human-to-confirm notes do not satisfy the recipe gates.
- Do not manufacture proof by mutating app state: no `window.stateHooks`, `stateHooks.submitRequestToBackground`, Redux/store writes, React/fiber mutation, DOM injection, controller/provider mutation, or helper that directly creates, closes, clears, seeds, or inserts the target position/value/banner. Use a real user flow or harness-owned pre-start fixture; otherwise mark the affected AC as a fixture/runtime gap.
- If visual proof is needed, screenshot after a `ui.wait_for` with `visible` (the target is present and on-screen); use `ui.scroll` with `scroll_into_view` first if it can be below the fold.
- DOM query or controller eval success is not enough for UI claims; inspect the PNG.
- For visual/mixed ACs, never mark an AC `code-proven`. If no runtime PNG/video exists because CDP/browser is unavailable, the visual AC is `BLOCKED: no runtime visual evidence`.
- If CDP/browser state cannot be prepared and runtime-start approval exists, run harness recovery once before declaring `BLOCKED`. If runtime-start approval has not been granted, do not run prepare/watch/Chrome-launch or any command that starts a runtime process; record `BLOCKED: pending runtime-start approval` with the needed command and wait.
- Fix schema warnings before packaging visual proof. Give `ui.screenshot` nodes a
  `description` and assert "must (not) show" with `assert_json`/`assert_output`;
  warning-only schema output is not a clean final state.
- If the runner/harness does not emit `artifact-manifest.json`, create an
  explicit evidence manifest that lists recipe path, exact command,
  `summary.json`, `trace.json`, logs, screenshots/videos, quality verdict, and
  remaining gaps.
- `/mms-recipe-evidence` packaging must produce a PR-ready evidence block/file (for example `PR-READY-EVIDENCE.md`) and run `package-pr-evidence.js --task <task-dir>` so reviewers get `pr-package/pr-desc.md` based on the target repo `.github/pull-request-template.md` / `.github/pull_request_template.md`, `pr-package/images/` with easy-to-copy filenames, `pr-package/package-manifest.json`, and `pr-package/final-report.md`. A manifest-only package is still `PASS-WITH-GAPS` for the workflow packaging gate.
- Final response must print `Task path:`, `PR package path:`, `PR description draft:`, and `Evidence images folder:` so the human can immediately copy/upload PR evidence.
- Do not stop at an idle prompt after recipe PASS. Continue through gates 13-16
  (`/mms-recipe-quality`, improvement/rerun or no-rerun verdict,
  `/mms-recipe-evidence`, final summary).
- A failed recipe/action node is not a final blocker after one attempt. Inspect
  `summary.json`/`trace.json`, the failure screenshot/last-screen artifact, and
  the actual target screen. If the failure is plausibly caused by route, wait,
  hydration, scroll, obscured target, unstable click/press, or selector quality,
  patch the recipe/flow and rerun the smallest meaningful segment before final
  packaging. Only report `BLOCKED` after concrete retry attempts still fail, and
  name the exact failed node plus artifacts. Unit tests or manual screenshot
  suggestions do not replace the missing live recipe proof for visual/mixed ACs.
- Fallback screenshot metadata controls verdict strength. If a screenshot PNG says
  `DOM-rendered fallback evidence`, `native browser screenshot timed out/blank`,
  or `trace.json` records `fallbackReason` for that screenshot, read and package
  it but keep visual/mixed ACs at `PASS-WITH-GAPS` unless native screenshot/video
  or an explicitly accepted non-fallback artifact also proves the claim. A recipe
  `summary.json` pass, DOM/viewport wait, or unit test does not upgrade fallback
  screenshots to clean visual proof.
- Before writing `recipe-quality` or final evidence, perform and record an explicit fallback audit: count `trace.json` `fallbackReason`/`captureMode: dom-evidence-card-fallback` entries and read PNG headers/body for `DOM-rendered fallback evidence`. If fallback metadata exists, do not write `native screenshot`, `no fallback`, or clean visual `PASS` for affected ACs.
- At the cleanup prompt, name the Extension resources that are still running
  (webpack/dev server, browser/CDP port, service worker target, tmux pane). Do
  not stop them until the human confirms, unless the user already asked for
  cleanup. If kept alive, record why in `CHECKLIST.md`.
- Stateful ACs require explicit setup. If an AC depends on app state such as
  no-position vs open-position, the recipe must create/clear that state through
  a real UI/harness flow or documented pre-start fixture before asserting the
  UI. Do not rely on inherited browser/wallet state or prior validation runs. A
  read-only observation recipe is only `PASS-WITH-GAPS`/`BLOCKED` for the
  affected AC unless the required state setup is explicitly proven. Direct
  background/controller cleanup or seeding, including
  `stateHooks.submitRequestToBackground('perpsClosePositions', ...)`,
  `perpsGetPositions`-driven proof, provider/controller mutation, or an ad-hoc
  state helper, can be diagnostic/supporting evidence but cannot make the
  no-position/open-position AC cleanly `met` by itself.
