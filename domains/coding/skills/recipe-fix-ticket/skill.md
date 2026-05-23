---
name: recipe-fix-ticket
description: Fix a MetaMask bug from a Jira/GitHub ticket using recipe-backed validation. Use when an agent needs to understand a bug report, implement a minimal fix, prove the fix with a recipe, and prepare reviewer-ready evidence.
maturity: stable
---

# Recipe Fix Ticket

`recipe-fix-ticket` is for bug-fix work that must end with proof, not just a patch.

Load only what applies:

- Runtime validation: `/recipe-qa`
- Runtime setup: `/recipe-harness`
- Recipe authoring: `/recipe-cook`
- Recipe critique: `/recipe-quality`
- PR evidence formatting: `/recipe-evidence`
- Target-repo fix notes are appended below when installed.

## Workflow

1. Read the ticket, linked PRs/issues, logs, screenshots, and acceptance criteria.
2. Reconstruct the expected behavior and failure mode.
3. Find the smallest relevant code path and existing tests.
4. Add or update focused tests where they directly prove the bug.
5. Patch the root cause.
6. Use `/recipe-harness` and `/recipe-cook` for runtime proof if the bug is user-visible, stateful, cross-system, or historically flaky.
7. Run `/recipe-qa` and `/recipe-quality`.
8. Return the patch summary and evidence.

## Output

1. `Root Cause` — concise explanation.
2. `Fix` — files changed and why.
3. `Tests` — commands run and result.
4. `Recipe Evidence` — recipe path, artifacts, and verdict.
5. `Remaining Risk` — only if something is unproven.
