---
maturity: experimental
name: diff-audit
description: Systematic file-by-file PR diff review — categorize, justify, flag out-of-scope changes
---

# Diff Audit

## When To Use

- Reviewing any PR before approving — especially agent-authored PRs
- Self-reviewing before requesting review
- A PR diff looks disproportionately large for the stated goal

## Do Not Use When

- Automated release PRs with expected wide file changes (version bumps, changelog)
- Reviewing a single-file hotfix with obvious scope

Concrete trigger: PR #41558 had 7 changes outside ticket scope (~2.5h reviewer time). A systematic diff audit would have caught all on first pass.

## Workflow

1. Run `git diff --stat <base>...HEAD` (or check the PR Files tab)
2. For each file, assign a category from the table below
3. Apply the category's check — if it fails, flag for revert or justification
4. Report: list of flagged files with category and reason

## File Categories

| Category | Examples | Check |
|----------|----------|-------|
| In-scope feature code | Files in ticket's target directories | Should match ticket scope declaration |
| Mechanically required | Import updates, type re-exports forced by in-scope changes | Would the in-scope change compile without this? |
| Test updates | Test files for changed code | Do assertions test new behavior, not weaken old? |
| Dependencies | package.json, yarn.lock | Only declared deps changed? No version downgrades? |
| Build/test config | jest.config, webpack, tsconfig, babel | Why does the feature need config changes? (Red flag — see `specifications-as-guardrails`) |
| Release artifacts | attribution.txt, CHANGELOG.md, version fields | Is this a release PR? If no, revert |
| Generated files | yarn.lock, lockfiles | Proportional to declared dep changes? |
| Dev artifacts | PR_DESC.md, .cursor/*, .vscode/*, local paths | Should not be committed — revert |

## Triage Per File

1. Is this file in the declared scope?
2. If not, is it mechanically required by an in-scope change?
3. If not, does it affect shared infrastructure?
4. If yes to #3, why don't other consumers need this change?
5. Would reverting this file break the feature? If no, revert it.

## Agent-Specific Checks

Agent-authored PRs (Cursor, Copilot, etc.) have predictable failure modes. Add these checks:

| Check | What to look for |
|-------|-----------------|
| Platform convention violations | New patterns that duplicate existing utilities (`useAsyncResult`, `StorageService`) |
| Rebase damage | Dependency downgrades, removed packages not in ticket scope |
| Config pollution | `transformIgnorePatterns`, webpack aliases added for one feature |
| Stale references | Imports from moved/renamed files the agent found via outdated index |
| Dev artifact leakage | PR_DESC.md, .cursor/*, filesystem paths in committed files |

## Common Pitfalls

| Mistake | Correct Approach |
|---------|-----------------|
| Reviewing feature logic before checking scope | First pass is always scope audit — flag tangential files before reading code |
| Accepting config changes because "tests pass now" | Ask why other consumers don't need the same config change |
| Ignoring yarn.lock diff size | Large yarn.lock delta with small package.json delta = rebase damage |
| Treating agent anti-patterns as code quality issues | They're scope violations — the pattern exists, the agent didn't find it |
| Skipping generated file review | Generated files can encode dependency corruption silently |
