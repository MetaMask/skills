---
name: recipe-pr-review
description: Review a MetaMask PR by extracting behavioral claims, finding code risks, and requiring recipe-backed proof for claims that need runtime validation. Use when a reviewer or agent needs code review plus executable evidence strategy, especially for ADR-58 recipe workflows.
maturity: experimental
---

# Recipe PR Review

`recipe-pr-review` is a PR review workflow that combines normal code review with recipe-backed validation. It should identify bugs and also say what must be proven.

Load only what applies:

- Evidence formatting: use `/recipe-evidence`
- Runtime setup: use `/recipe-harness`
- Recipe authoring: use `/recipe-cook`
- Recipe critique: use `/recipe-quality`
- Target-repo review notes are appended below when installed.

## Workflow

1. Inspect the PR diff, issue, acceptance criteria, tests, and reviewer discussion.
2. List the PR's behavioral claims as proof targets.
3. Review the code for correctness, regressions, security, maintainability, and missing tests.
4. Classify each proof target:
   - covered by existing tests;
   - needs a new or updated test;
   - needs a runtime recipe;
   - manual or environment-only.
5. For runtime targets, require `/recipe-harness verify`, then call `/recipe-cook`. If harness verification fails, mark runtime proof blocked rather than product-failed.
6. Call `/recipe-quality` on any recipe or evidence before trusting it.
7. Return findings first, then the proof plan.

## Output

Use this shape:

1. `Findings` — severity-ranked code review issues with file and line.
2. `Proof Targets` — claims extracted from the PR.
3. `Recipe Plan` — which targets need `/recipe-cook`, with paths or proposed recipe names.
4. `Evidence Needed` — artifacts needed before merge.
5. `Residual Risk` — what remains unproven.
