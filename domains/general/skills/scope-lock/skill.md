---
maturity: experimental
name: scope-lock
description: Enforce declared file scope for PRs — changes outside declared set require explicit justification
---

# Scope Lock

## When To Use

- Reviewing agent-authored PRs (automated runs via Cursor, Copilot, etc.)
- Any PR where the diff touches files outside the ticket's stated scope
- Pre-flight check before submitting a PR
- A targeted change starts pulling you across the dependency graph

## Do Not Use When

- Intentional refactoring PRs with broad, documented scope
- Release/version-bump PRs with expected wide file changes

A PR should modify only files necessary for its stated goal. Every file outside that set creates review burden and risk. Run `diff-audit` to verify.

## Scope Declaration

Before starting work, declare the intended modification set:

```
Scope: app/scripts/controllers/perps/*.ts, ui/pages/perps/**
Reason: Fix decimal formatting in perps display logic
```

Changes outside this set require explicit justification.

## Dependency Graph Traversal

When a targeted change triggers type errors in distant files:

- Only modify dependents that **fail to compile** — do not preemptively refactor consumers that still compile
- Type-level cosmetic cleanups (e.g., `Omit<T, 'field'>` swaps) are not required — don't propagate
- Infrastructure changes should not leak from feature tasks unless explicitly scoped

## Specification Evasion Detection

| Signal | Example | Correct Response |
|--------|---------|------------------|
| New files when existing ones fail | Simplified script instead of fixing original | Diagnose the original failure |
| CLI flags not in original spec | `--skip-X` to avoid errors | Fix the errors |
| Reduced scope without discussion | "Let's just test account switching" | Surface the choice to the user |
| Success reported after adding exclusions | "Tests pass now" (with new ignores) | Report what was skipped |

When encountering a blocker: diagnose first, escalate second. Never modify spec without explicit approval. Distinguish "ran successfully" from "achieved stated goal."

## Agent Anti-Patterns

| Anti-pattern | Signal | Check |
|-------------|--------|-------|
| Porting without adapting | New utility/hook duplicating existing one | Grep codebase for existing equivalents |
| Blast radius blindness | Files modified outside feature directory | Justify each against ticket scope |
| Workaround cascade | Config changes for one test/feature | See `specifications-as-guardrails` cascade rule |

## Common Pitfalls

| Mistake | Correct Approach |
|---------|-----------------|
| package.json changes for undeclared deps | Revert — only declared deps belong |
| attribution.txt modified in feature PR | Revert — release artifacts are release-only |
| New hook that reimplements abstraction | Grep for existing utilities first |
| shared config e.g. jest/webpack changed for small number of tests | Find the scoped fix in the test itself |
| Dev artifacts committed | Revert — only commit files that should be tracked in repo |
