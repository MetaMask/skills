---
platforms: [core, cli]
description: Core dev checklist with runtime proof.
---

# Core dev checklist

Read and apply `.agents/skills/mms-recipe-cook/references/dev-fix-bug.md` before step 1. Use its matching flow/platform rules at every gate.

## Setup
- [ ] 1. Confirm the checklist handoff
  Confirm the handoff's checklist path; never estimate or rewrite it (rules: dev-fix-bug.md, Task and sandbox).
- [ ] 2. Capture the ACs and bind the recorded harness
  Record the summary and ACs in TASK.md, verify tooling with `.agents/skills/mms-recipe-cook/scripts/init-template --resume-task-dir <task>` and read its recorded `mm-harness help --json`.
  If tooling verification fails, stop with that cause; never resolve a replacement for this task.
- [ ] 3. Pass the sandbox ready gate
  Follow `/mms-recipe-harness`: doctor/status/launch-or-reuse/verify for this checkout only.
  Require `artifacts/sandbox.json` with `ready: true`.
- [ ] 4. Create the local task branch
  Create or switch to `<ticket>-<flow>-<slug>-hhmm` before product edits. Do not open a PR.

## Plan
- [ ] 5. Write the approach
  `artifacts/approach.md`: affected files, current behavior or insertion point, chosen approach and trade-offs (rules: dev-fix-bug.md, Development).
  Include a real commit subject when the task title is empty or generic; use it for any requested product commit.
- [ ] 6. Build the AC matrix
  Rules: dev-fix-bug.md, Plan and baseline.
- [ ] 7. Record the target and rationale
  Target packages/controllers and fixtures, proven headless through `state`, `command` or `log` without PNGs (rules: dev-fix-bug.md, Plan and baseline).
- [ ] 8. Plan the proof and apply the Mainnet policy
  The recipe drives the controller through its public API as Mobile or Extension do (real messenger, mocked only at the network boundary) and asserts the observable state or event; a Jest or unit-test probe is never the proof.
  Sign real testnet orders only with a testnet-wallet fixture; otherwise use read paths and record why.
  Apply Cook's Mainnet rule in `.agents/skills/mms-recipe-cook/SKILL.md`.
- [ ] 9. Draft the recipe and run pre-implementation proof
  Discover with `mm-harness run --list --json`, draft in reuse order and require `mm-harness run <recipe> --plan` PASS (rules: dev-fix-bug.md, Development).
  Run it with `--artifacts-dir <task>/artifacts/recipe-baseline-run --json`; it must fail at the first new-behavior AC assertion, not setup.
  Record the recipe path and command. Implement only after this gate is marked PASS.

## Implement
- [ ] 10. Implement the gated, AC-mapped change
  Keep it AC-mapped, reuse domain helpers and add each required package CHANGELOG entry (rules: dev-fix-bug.md, Implementation and checks).
- [ ] 11. Inspect changed source and write regression tests
  Cover the changed behavior and public exports (rules: dev-fix-bug.md, Tests). The deterministic CI step that follows owns execution.

## Validate
- [ ] 12. Changed-file CI [DETERMINISTIC: ci.local_check]
  Call `<task>/mark 12`; the engine runs the frozen check. Read and fix failures, then repeat this mark. Do not launch validation commands.
- [ ] 13. Run the recipe and inspect state and logs
  `<task>/mm-harness run <task>/artifacts/recipe.json --artifacts-dir <task>/artifacts/recipe-run --json` (rules: dev-fix-bug.md, Runtime proof).
  On setup failures, inspect retained state/logs and repair drift with `--heal auto`; never weaken assertions.

## Review
- [ ] 14. Self-review the full diff
  Core has no `review-pr` overlay: apply the Core review list (rules: dev-fix-bug.md, Self-review).
  Include committed, staged, unstaged and untracked changes; record base, head, working-tree state, findings and skipped areas in `artifacts/review.md`.
  Fix findings here; repeat `<task>/mark 12` after source or test changes.
- [ ] 15. Run the domain review
  Read domain D from `<task>/inputs/handoff.json`; with no domain or review skill, record the N/A line in `artifacts/review.md` (rules: team-libraries.md, Dev and fix-bug domain review).
  Otherwise reuse the child on resume or register it once: `<task>/mark sub start <D>-review --step 15 --from .agents/skills/mms-<D>-review-pr/SKILL.md`.
  Work it with `<task>/mark sub <D>-review <criterion-number>`; close it with `<task>/mark sub <D>-review complete --report artifacts/review.md`.
- [ ] 16. Rerun proof or record no-rerun
  Rerun the recipe when proven behavior changed; otherwise record an explicit no-rerun decision (rules: dev-fix-bug.md, Runtime proof).

## Finish
- [ ] 17. Record coverage and per-AC acceptance verdicts
  Write `artifacts/recipe-coverage.md` and build `artifacts/recipe-quality.json` (rules: dev-fix-bug.md, Coverage and finish).
  List ACs with `.agents/skills/mms-recipe-cook/scripts/acceptance-cli <task> list`, then render coverage with `acceptance-cli <task> render`. Never write verdicts.
- [ ] 18. Render the PR body, retain artifacts and complete
  Write `artifacts/pr-description.md`, run `mm-harness pr-body render <task> --out <task>/artifacts/pr-body.md --json` and read that file.
  Write the media-free `artifacts/evidence-manifest.json`, `artifacts/report.md` and `artifacts/learnings.md` (rules: dev-fix-bug.md, Coverage and finish).
  Finish with `<task>/mark complete --mark-last`.

When the frozen terminal contract requires `artifacts/recipe-decision.json`, use the shared proof-decision fields; diagnose and repair missing runtime prerequisites first.
