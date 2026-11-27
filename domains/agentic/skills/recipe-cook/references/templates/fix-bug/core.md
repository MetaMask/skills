---
platforms: [core, cli]
description: Core fix-bug checklist with runtime proof.
produces: [artifacts/recipe-coverage.md, artifacts/recipe-quality.json]
---

# Core fix-bug checklist

Read and apply `.agents/skills/mms-recipe-cook/references/proof-rules.md` after marking step 1, before the first gate it governs. Use its matching flow/platform rules at every gate.

## Setup
- [ ] 1. Confirm the checklist handoff
  Read `<task>/inputs/handoff.json` and confirm its checklist path is this CHECKLIST.md; never rewrite it. Mark this step before doing anything else.
- [ ] 2. Capture the ACs and bind the recorded harness
  Record the summary and ACs in TASK.md, verify tooling with `.agents/skills/mms-recipe-cook/scripts/init-template --resume-task-dir <task>` and read its recorded `mm-harness help --json`.
  Mark this step before any source investigation. Investigate only this checkout and the reference checkouts listed in the task inputs; never search the host for an existing fix.
  If tooling verification fails, stop with that cause; never resolve a replacement for this task.
- [ ] 3. Pass the sandbox ready gate
  Follow `/mms-recipe-harness`: doctor/status/verify for this checkout only.
  Require `artifacts/sandbox.json` with `ready: true`; a fresh record from this task's preparation is enough.
- [ ] 4. Create the local task branch
  Create or switch to `<ticket>-<flow>-<slug>-hhmm` before product edits. Do not open a PR.

## Reproduce
- [ ] 5. Build the AC matrix
  Rules: proof-rules.md, Plan and baseline.
- [ ] 6. Record the target and rationale
  Name the package/controller target and fixtures, proven headless through `state`, `command` or `log` without PNGs (rules: proof-rules.md, Plan and baseline).
- [ ] 7. Plan the baseline proof and apply the Mainnet policy
  Discover with `mm-harness actions --json` and `mm-harness run --list --json`; write `artifacts/recipe-decision.json` with the shared proof-decision fields (rules: proof-rules.md, Bug fixing).
  An AC you cannot reach live (a failure you cannot trigger, a post-release metric) is recorded now as UNTESTABLE with its reason or as proof mode review; never leave it for the gate.
  Apply Cook's Mainnet rule in `.agents/skills/mms-recipe-cook/SKILL.md`.
- [ ] 8. Draft the baseline recipe in reuse order
  When proof is required, draft `artifacts/recipe.json` asserting fixed behavior and require `--plan` PASS (rules: proof-rules.md, Bug fixing).
  App recipe only; tests come in Validate (rules: proof-rules.md, Plan and baseline).
- [ ] 9. Probe setup and retain the failing baseline run [PROOF: artifacts/recipe-baseline-run]
  Probe reused recipe entry/setup boundaries with a short bound, then run into `<task>/artifacts/recipe-baseline-run` with `--json`.
  Require failure at the reported bug's AC assertion, also when the decision sets `required: false`: with no library recipe, use a headless `command` proof through the public API. Focused tests are never the baseline proof for a runtime claim.
  Once marked, never delete or overwrite `artifacts/recipe-baseline-run`; if the baseline recipe must change, run it into `artifacts/recipe-baseline-run-2` (then `-3`) and record why in TASK.md.
- [ ] 10. Record the root cause
  Write file:line, affected files and the fix plan in `artifacts/approach.md`.
  If the ticket wording has two readings, name both and pick the one its ACs confirm; list the callers of the code you change and the states it can be in (disabled, loading, error, empty, flag on/off), marking which ones the fix covers.
  With `inputs/plan.md`, apply proof-rules.md, Supplied plan.
- [ ] 11. Exit early if already fixed or not reproduced [OPTIONAL: the bug still reproduces]
  If the baseline reproduced the bug, skip this step now with `--skip "bug reproduces"`. Otherwise mark it on this path; never skip it.
  Write `artifacts/no-change-report.md` and `artifacts/learnings.md`, then follow Cook's Finish before `<task>/mark no-change --reason "..."` (rules: proof-rules.md, Bug fixing).

## Fix
- [ ] 12. Make the minimal AC-mapped fix
  No unrelated refactoring; add each required package CHANGELOG entry (rules: proof-rules.md, Implementation and checks).
- [ ] 13. Changed-file CI [DETERMINISTIC: ci.local_check]
  Call `<task>/mark 13`; the engine runs the frozen check. Read and fix failures, then repeat this mark. Do not launch validation commands.
- [ ] 14. Write regression tests and inspect the CI receipt
  Cover the reported bug and public exports (rules: proof-rules.md, Tests).
  Read the step 13 receipt. Repeat its mark after source or test changes.

## Validate
- [ ] 15. Run the required recipe [OPTIONAL: the proof decision records no recipe requirement]
  When the decision requires proof, `<task>/mm-harness run <task>/artifacts/recipe.json --json`; it must pass (rules: proof-rules.md, Runtime proof).
  On setup failures, inspect retained state/logs and repair drift with `--heal auto`; never weaken assertions.
- [ ] 16. Run the domain smoke when applicable [OPTIONAL: the project declares no domain smoke]

## Review
- [ ] 17. Self-review the full diff
  Core has no `review-pr` overlay: apply the Core review list (rules: proof-rules.md, Self-review).
  Include committed, staged, unstaged and untracked changes; record base, head, working-tree state, findings and skipped areas in `artifacts/review.md`.
  Fix findings here; repeat `<task>/mark 13` after source or test changes.
- [ ] 18. Run the domain review
  Read domain D from `<task>/inputs/handoff.json`; with no domain or review skill, record the N/A line in `artifacts/review.md` (rules: team-libraries.md, Dev and fix-bug domain review).
  Otherwise reuse the child on resume or register it once: `<task>/mark sub start <D>-review --step 18 --from .agents/skills/mms-<D>-review-pr/SKILL.md`.
  Work it with `<task>/mark sub <D>-review <criterion-number>`; close it with `<task>/mark sub <D>-review complete --report artifacts/review.md`.
- [ ] 19. Rerun proof or record no-rerun
  Rerun the recipe when proven behavior changed; otherwise record an explicit no-rerun decision (rules: proof-rules.md, Runtime proof).

## Finish
- [ ] 20. Record coverage and per-AC acceptance verdicts
  Write recipe coverage and quality only when `artifacts/recipe.json` exists; every AC still needs a verdict (rules: proof-rules.md, Coverage and finish).
  List ACs with `.agents/skills/mms-recipe-cook/scripts/acceptance-cli <task> list`, then render coverage with `.agents/skills/mms-recipe-cook/scripts/acceptance-cli <task> render`. Never write verdicts.
- [ ] 21. Render the PR body, retain artifacts and complete
  Write `artifacts/pr-description.md` with the root cause, run `mm-harness pr-body render <task> --out <task>/artifacts/pr-body.md --json` and read that file.
  Write the media-free `artifacts/evidence-manifest.json`, `artifacts/report.md` and `artifacts/learnings.md` (rules: proof-rules.md, Coverage and finish).
  Finish with `<task>/mark complete --mark-last`.
