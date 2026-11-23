---
platforms: [mobile, ios, android]
description: Mobile fix-bug checklist with runtime proof.
---

# Mobile fix-bug checklist

Read and apply `.agents/skills/mms-recipe-cook/references/proof-rules.md` after marking step 1, before the first gate it governs. Use its matching flow/platform rules at every gate.

## Setup
- [ ] 1. Confirm the checklist handoff
  Read `<task>/inputs/handoff.json` and confirm its checklist path is this CHECKLIST.md; never rewrite it. Mark this step before doing anything else.
- [ ] 2. Capture the ACs and bind the recorded harness
  Record the summary and ACs in TASK.md, verify tooling with `.agents/skills/mms-recipe-cook/scripts/init-template --resume-task-dir <task>` and read its recorded `mm-harness help --json`.
  Mark this step before any source investigation. Investigate only this checkout and the reference checkouts listed in the task inputs; never search the host for an existing fix.
  If tooling verification fails, stop with that cause; never resolve a replacement for this task.
- [ ] 3. Pass the sandbox ready gate
  Follow `/mms-recipe-harness`: doctor/status/launch/verify for this checkout only; the simulator/device app must be running.
  Require `artifacts/sandbox.json` with `ready: true`; a fresh record from this task's preparation is enough (`.agents/skills/mms-recipe-cook/scripts/prepare-sandbox <task> --platform mobile` writes it).
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
  An AC you cannot reach live (a failure you cannot trigger, a post-release metric) is recorded now as UNTESTABLE with its reason or as proof mode review; never leave it for the gate.
  Apply Cook's Mainnet rule in `.agents/skills/mms-recipe-cook/SKILL.md`.
- [ ] 8. Add and commit the reproduction marker
  Add `Logger.log('[<ticket>] BUG_MARKER: <condition>')` at the bug condition and observe it in `metro.log`.
  Commit it alone as `debug(<ticket>): add reproduction marker`. Retain the SHA and log excerpt.
- [ ] 9. Draft the baseline recipe in reuse order
  Draft `artifacts/recipe-baseline.json` asserting buggy real-app behavior and require `--plan` PASS (rules: proof-rules.md, Bug fixing).
  App recipe only; tests come in Validate (rules: proof-rules.md, Plan and baseline).
- [ ] 10. Run the recorded baseline and inspect visuals [PROOF: artifacts/recipe-baseline-run]
  Run it into `<task>/artifacts/recipe-baseline-run` with `--record-video=full-run --json`.
  Read every visual PNG (rules: proof-rules.md, UI evidence).
  Once marked, never delete or overwrite `artifacts/recipe-baseline-run`; if the baseline recipe must change, run it into `artifacts/recipe-baseline-run-2` (then `-3`) and record why in TASK.md.
- [ ] 11. Exit early if already fixed or not reproduced [OPTIONAL: the bug still reproduces]
  On this path mark this step; never skip it. Skip it only when the bug reproduces.
  Write `artifacts/no-change-report.md` and `artifacts/learnings.md`, then follow Cook's Finish before `<task>/mark no-change --reason "..."` (rules: proof-rules.md, Bug fixing).
  Add `--already-fixed` to the terminal mark when this branch already fixes it.
- [ ] 12. Record the root cause
  In TASK.md `## Root Cause`, confirm file:line from the marker, `metro.log` and code path.
  If the ticket wording has two readings, name both and pick the one its screenshot or ACs confirm; list the callers of the code you change and the states it can be in (disabled, loading, error, empty, flag on/off), marking which ones the fix covers.
  If the root cause is in a shared package (`@metamask/perps-controller` or another Core package), stop with `<task>/mark blocked --reason "..."` naming the Core fix; never work around it in this client.
  With `inputs/plan.md`, apply proof-rules.md, Supplied plan.

## Fix
- [ ] 13. Make the minimal AC-mapped fix
  No unrelated refactoring; locator `testID` additions are allowed (rules: proof-rules.md, Implementation and checks).
- [ ] 14. Write regression tests
  Follow `/mms-mobile-testing` (rules: proof-rules.md, Tests).

## Validate
- [ ] 15. Write the fixed-behavior after recipe and plan it
  `artifacts/recipe.json` keeps the baseline nodes, asserts fixed values, passes `--plan` and fails with the fix reverted (rules: proof-rules.md, Bug fixing).
- [ ] 16. Freeze the clean candidate
  Restore the fix after the revert check. Commit only the marker removal as `chore(<ticket>): remove reproduction marker`, separately from the fix.
  Commit the fix and regression tests locally. Verify the checkout is clean and record full HEAD in TASK.md as the candidate for final CI and after evidence. Do not push.
- [ ] 17. Changed-file CI [DETERMINISTIC: ci.local_check]
  Call `<task>/mark 17` on the clean candidate; the engine runs the frozen check. If a correction is needed, commit it, record the replacement clean HEAD, and repeat this mark. Do not launch validation commands.
- [ ] 18. Run the recorded after recipe and pass the evidence gate [PROOF: artifacts/recipe-runs]
  On the clean candidate, run `mm-harness call app.lifecycle command=restart`, then `<task>/mm-harness run <task>/artifacts/recipe.json --record-video=full-run --json` (rules: proof-rules.md, Mobile runtime).
  After captures must differ from `before-...` as the bug-to-fix claim describes; read every PNG (rules: proof-rules.md, UI evidence).

## Review
- [ ] 19. Self-review the full diff
  Run `/mms-review-pr non-interactive` on this checkout (rules: proof-rules.md, Self-review).
  Include committed, staged, unstaged and untracked changes; record base, head, working-tree state, findings and skipped areas in `artifacts/review.md`.
  If findings require a source or test change, commit the correction locally and record the replacement clean HEAD before refreshing its receipts.
- [ ] 20. Verify the candidate CI and selected evidence
  Read the step 17 deterministic receipt and verify it covers the clean candidate's inputs. Repeat its mark if stale.
  Read the selected after attempt's product provenance and require `git_ref` equal to the clean candidate and `dirty: false`. Rerun the after proof in a fresh attempt if the binding is stale or proven behavior changed; otherwise record why no rerun is needed.
  Write `artifacts/evidence-manifest.json` with `before_after_pairs` (rules: proof-rules.md, Coverage and finish). Verify the before evidence uses an accepted baseline and each selected media path matches its retained receipt and the mirrored hash when available. Record the missing or mismatched binding and resolve it before review.
- [ ] 21. Record coverage and per-AC acceptance verdicts
  Write `artifacts/recipe-coverage.md`, checked against the selected attempt's `trace.json` under `artifacts/recipe-runs/`, and build `artifacts/recipe-quality.json` (rules: proof-rules.md, Coverage and finish).
  Map every clause of every registered AC to an executed proof node and its retained evidence, or record an explicit gap with the reason. Keep pending visual judgment distinct from missing runtime proof.
  List ACs with `.agents/skills/mms-recipe-cook/scripts/acceptance-cli <task> list`, then render coverage with `.agents/skills/mms-recipe-cook/scripts/acceptance-cli <task> render`. Never write verdicts.
- [ ] 22. Run the domain review
  Start only after the candidate, receipts and AC map in steps 20–21 agree.
  Read domain D from `<task>/inputs/handoff.json`; with no domain or review skill, record the N/A line in `artifacts/review.md` (rules: team-libraries.md, Dev and fix-bug domain review).
  Otherwise reuse the child on resume or register it once: `<task>/mark sub start <D>-review --step 22 --from .agents/skills/mms-<D>-review-pr/SKILL.md`.
  Work it with `<task>/mark sub <D>-review <criterion-number>`; close it with `<task>/mark sub <D>-review complete --report artifacts/review.md`.

## Finish
- [ ] 23. Render the PR body, retain artifacts and complete
  Write `artifacts/pr-description.md` with the root cause and marker SHA/log excerpt, run `mm-harness pr-body render <task> --out <task>/artifacts/pr-body.md --json` and read that file.
  Write `artifacts/learnings.md` (rules: proof-rules.md, Coverage and finish). If review changes the candidate or selected proof, refresh steps 20–21, identify the changed review inputs, and send the revised inputs through the applicable review path before completion.
  Finish with `<task>/mark complete --mark-last`.
