---
name: recipe-dev
description: Build a MetaMask feature, investigation, or product change from a clear task/ticket with acceptance criteria and recipe-backed validation. Use when an agent should implement desired behavior without first reproducing an existing bug, prove the happy path in a live Mobile or Extension runtime when applicable, package evidence, and stop for human review.
maturity: experimental
---

# Recipe Dev

`/mms-recipe-dev` is the high-level workflow for feature/dev work that should end near a working fix plus reviewable proof.

It exists to steer the agent through the full loop. Lower-level recipe skills are proof tools; this skill makes the agent use them instead of stopping at a code diff, unit tests, or a confidence summary.

Use it when the task is broader than a bug fix: new feature work, exploratory implementation, investigation, or behavior changes that start from desired acceptance criteria rather than a known broken state. For pure bugs, prefer `/mms-recipe-fix-ticket` because bug-fix flow spends time reproducing or understanding the existing failure before patching.

Load only what applies:

- Runtime setup: `/mms-recipe-harness`
- Recipe authoring: `/mms-recipe-cook`
- Recipe critique: `/mms-recipe-quality`
- PR evidence formatting: `/mms-recipe-evidence`
- Wallet/app primitives: `/mms-recipe-wallet-control`
- Target-repo dev notes are appended below when installed.

## Default Contract

Do not stop at a code diff when the change is user-visible, stateful, or acceptance-criteria-driven.

Happy path:

1. Read the task/ticket and extract clear acceptance criteria. If the task description is too vague to prove, stop and ask for sharper criteria before implementing.
2. Make the smallest product change.
3. Install/verify the recipe harness when runtime proof applies.
4. Author or update a recipe for the main happy path and key regression.
5. For visible UI/copy/layout/state-presentation changes, capture comparable
   before/after evidence. For additive work where no meaningful before state
   exists, write `Baseline: N/A — <reason>` and capture after evidence with a
   deterministic visual claim.
6. Run the live recipe and save artifacts.
7. Run `/mms-recipe-quality`; improve once if evidence is weak.
8. Return a PR-ready summary and stop for human validation unless asked to open a PR.

For every visual or mixed acceptance criterion, the recipe must use the shared
visual assertion protocol before screenshot evidence:

```json
{
  "action": "wait_for",
  "test_id": "target-test-id",
  "visibility": "viewport",
  "scroll": { "strategy": "into_view", "settle_ms": 300 },
  "timeout_ms": 10000,
  "poll_ms": 500
}
```

Then the `screenshot` node must declare what the image is supposed to prove:

```json
{
  "action": "screenshot",
  "filename": "after-ac1-target-visible.png",
  "note": "AC1: target component is visible with the expected text",
  "claims": {
    "must_show": [{ "test_id": "target-test-id", "visibility": "viewport" }],
    "must_not_show": [{ "text_contains": "Fund your wallet" }]
  }
}
```

Do not treat `wait_for` fiber-tree/DOM presence, `eval_sync`, controller state,
or a passing recipe as proof that a user can see the element. Visual claims need
viewport visibility plus screenshot claims, followed by human/quality review of
the PNG/video.

The evidence package should include: task URL or prompt, product diff summary, harness verify path, recipe path, exact run command, `summary.json`, `trace.json`, `artifact-manifest.json`, screenshots/video for UI claims, quality critique, and explicit gaps.

If runtime state cannot be created, report the gap. Do not claim success from code inspection alone.

## Output

1. `Change` — files changed and why.
2. `Recipe` — path and run command.
3. `Evidence` — artifacts and verdict.
4. `Quality Loop` — critique, fix/rerun, or why first pass is enough.
5. `Human Check` — what still needs reviewer/product validation.
