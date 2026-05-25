---
name: recipe-dev
description: Build a MetaMask feature or product change from a task/ticket with recipe-backed validation. Use when an agent should implement a change, prove the happy path in a live Mobile or Extension runtime when applicable, package evidence, and stop for human review.
maturity: stable
---

# Recipe Dev

`/mms-recipe-dev` is the high-level workflow for feature/dev work that should end near a working fix plus reviewable proof.

It exists to steer the agent through the full loop. Lower-level recipe skills are proof tools; this skill makes the agent use them instead of stopping at a code diff, unit tests, or a confidence summary.

Use it when the task is broader than a bug fix. For pure bugs, prefer `/mms-recipe-fix-ticket`. For PR review/QA only, prefer `/mms-recipe-pr-review` or `/mms-recipe-qa`.

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

1. Read the task/ticket and extract acceptance criteria.
2. Make the smallest product change.
3. Install/verify the recipe harness when runtime proof applies.
4. Author or update a recipe for the main happy path and key regression.
5. Run the live recipe and save artifacts.
6. Run `/mms-recipe-quality`; improve once if evidence is weak.
7. Return a PR-ready summary and stop for human validation unless asked to open a PR.

The evidence package should include: task URL or prompt, product diff summary, harness verify path, recipe path, exact run command, `summary.json`, `trace.json`, `artifact-manifest.json`, screenshots/video for UI claims, quality critique, and explicit gaps.

If runtime state cannot be created, report the gap. Do not claim success from code inspection alone.

## Output

1. `Change` — files changed and why.
2. `Recipe` — path and run command.
3. `Evidence` — artifacts and verdict.
4. `Quality Loop` — critique, fix/rerun, or why first pass is enough.
5. `Human Check` — what still needs reviewer/product validation.
