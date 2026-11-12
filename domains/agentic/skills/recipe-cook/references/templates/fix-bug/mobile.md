---
platforms: [mobile, ios, android]
description: Mobile fix-bug checklist with runtime proof.
---

# Mobile fix-bug checklist

Read and apply `.agents/skills/mms-recipe-cook/references/proof-rules.md` before step 1. Use its matching flow/platform rules at every gate.

## Setup
- [ ] 1. Confirm the checklist handoff
  Confirm the handoff's checklist path; never estimate or rewrite it (rules: proof-rules.md, Task and sandbox).
- [ ] 2. Capture the ACs and bind the recorded harness
  Record the summary and ACs in TASK.md, verify tooling with `.agents/skills/mms-recipe-cook/scripts/init-template --resume-task-dir <task>` and read its recorded `mm-harness help --json`.
  If tooling verification fails, stop with that cause; never resolve a replacement for this task.
- [ ] 3. Pass the sandbox ready gate
  Follow `/mms-recipe-harness`: doctor/status/launch-or-reuse/verify for this checkout only; the simulator/device app must be running.
  Require `artifacts/sandbox.json` with `ready: true`.
- [ ] 4. Create the local task branch
  Create or switch to `<ticket>-<flow>-<slug>-hhmm` before product edits. Do not open a PR.

## Reproduce
- [ ] 5. Build the AC matrix
  Ticket reference screenshots/recordings make an AC visual (rules: proof-rules.md, Plan and baseline).
- [ ] 6. Record the target and rationale
  Target iOS, Android or both and record why (rules: proof-rules.md, Plan and baseline).
  Mark ACs reachable only on an unavailable platform `UNTESTABLE: wrong platform`; never claim them later.
- [ ] 7. Plan the baseline proof and apply the Mainnet policy
  Plan the expected buggy evidence and each AC's state (rules: proof-rules.md, Bug fixing).
  Apply Cook's Mainnet rule in `.agents/skills/mms-recipe-cook/SKILL.md`.
- [ ] 8. Add and commit the reproduction marker
  Add `DevLogger.log('[<ticket>] BUG_MARKER: <condition>')` at the bug condition and observe it in `metro.log`.
  Commit it alone as `debug(<ticket>): add reproduction marker`. Retain the SHA and log excerpt.
- [ ] 9. Draft the baseline recipe in reuse order
  Draft `artifacts/recipe-baseline.json` asserting buggy real-app behavior and require `--plan` PASS (rules: proof-rules.md, Bug fixing).
- [ ] 10. Run the recorded baseline and inspect visuals
  Run it into `<task>/artifacts/recipe-baseline-run` with `--record-video=full-run --json`.
  Read every visual PNG (rules: proof-rules.md, UI evidence).
- [ ] 11. Exit early if already fixed or not reproduced
  Write `artifacts/no-change-report.md` and `artifacts/learnings.md`, then follow Cook's Finish before `<task>/mark no-change --reason "..."` (rules: proof-rules.md, Bug fixing).
  Add `--already-fixed` to the terminal mark when this branch already fixes it.
- [ ] 12. Record the root cause
  In TASK.md `## Root Cause`, confirm file:line from the marker, `metro.log` and code path.
  With `inputs/plan.md`, apply proof-rules.md, Supplied plan.

## Fix
- [ ] 13. Make the minimal AC-mapped fix
  No unrelated refactoring; locator `testID` additions are allowed (rules: proof-rules.md, Implementation and checks).
- [ ] 14. Changed-file CI [DETERMINISTIC: ci.local_check]
  Call `<task>/mark 14`; the engine runs the frozen check. Read and fix failures, then repeat this mark. Do not launch validation commands.

## Validate
- [ ] 15. Write the fixed-behavior after recipe and plan it
  `artifacts/recipe.json` keeps the baseline nodes, asserts fixed values, passes `--plan` and fails with the fix reverted (rules: proof-rules.md, Bug fixing).
- [ ] 16. Run the recorded after recipe and pass the evidence gate
  Run `mm-harness call app.lifecycle command=restart`, then `<task>/mm-harness run <task>/artifacts/recipe.json --artifacts-dir <task>/artifacts/recipe-run --record-video=full-run --json` (rules: proof-rules.md, Mobile runtime).
  After captures must differ from `before-...` as the bug-to-fix claim describes; read every PNG (rules: proof-rules.md, UI evidence).
- [ ] 17. Write regression tests and inspect the CI receipt
  Follow `/mms-mobile-testing` (rules: proof-rules.md, Tests).
  Read the step 14 receipt. Repeat its mark after source or test changes.
- [ ] 18. Commit the marker removal separately
  Commit only the marker removal as `chore(<ticket>): remove reproduction marker`, separately from the fix.
  Afterwards `git diff HEAD` shows only the fix.

## Review
- [ ] 19. Self-review the full diff
  Run `/mms-review-pr non-interactive` on this checkout (rules: proof-rules.md, Self-review).
  Include committed, staged, unstaged and untracked changes; record base, head, working-tree state, findings and skipped areas in `artifacts/review.md`.
  Fix findings here; repeat `<task>/mark 14` after source or test changes.
- [ ] 20. Run the domain review
  Read domain D from `<task>/inputs/handoff.json`; with no domain or review skill, record the N/A line in `artifacts/review.md` (rules: team-libraries.md, Dev and fix-bug domain review).
  Otherwise reuse the child on resume or register it once: `<task>/mark sub start <D>-review --step 20 --from .agents/skills/mms-<D>-review-pr/SKILL.md`.
  Work it with `<task>/mark sub <D>-review <criterion-number>`; close it with `<task>/mark sub <D>-review complete --report artifacts/review.md`.
- [ ] 21. Rerun proof or record no-rerun
  Rerun the recipe when proven behavior changed; otherwise record an explicit no-rerun decision (rules: proof-rules.md, Runtime proof).

## Finish
- [ ] 22. Record coverage and per-AC acceptance verdicts
  Write `artifacts/recipe-coverage.md`, checked against `recipe-run/trace.json`, and build `artifacts/recipe-quality.json` (rules: proof-rules.md, Coverage and finish).
  List ACs with `.agents/skills/mms-recipe-cook/scripts/acceptance-cli <task> list`, then render coverage with `.agents/skills/mms-recipe-cook/scripts/acceptance-cli <task> render`. Never write verdicts.
- [ ] 23. Render the PR body, retain artifacts and complete
  Write `artifacts/pr-description.md` with the root cause and marker SHA/log excerpt, run `mm-harness pr-body render <task> --out <task>/artifacts/pr-body.md --json` and read that file.
  Write `artifacts/evidence-manifest.json` with `before_after_pairs`, and `artifacts/learnings.md` (rules: proof-rules.md, Coverage and finish).
  Finish with `<task>/mark complete --mark-last`.
