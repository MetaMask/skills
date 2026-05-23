---
name: recipe-qa
description: Run or prepare recipe-backed QA for a MetaMask PR. Use when an agent needs to validate changed behavior, execute available recipes, collect artifacts, judge evidence quality, and report whether the PR is runtime-proven.
maturity: experimental
---

# Recipe QA

`recipe-qa` is the runtime validation workflow for PRs. It is narrower than code review: its job is to prove or disprove behavior with executable recipes and artifacts.

Load only what applies:

- Author missing recipes with `/recipe-cook`
- Install/verify runtimes with `/recipe-harness`
- Critique recipes and run artifacts with `/recipe-quality`
- Format PR evidence with `/recipe-evidence`
- Target-repo QA notes are appended below when installed.

## Workflow

1. Read the PR/task and existing recipe files or validation notes.
2. Identify proof targets and existing coverage.
3. For Mobile or Extension runtime proof, run `/recipe-harness verify` first.
4. Run available recipes if the environment is ready.
5. If no recipe exists for a needed runtime target, call `/recipe-cook`.
6. Package artifacts: `recipe.json`, `summary.json`, `trace.json`, `artifact-manifest.json`, screenshots/logs/reports.
7. Call `/recipe-quality`.
8. Report pass, pass-with-gaps, or fail.

If harness verification fails or is missing, report runtime proof as blocked, not as a product failure.

## Output

1. `Verdict` — pass, pass-with-gaps, or fail.
2. `Ran` — commands/recipes executed.
3. `Artifacts` — paths and what each proves.
4. `Recipe Quality` — must-fix issues from `/recipe-quality`.
5. `Merge Risk` — concise remaining risk.
