---
platforms: [extension, chrome-extension]
description: Extension dev checklist with runtime proof.
---

# Extension dev checklist

Read and apply `.agents/skills/mms-recipe-cook/references/proof-rules.md` before step 1. Use its matching flow/platform rules at every gate.

## Setup
- [ ] 1. Confirm the checklist handoff
  Confirm the handoff's checklist path; never estimate or rewrite it (rules: proof-rules.md, Task and sandbox).
- [ ] 2. Capture the ACs and bind the recorded harness
  Record the summary and ACs in TASK.md, verify tooling with `.agents/skills/mms-recipe-cook/scripts/init-template --resume-task-dir <task>` and read its recorded `mm-harness help --json`.
  If tooling verification fails, stop with that cause; never resolve a replacement for this task.
- [ ] 3. Pass the sandbox ready gate
  Follow `/mms-recipe-harness`: doctor/status/launch-or-reuse/verify for this checkout only; CDP must be reachable.
  Require `artifacts/sandbox.json` with `ready: true`; a fresh record from this task's preparation is enough.
- [ ] 4. Create the local task branch
  Create or switch to `<ticket>-<flow>-<slug>-hhmm` before product edits. Do not open a PR.

## Plan
- [ ] 5. Write the approach
  `artifacts/approach.md`: affected files, current behavior or insertion point, chosen approach and trade-offs (rules: proof-rules.md, Development).
  Choose the most defensible approach without pausing.
  With `inputs/plan.md`, apply proof-rules.md, Supplied plan.
- [ ] 6. Build the AC matrix
  Rules: proof-rules.md, Plan and baseline.
- [ ] 7. Record the target and rationale
  Target popup, sidepanel, fullscreen or dapp and record why (rules: proof-rules.md, Plan and baseline).
- [ ] 8. Plan the proof and apply the Mainnet policy
  Bind a fixture, semantic intent and verified live postcondition; discover runtime controls and keep task recipes in `artifacts/recipe-library/recipes/` (rules: proof-rules.md, Plan and baseline).
  Apply Cook's Mainnet rule in `.agents/skills/mms-recipe-cook/SKILL.md`.
- [ ] 9. Capture a comparable UI baseline or additive N/A
  Before editing existing UI, capture `before-*` evidence on the same route, state, target and viewport.
  For purely additive work, write `Baseline: N/A. additive` in TASK.md (rules: proof-rules.md, Development).
- [ ] 10. Draft the recipe and run pre-implementation proof
  Discover with `mm-harness run --list --json`, draft in reuse order and require `mm-harness run <recipe> --plan` PASS (rules: proof-rules.md, Development).
  Run it with `--artifacts-dir <task>/artifacts/recipe-baseline-run --json`; it must fail at the first new-behavior AC assertion, not setup. If every AC is a regression guard, it must pass end to end instead.
  Record the recipe path and command. Implement only after this gate is marked PASS.

## Implement
- [ ] 11. Implement the gated, AC-mapped change
  Keep it AC-mapped and reuse domain helpers; new interactive elements get `data-testid` (rules: proof-rules.md, Implementation and checks).
- [ ] 12. Changed-file CI [DETERMINISTIC: ci.local_check]
  Call `<task>/mark 12`; the engine runs the frozen check. Read and fix failures, then repeat this mark. Do not launch validation commands.

## Validate
- [ ] 13. Run the recorded recipe
  Reload with `mm-harness doctor --expect-live`; run `mm-harness launch --verify` if the extension stopped responding (rules: proof-rules.md, Extension runtime).
  `<task>/mm-harness run <task>/artifacts/recipe.json --artifacts-dir <task>/artifacts/recipe-run --record-video=full-run --json` (rules: proof-rules.md, Runtime proof).
- [ ] 14. Pass the visual evidence gate
  Read every visual/mixed PNG: the claimed target is visible, unclipped and not a generic home or empty screen (rules: proof-rules.md, UI evidence).
  Accept capture-helper screenshots only. Fix insufficient evidence and rerun instead of shipping a caveat.
- [ ] 15. Write regression tests and inspect the CI receipt
  Follow `/mms-extension-testing` (rules: proof-rules.md, Tests).
  Read the step 12 receipt. Repeat its mark after source or test changes.

## Review
- [ ] 16. Self-review the full diff
  Run `/mms-review-pr non-interactive` on this checkout (rules: proof-rules.md, Self-review).
  Include committed, staged, unstaged and untracked changes; record base, head, working-tree state, findings and skipped areas in `artifacts/review.md`.
  Fix findings here; repeat `<task>/mark 12` after source or test changes.
- [ ] 17. Run the domain review
  Read domain D from `<task>/inputs/handoff.json`; with no domain or review skill, record the N/A line in `artifacts/review.md` (rules: team-libraries.md, Dev and fix-bug domain review).
  Otherwise reuse the child on resume or register it once: `<task>/mark sub start <D>-review --step 17 --from .agents/skills/mms-<D>-review-pr/SKILL.md`.
  Work it with `<task>/mark sub <D>-review <criterion-number>`; close it with `<task>/mark sub <D>-review complete --report artifacts/review.md`.
- [ ] 18. Rerun proof or record no-rerun
  Rerun the recipe when proven behavior changed; otherwise record an explicit no-rerun decision (rules: proof-rules.md, Runtime proof).

## Finish
- [ ] 19. Record coverage and per-AC acceptance verdicts
  Write `artifacts/recipe-coverage.md` and build `artifacts/recipe-quality.json` (rules: proof-rules.md, Coverage and finish).
  List ACs with `.agents/skills/mms-recipe-cook/scripts/acceptance-cli <task> list`, then render coverage with `.agents/skills/mms-recipe-cook/scripts/acceptance-cli <task> render`. Never write verdicts.
- [ ] 20. Render the PR body, retain artifacts and complete
  Write `artifacts/pr-description.md`, run `mm-harness pr-body render <task> --out <task>/artifacts/pr-body.md --json` and read that file.
  Write `artifacts/evidence-manifest.json` with PROVEN visual evidence only, and `artifacts/learnings.md` (rules: proof-rules.md, Coverage and finish).
  Finish with `<task>/mark complete --mark-last`.
