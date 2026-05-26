---
name: recipe-fix-ticket
description: Fix a MetaMask bug from a Jira/GitHub ticket using recipe-backed validation. Use when an agent needs to reproduce or understand an existing failure, implement a minimal fix, prove the acceptance criteria with a recipe, and prepare reviewer-ready evidence.
maturity: experimental
---

# Recipe Fix Ticket

`recipe-fix-ticket` is for bug-fix work that must end with proof, not just a patch. Unlike `/mms-recipe-dev`, it starts by reproducing or understanding an existing failure before making the smallest fix.

Load only what applies:

- Runtime setup: `/recipe-harness`
- Recipe authoring: `/recipe-cook`
- Recipe critique: `/recipe-quality`
- PR evidence formatting: `/recipe-evidence`
- Target-repo fix notes are appended below when installed.

## Non-Negotiable Proof Contract

For user-visible, stateful, or acceptance-criteria-driven tickets, do **not**
stop at a code diff, unit tests, or type checks. A complete fix package must
include:

- the ticket URL or copied ticket prompt;
- a product diff summary excluding harness/generated files;
- `/recipe-harness` install/verify status and artifact path;
- an executable recipe path;
- the exact recipe run command;
- `summary.json`;
- `trace.json`;
- `artifact-manifest.json` or evidence manifest;
- screenshots/video for reviewer-visible UI claims;
- `/recipe-quality` critique;
- one improvement/rerun cycle, or an explicit note that the first pass already
  meets the evidence bar;
- a PR-ready evidence summary;
- explicit gaps for any unexercised proof target.

If the runtime cannot create the required state (for example a BTC open-position
fixture is unavailable), mark that proof target as `blocked`/`gap`. Do **not**
claim the acceptance criteria are met from code inspection or unit tests alone.

## Workflow

1. Read the ticket, linked PRs/issues, logs, screenshots, and acceptance criteria. If the expected behavior or acceptance criteria are unclear, stop and ask for clarification before implementing.
2. Reconstruct the expected behavior and failure mode.
3. Find the smallest relevant code path and existing tests.
4. Add or update focused tests where they directly prove the bug.
5. Patch the root cause.
6. Use `/recipe-harness` and `/recipe-cook` for runtime proof if the bug is user-visible, stateful, cross-system, historically flaky, or tied to acceptance criteria.
7. Run the recipe; a dry-run is schema-only and is not runtime proof.
8. Run `/recipe-quality` on the recipe plus evidence.
9. Classify any weakness into the correct layer: product, recipe, fixture/state setup, harness/runtime, skill instruction, evidence packaging, or runner steering.
10. Patch the smallest correct layer and rerun from the smallest meaningful point.
11. Return the patch summary and evidence.

## Output

1. `Root Cause` — concise explanation.
2. `Fix` — files changed and why.
3. `Tests` — commands run and result.
4. `Recipe Evidence` — recipe path, artifacts, and verdict.
5. `Quality Loop` — critique result, improvement made, and rerun status.
6. `Remaining Risk` — only if something is unproven.
