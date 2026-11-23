---
platforms: [web, terminal]
description: Terminal fix-bug checklist with runtime proof.
---

# Terminal fix-bug checklist

Read and apply `.agents/skills/mms-recipe-cook/references/proof-rules.md` after marking step 1, before the first gate it governs. Use its matching flow/platform rules at every gate.

## Setup
- [ ] 1. Confirm the checklist handoff
  Read `<task>/inputs/handoff.json` and confirm its checklist path is this CHECKLIST.md; never rewrite it. Mark this step before doing anything else.
- [ ] 2. Capture the ACs and bind the recorded harness
  Record the summary and ACs in TASK.md, verify tooling with `.agents/skills/mms-recipe-cook/scripts/init-template --resume-task-dir <task>` and read its recorded `mm-harness help --json`.
  Mark this step before any source investigation. Investigate only this checkout and the reference checkouts listed in the task inputs; never search the host for an existing fix.
  If tooling verification fails, stop with that cause; never resolve a replacement for this task.
- [ ] 3. Pass the sandbox ready gate
  Run the configured recipe doctor command for this checkout; its dev server must answer and CDP must be reachable.
  Require `artifacts/sandbox.json` with `ready: true`; a fresh record from this task's preparation is enough.
- [ ] 4. Create the local task branch
  Create or switch to `<ticket>-<flow>-<slug>-hhmm` before product edits. Do not open a PR.

## Reproduce
- [ ] 5. Build the AC matrix
  Rules: proof-rules.md, Plan and baseline.
- [ ] 6. Record the target and rationale
  Record the route or surface each AC is proven on and why (rules: proof-rules.md, Plan and baseline).
- [ ] 7. Plan the baseline proof and apply the Mainnet policy
  Plan the expected buggy evidence and each AC's state (rules: proof-rules.md, Bug fixing).
  An AC you cannot reach live (a failure you cannot trigger, a post-release metric) is recorded now as UNTESTABLE with its reason or as proof mode review; never leave it for the gate.
  Apply Cook's Mainnet rule in `.agents/skills/mms-recipe-cook/SKILL.md`.
- [ ] 8. Add and commit the reproduction marker
  Add `console.error('[<ticket>] BUG_MARKER: <condition>')` at the bug condition, observe it in the app console log (`terminal/app-console.log`, listed by `mm-harness logs`), and commit it alone as `debug(<ticket>): add reproduction marker`.
- [ ] 9. Draft the baseline recipe in reuse order
  Draft `artifacts/recipe-baseline.json` asserting buggy real-app behavior and require `--plan` PASS (rules: proof-rules.md, Bug fixing).
  Pair ordering, portal or z-index screenshots with a bounding-box read.
  App recipe only; tests come in Validate (rules: proof-rules.md, Plan and baseline).
- [ ] 10. Run the recorded baseline and inspect visuals [PROOF: artifacts/recipe-baseline-run]
  Run the configured recipe command into `<task>/artifacts/recipe-baseline-run` with `--record-video=full-run`.
  It must fail at the first new-behavior `ac<N>` node, not in setup.
  Read every visual PNG (rules: proof-rules.md, UI evidence).
  Once marked, never delete or overwrite `artifacts/recipe-baseline-run`; if the baseline recipe must change, run it into `artifacts/recipe-baseline-run-2` (then `-3`) and record why in TASK.md.
- [ ] 11. Exit early if already fixed or not reproduced [OPTIONAL: the bug still reproduces]
  On this path mark this step; never skip it. Skip it only when the bug reproduces.
  Write `artifacts/no-change-report.md` and `artifacts/learnings.md`, then follow Cook's Finish before `<task>/mark no-change --reason "..."` (rules: proof-rules.md, Bug fixing).
  Add `--already-fixed` to the terminal mark when this branch already fixes it.
- [ ] 12. Record the root cause
  In TASK.md `## Root Cause`, trace file:line from symptom to source.
  If the ticket wording has two readings, name both and pick the one its screenshot or ACs confirm; list the callers of the code you change and the states it can be in (disabled, loading, error, empty, flag on/off), marking which ones the fix covers.
  If the root cause is in a shared package (`@metamask/perps-controller` or another Core package), stop with `<task>/mark blocked --reason "..."` naming the Core fix; never work around it in this client.
  With `inputs/plan.md`, apply proof-rules.md, Supplied plan.

## Fix
- [ ] 13. Make the minimal AC-mapped fix
  First commit only the marker removal as `chore(<ticket>): remove reproduction marker`.
  No unrelated refactoring; locator `data-testid` additions are allowed (rules: proof-rules.md, Implementation and checks).
- [ ] 14. Changed-file CI [DETERMINISTIC: ci.local_check]
  Call `<task>/mark 14`; the engine runs the frozen check. Read and fix failures, then repeat this mark. Do not launch validation commands.

## Validate
- [ ] 15. Write the fixed-behavior after recipe and plan it
  `artifacts/recipe.json` keeps the baseline nodes, asserts fixed values, passes `--plan` and fails with the fix reverted (rules: proof-rules.md, Bug fixing).
- [ ] 16. Run the recorded after recipe and pass the evidence gate [PROOF: artifacts/recipe-runs]
  Run the configured recipe command into a fresh `<task>/artifacts/recipe-runs/<attempt>` with `--record-video=full-run`.
  After captures must differ from `before-...` as the bug-to-fix claim describes; read every PNG (rules: proof-rules.md, UI evidence).
- [ ] 17. Write regression tests and inspect the CI receipt
  Follow the repository's testing guidance and record the gap when none applies (rules: proof-rules.md, Tests).
  Read the step 14 receipt. Repeat its mark after source or test changes.

## Review
- [ ] 18. Self-review the full diff
  Run `/mms-review-pr non-interactive` on this checkout (rules: proof-rules.md, Self-review).
  Include committed, staged, unstaged and untracked changes; record base, head, working-tree state, findings and skipped areas in `artifacts/review.md`.
  Fix findings here; repeat `<task>/mark 14` after source or test changes.
- [ ] 19. Run the domain review
  Read domain D from `<task>/inputs/handoff.json`; with no domain or review skill, record the N/A line in `artifacts/review.md` (rules: team-libraries.md, Dev and fix-bug domain review).
  Otherwise reuse the child on resume or register it once: `<task>/mark sub start <D>-review --step 19 --from .agents/skills/mms-<D>-review-pr/SKILL.md`.
  Work it with `<task>/mark sub <D>-review <criterion-number>`; close it with `<task>/mark sub <D>-review complete --report artifacts/review.md`.
- [ ] 20. Rerun proof or record no-rerun
  Rerun the recipe when proven behavior changed; otherwise record an explicit no-rerun decision (rules: proof-rules.md, Runtime proof).

## Finish
- [ ] 21. Record coverage and per-AC acceptance verdicts
  Write `artifacts/recipe-coverage.md`, checked against the selected attempt's `trace.json` under `artifacts/recipe-runs/`, and build `artifacts/recipe-quality.json` (rules: proof-rules.md, Coverage and finish).
  List ACs with `.agents/skills/mms-recipe-cook/scripts/acceptance-cli <task> list`, then render coverage with `.agents/skills/mms-recipe-cook/scripts/acceptance-cli <task> render`. Never write verdicts.
- [ ] 22. Render the PR body, retain artifacts and complete
  Write `artifacts/pr-description.md` with the root cause, run `mm-harness pr-body render <task> --out <task>/artifacts/pr-body.md --json` and read that file.
  Write `artifacts/evidence-manifest.json` with `before_after_pairs`, and `artifacts/learnings.md` (rules: proof-rules.md, Coverage and finish).
  Finish with `<task>/mark complete --mark-last`.
