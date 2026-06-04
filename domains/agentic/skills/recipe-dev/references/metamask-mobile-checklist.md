# Mobile dev checklist

Target checklist for `metamask-mobile` feature/dev/investigation work. Start from desired
behavior and ACs; do not reproduce a known bug unless the task asks.

This file is the human's live progress view. `init-checklist.sh` copies it to the task
folder as `CHECKLIST.md`. Execute top-to-bottom; the moment a gate completes, flip
`[ ]` → `[x]` (or `BLOCKED: <reason>` / `N/A: <reason>`) and add the artifact path/result
under it.

- [ ] 0. Coffee handoff sent, naming this CHECKLIST.md path to monitor.
- [ ] 1. Task captured — URL or pasted text, summary, ACs.
- [ ] 2. AC matrix — numbered ACs; proof mode state/visual/mixed; primary evidence.
- [ ] 3. Mobile target selected — ios, android, or both + rationale.
- [ ] 4. Proof plan written before implementation — fixture/state, route, selectors/testIDs, expected after evidence; before evidence or `Baseline: N/A`.
- [ ] 5. /mms-recipe-doctor setup readiness recorded — fixtures/tools; malformed fixture or missing tool = BLOCKED.
- [ ] 6. /mms-recipe-harness install/verify when runtime proof applies — install root + manifest + verify path. Missing runner ⇒ install first; no runtime start.
- [ ] 7. /mms-recipe-cook drafted recipe — path + exact command covering ACs; mandatory for visual/mixed ACs.
- [ ] 8. Minimal implementation — AC-mapped diff only; no unrelated refactor; no tests unless asked.
- [ ] 9. Focused checks run — type/Jest/direct-eslint only; not proof for visual/mixed ACs.
- [ ] 10. Runtime recipe run when applicable — summary.json, trace.json, manifest, screenshots/video.
- [ ] 11. Visual evidence gate — read PNGs; claimed UI visible in viewport for visual/mixed ACs.
- [ ] 12. /mms-recipe-quality critique — verdict + gaps.
- [ ] 13. Improvement/rerun loop — one fix + rerun, or explicit no-rerun verdict.
- [ ] 14. /mms-recipe-evidence package — PR-ready evidence block/file.
- [ ] 15. Final response — change, tests, recipe evidence, quality loop, gaps. Ask about runtime cleanup; offer PR on consent.

Mobile notes:

- Mobile lint: never run `yarn lint <files>`; it runs repo-wide ESLint. Use direct `./node_modules/.bin/eslint <changed files> --cache --quiet --max-warnings=0` or mark lint `N/A: broad lint deferred`.
- Name the target (`ios`/`android`/`both`). Prefer after evidence for new UI; use before/after only when a meaningful prior state exists.
- Runtime: default auto. Start/recover only via `/mms-recipe-harness`; `--interactive` asks first. If harness/policy blocks, record `BLOCKED` with command/artifact.
- Visual/mixed ACs need viewport screenshot; no tests/state-only proof. No PNG ⇒ `BLOCKED: no runtime visual evidence`.
- Recipe-controllable UI needs stable testIDs on the interactive/value-owning element (`TextInput`, `Pressable`, `Button`, visible value text). Prefer exported constants; wrapper-only or inline testIDs make recipes brittle.
- No manufactured state: don't inject via `stateHooks`, store/controller writes, or DOM/fiber mutation. Use a real UI flow or harness pre-start fixture, else mark the AC a fixture/runtime gap.
- A fallback screenshot (`DOM-rendered fallback` / `fallbackReason` in trace.json) keeps that visual AC at `PASS-WITH-GAPS` even if summary.json says pass.
