---
platforms: [extension, chrome-extension]
description: Extension dev checklist with runtime proof.
---

# Extension dev checklist

Read and apply `.agents/skills/mms-recipe-cook/references/dev-fix-bug.md` before step 1. Use its matching flow/platform rules at every gate.

## Setup

- [ ] 1. Confirm checklist handoff.
- [ ] 2. Capture task/ACs and bind the recorded harness.
- [ ] 3. Sandbox ready.
- [ ] 4. Local task branch.

## Plan

- [ ] 5. Approach.
- [ ] 6. AC matrix.
- [ ] 7. Target and rationale.
- [ ] 8. Proof plan and Mainnet policy.
- [ ] 9. Comparable UI baseline or additive N/A.
- [ ] 10. Recipe drafted and pre-implementation proof.

## Implement

- [ ] 11. Implement the gated, AC-mapped change.
- [ ] 12. Changed-file CI [DETERMINISTIC: ci.local_check]. Call `<task>/mark 12`; the engine runs the frozen check. Read and fix failures, then repeat this mark. Do not launch validation commands.

## Validate

- [ ] 13. Recorded recipe run.
- [ ] 14. Visual evidence gate.
- [ ] 15. Write regression tests and inspect the deterministic CI receipt. Repeat its mark after source or test changes.

## Self-review

- [ ] 16. Full-diff self-review.
- [ ] 17. Domain checks with parent step 17.
- [ ] 18. Rerun proof or record no-rerun.

## Report

- [ ] 19. Coverage and per-AC acceptance verdicts.
- [ ] 20. Render PR body, retain terminal artifacts and complete.
