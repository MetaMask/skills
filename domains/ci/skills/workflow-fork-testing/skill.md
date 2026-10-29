---
maturity: experimental
name: workflow-fork-testing
description: >-
  Test a GitHub Actions workflow or composite action change on a personal fork before opening the PR. Use when asked to test a workflow change, prove a CI fix, reproduce a workflow bug, or check what a workflow does on a real push or dispatch. Covers creating a per-person test fork in the consensys-test organization (Actions, secrets, labels, upstream-only guards), running the committed file with minimal fork-only edits, building fixture branches without touching the working tree, control and fixed runs, deterministic failures for retry logic, resetting fork state, and reporting exactly what ran and what was not covered.
---

# Workflow Fork Testing

Run a workflow change on a fork you control, so the result describes the change as committed. Watching and reading the runs is `ci-run-triage`.

## When To Use

- A PR changes `.github/workflows/*` or a composite action and the behavior depends on a real run.
- A reviewer reports a workflow bug and you need to reproduce it, then show the fix.
- A shared action's new version must work for existing callers.

## Do Not Use When

- The change is pure syntax. Lint it (`actionlint`).
- The target cannot be reproduced on a fork (real token exchange, org-only secrets). Say so instead of approximating it silently.

## Set Up A Test Fork

MetaMask workflow tests run in per-person forks in the `consensys-test` organization, not in personal-account forks. They are named `<upstream-repo>-<your-name>`, for example `consensys-test/metamask-extension-howard` and `consensys-test/metamask-mobile-howard`. An organization can hold several forks of the same upstream as long as their names differ, so each person gets their own and no one's fixtures, secrets or open PRs interfere with anyone else's. The org also has older shared or ticket-named forks (`metamask-extension-test`, `metamask-mobile-infra-3037`). Do not reuse those, because you cannot tell what state someone left them in.

If you already have a fork, reuse it and reset it (see below). An agent must never create a repository or fork on its own, not even a throwaway one to test a setting. It asks the human first, and reuses an existing fork when it can. To create one:

1. **Get access.** You need to be a member of `consensys-test`. Members can create repositories there. If `gh api user/memberships/orgs/consensys-test` returns 404, ask an org owner to invite you.
2. **Fork server-side, without cloning.** The upstream is large, and you already have a clone:

   ```bash
   NAME=yourname   # lowercase, as in your other test repos
   gh repo fork MetaMask/metamask-extension --org consensys-test \
     --fork-name metamask-extension-$NAME --default-branch-only --clone=false
   ```

   Always pass `--fork-name`. Without it, GitHub uses the upstream name, and the org already has a repository with that name. `--default-branch-only` avoids copying every release branch, because stale release branches change the results of release workflows.
3. **Add it as a remote of your existing clone.** Name the remote after the fork so it cannot be confused with `origin`:

   ```bash
   git remote add test-$NAME git@github.com:consensys-test/metamask-extension-$NAME.git
   git fetch test-$NAME
   ```

4. **Enable Actions.** A new fork reports `enabled: true`, but pushes start no runs until you call the endpoint below. Scheduled workflows stay off even after that. The API call is enough, with no browser step:

   ```bash
   R=consensys-test/metamask-extension-$NAME
   gh api -X PUT repos/$R/actions/permissions -F enabled=true -f allowed_actions=all
   gh api -X PUT repos/$R/actions/permissions/workflow \
     -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false
   ```

   Keep `GITHUB_TOKEN` read-only by default. Upstream workflows declare the `permissions:` they need, and a write default would hide a missing declaration. Set `can_approve_pull_request_reviews=true` only if the workflow under test opens or approves PRs with `GITHUB_TOKEN`. Organization policy can override both settings, so read them back with `gh api repos/$R/actions/permissions/workflow`. Confirm with one trivial push that a run starts. Push after the call, because a push made before it starts nothing.

   `allowed_actions=all` is looser than upstream's action allowlist. If your change adds a third-party action, check that upstream allows it. The fork cannot show that.
5. **Add only the secrets and variables the workflow under test reads.** Org and upstream secrets and `vars.*` are not inherited, and a fork has none. Set variables with `gh variable set NAME --repo $R --body VALUE`. A secret must be set by the human with `gh secret set NAME --repo $R` and no `--body`, so it prompts for the value and the value stays out of shell history and out of an agent's context. An agent hands this step to the human instead of answering the prompt. For a token the workflow uses to push or open PRs (`PR_TOKEN` in the release workflows), create a fine-grained token with `consensys-test` as resource owner, limited to your fork, with Contents and Pull requests write. Never use a token that can write to `MetaMask/*`. The org requires an owner to approve fine-grained tokens, so request approval before you start and expect `PR_TOKEN` calls to fail until it is granted.
6. **Disable workflows you are not testing.** Every fixture push otherwise starts dozens of runs, which bury the one you care about and use the org's minutes. `gh workflow list --repo $R`, then `gh workflow disable NAME --repo $R` for the rest. Enable one again with `gh workflow enable` when you need it. Keep enabled the workflows that trigger the chain under test and any `workflow_run` consumers. If the triggering workflow is disabled, its `workflow_run` consumer never fires, and nothing reports an error. A disabled reusable workflow still runs when another workflow calls it, so disabling one hides it from direct triggers only.
7. **Create labels the workflow applies or filters on** with `gh label create NAME --repo $R`. A fork has GitHub's default labels only, so `--add-label` fails on the others.
8. **Check for upstream-only guards.** Search the workflow for `github.repository ==` and `github.repository_owner ==`. Jobs behind those guards are skipped on the fork, which looks like a pass. Edit the guard in the fork copy and list it as a deviation.

The fork is public because the upstream is public. Anything you push there can be read by anyone, so never put tokens or private data in fixtures.

When you use the fork, pass `--repo $R` to every `gh pr`, `gh run` and `gh workflow` command. In a clone of the upstream, `gh` targets the upstream by default, so a test PR without `--repo` opens against `MetaMask/*`.

To update the fork's `main`, run `gh repo sync $R --source MetaMask/metamask-extension` before you add test commits to it. Once `main` carries test commits (for example a `workflow_run` change), the sync fails, and `--force` throws the commits away. Sync first, then re-apply them. Before any update to `main`, check that it will not make an open PR's base equal to its head, because GitHub then marks that PR merged.

## Workflow

1. **Test the committed file.** Derive the fork copy from the branch (`git show BRANCH:path`), apply only edits the fork cannot avoid (the token source, a hardcoded repository URL, a secret pass-through, a runner label), and show `diff` between the original and the copy. Copies derived from a working tree can pass while the committed branch is wrong, for example when only part of the change was staged.
2. **Use the real trigger path.** A push-triggered workflow runs the file from the pushed commit. `workflow_dispatch` runs the file from `--ref`. A `workflow_run` workflow runs the default branch's YAML, so to test a change to one, put it on the fork's `main`. A reusable workflow reached by dispatch reads repo secrets, but through `workflow_call` it only gets what the caller passes, so test the caller. Events caused by `GITHUB_TOKEN` (a push, or a PR it opens) do not start other workflows, except `workflow_dispatch` and `repository_dispatch`. A push or PR chain that works upstream with a personal token stops on the fork if the copy uses `GITHUB_TOKEN`. A dispatch chain still works.
3. **Prove a bug fix with a control.** Run the unfixed version first and show the failure, then the fixed one. A fix with no reproduced failure is a guess.
4. **Make failures deterministic.** To test retry, re-run or failure-handling logic, do not wait for a real flake. Add a fork-only job or fixture that fails on purpose and reads `github.run_attempt`, for example one that fails on attempt 1 and passes after. Use the same approach for logic that depends on labels or job names, and list the fixture as a deviation.
5. **Keep the experiment out of your working tree.** Build fixture commits with plumbing so the checked-out branch is untouched. Run it in a subshell so `GIT_INDEX_FILE` cannot leak into your shell if a command fails. A leaked value makes your next `git commit` record the fixture tree:

   ```bash
   T=$(
     set -e
     export GIT_INDEX_FILE="$(git rev-parse --absolute-git-dir)/fixture-index"
     trap 'rm -f "$GIT_INDEX_FILE"' EXIT
     git read-tree BASE_COMMIT
     H=$(git hash-object -w copy.yml)
     git update-index --add --cacheinfo 100644,$H,.github/workflows/name.yml
     git commit-tree "$(git write-tree)" -p BASE_COMMIT -m "test: fixture"
   )
   [ -n "$T" ] && git show --stat "$T" && git push FORK "$T:refs/heads/release/9.9.9"
   ```

   On Windows Git Bash, prefix a path-like `git show REF:path` with `MSYS2_ARG_CONV_EXCL='*'` for that command only.
6. **Push only to forks, with an explicit destination.** Always push `FORK SRC:refs/heads/DEST`, as above. A bare `git push` uses the branch's upstream, and a branch made from the fork's `main` often tracks `FORK/main`, so the push lands on `main`. Check `git branch -vv` if you must push without a destination. Never push a commit that makes an open PR's base and head identical, and never merge.
7. **Verify the commit before pushing.** Run `git show --stat COMMIT` and check that it lists every file you meant to change. For example, if you edit some files and delete another with `git rm`, only the deletion is staged, and a plain `git commit` leaves the edits out.
8. **Open test PRs inside the fork.** Use `gh pr create --repo $R --base main --head BRANCH --draft`. A PR from another repository takes the forked-PR path, with no secrets, a read-only token and `head.repo.full_name != github.repository`. That tests a different trust path from the one upstream contributors with write access get.
9. **Check that nothing leaked before opening the real PR.** Run `git diff origin/main...BRANCH --stat` on the branch under review and confirm that no fixture files or fork-only workflow edits are in it.

## Reset Between Runs

Record the old SHAs, then close the test PR, delete its branch and any generated branch, and rebuild the fixture. Pushing a ref that already points at the same commit does nothing. To rerun a push workflow, push to a new branch name or build a new fixture commit. `workflow_dispatch` can always run again on the same ref. If you enabled a disabled workflow to dispatch it, disable it again afterwards. Leftover fixtures change results: a script that picks a baseline from earlier release branches fails on an older branch that never got its changelog section.

## Fork-Only Traps

| Symptom | Cause |
|---|---|
| Validation fails on repository links | A URL taken from `github.repository` is the fork's, but the fixture's links point at upstream. Hardcode the upstream URL in the copy. |
| No run starts | Actions not enabled through the API yet, workflow disabled on the fork, branch filter, or `github.event.created` needs a newly created ref. |
| A `workflow_run` consumer fires but runs old code | The consumer change is not on the fork's `main`. `workflow_run` always uses the default branch's YAML. |
| A `workflow_run` consumer never fires | The triggering workflow is disabled on the fork, or its name in `workflows:` does not match. |
| A job stays queued forever | It requests a larger or custom runner label, or an org runner group, that the fork does not have. Point the copy at `ubuntu-latest` and list it as a deviation. |
| Script skips opening a PR | It treats closed PRs for the branch as "already handled". Open the PR by hand to mimic the state you want. |
| The first runs are slow or behave differently | The fork's Actions cache starts empty. |
| Line-ending noise in diffs | Windows autocrlf. Normalize both files to LF before diffing. |

## Report

For each run give the fork branch and commit that ran, the run id and attempt, the deviations from the committed file, the result, and what the fork could not cover (real tokens, org secrets, other trigger paths, `merge_group` unless the fork has a merge queue ruleset). Say which branch the tests did not run on if that differs from the one under review.
