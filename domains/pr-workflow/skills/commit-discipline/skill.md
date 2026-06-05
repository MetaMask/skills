---
maturity: experimental
name: commit-discipline
description: Atomic commits, granular commit chain construction, and pre-push lint discipline
---

# Commit Discipline

## When To Use

- Creating commits for a PR
- Splitting or reorganizing work before pushing
- Reviewing a commit chain before requesting review

## Do Not Use When

- The PR will be squash-merged via the GitHub UI (the merge bot owns final commit shape)
- WIP commits on a personal branch with no PR planned

## Atomic Commit Rule

Each commit must contain changes that share a single motivation.

**Test:** Can you describe this commit's purpose in one sentence without `and`?
- "Fix selector memoization breaking cascade" → ✓ atomic
- "Fix selector and clean up test fixtures" → ✗ split it

Exception: causally linked changes belong together (e.g., a type change that forces a test update).

## Commit Chain Construction

Build commits by working backward from desired final state:

1. Verify the desired final state (all changes in place, tests pass)
2. Restore to base (`git stash` or `git reset HEAD~n`)
3. Build each commit in order, verifying state at each step
4. Confirm final committed state matches desired final state exactly

Don't commit incrementally during development — categorize changes first, then assemble.

**Mechanics:** use porcelain `git commit`. It runs hooks, honors signing config (`commit.gpgsign`), and applies commit templates. Don't hand-assemble commits with `git commit-tree` / `git write-tree` — that bypasses hooks and config. Leave commit trailers (`Co-authored-by`, `Signed-off-by`) in place; don't strip attribution.

## Pre-Push Checklist

- [ ] Each commit passes standalone (`git stash --keep-index && yarn test:unit`)
- [ ] No lint errors on changed files
- [ ] No test changes that weaken assertions (specs are guardrails, not obstacles)
- [ ] Commit messages describe motivation, not diff inventory

## Common Pitfalls

| Mistake | Correct Approach |
|---------|-----------------|
| Bundling orthogonal changes (bug fix + lint cleanup) | Separate commits — they don't share motivation |
| Committing incrementally during development | Organize after the work, not during |
| Message like "Fix tests" | "Fix `getAccounts` selector to stop returning new reference on equal input" |
| Modifying tests to make them pass | Fix the implementation; tests are the spec |
| Hand-building commits with `git commit-tree` | Use `git commit` — it honors hooks, signing, and templates |
| Stripping trailers (`Co-authored-by`, `Signed-off-by`) | Keep trailers — preserve attribution and sign-off |
