# Mobile fix-ticket checklist

Target checklist for `metamask-mobile` bug tickets. Reproduce or understand the failure
before patching.

This file is the human's live progress view. `init-checklist.sh` copies it to the task
folder as `CHECKLIST.md`. Execute top-to-bottom; the moment a gate completes, flip
`[ ]` → `[x]` (or `BLOCKED: <reason>` / `N/A: <reason>`) and add the artifact path/result
under it.

- [ ] 0. Coffee handoff sent, naming this CHECKLIST.md path to monitor.
- [ ] 1. Ticket captured — URL or pasted text, summary, ACs.
- [ ] 2. AC matrix — numbered ACs; proof mode state/visual/mixed; primary evidence.
- [ ] 3. Mobile target selected — ios, android, or both + rationale.
- [ ] 4. Repro/baseline plan written before behavior edits — route, fixture/state, selectors/testIDs, expected before evidence.
- [ ] 5. /mms-recipe-doctor setup readiness recorded — fixtures/tools; malformed fixture or missing tool = BLOCKED.
- [ ] 6. /mms-recipe-harness install/verify — manifest + verify path.
- [ ] 7. /mms-recipe-cook baseline/no-state recipe — path + exact command, or `BLOCKED: <reason>`.
- [ ] 8. Baseline/no-state recipe run — summary.json, trace.json, screenshot/manifest paths, or blocked reason.
- [ ] 9. Minimal fix implemented — product diff (excl. harness/generated); every changed line maps to an AC, no unrelated refactor.
- [ ] 10. Focused checks run — changed-file typecheck/Jest/lint. Not a stop gate.
- [ ] 11. /mms-recipe-cook after/with-state recipe — path + exact command proving each AC.
- [ ] 12. Runtime recipe run — summary.json, trace.json, manifest, logs.
- [ ] 13. Visual evidence gate — read PNGs; claimed UI visible in viewport for visual/mixed ACs.
- [ ] 14. /mms-recipe-quality critique — verdict; gaps assigned to product/recipe/fixture/harness/evidence.
- [ ] 15. Improvement/rerun loop — one fix + rerun, or explicit no-rerun verdict.
- [ ] 16. /mms-recipe-evidence package — PR-ready evidence block/file with artifact paths and blocked gaps.
- [ ] 17. Final response — fix, tests, recipe evidence, quality loop, remaining risk. Ask about runtime cleanup; offer PR on consent.

Mobile notes:

- Because fix-ticket was invoked, do not switch to the dev protocol or mark baseline/repro `N/A` just because the ticket says POC/debug. Author a before/no-state recipe or record the concrete `/mms-recipe-cook` blocker. Name the fixture/flow used to create no-position/open-position state — don't rely on inherited simulator state.
- Runtime start (Metro/simulator) is approval-gated: without approval, record `BLOCKED: pending runtime-start approval` with the exact command and wait; with approval, start through `/mms-recipe-harness`, not raw `yarn`/native rebuilds.
- Visual/mixed ACs need a viewport-visible screenshot (`ui.scroll` + `ui.wait_for visible`), not fiber-tree/controller state or a passing recipe alone; without a runtime PNG it is `BLOCKED: no runtime visual evidence`, never `code-proven`.
- No manufactured state: don't inject via `stateHooks`, store/controller writes, or DOM/fiber mutation. Use a real UI flow or harness pre-start fixture, else mark the AC a fixture/runtime gap.
- A fallback screenshot (`DOM-rendered fallback` / `fallbackReason` in trace.json) keeps that visual AC at `PASS-WITH-GAPS` even if summary.json says pass.
