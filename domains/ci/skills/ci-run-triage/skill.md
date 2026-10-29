---
maturity: experimental
name: ci-run-triage
description: >-
  Watch a GitHub Actions run and find out why it failed with the gh CLI. Use when asked to monitor, watch or check a CI run, to explain a failed workflow or a red PR check, to count failed jobs, or to read job logs. Covers finding the run, pass or fail by exit code, listing every job on runs with more than 100 jobs, re-run attempts, annotations and commit statuses, filtering logs, and the workflow behaviors that make a run look broken when it is not.
---

# CI Run Triage

Answer "did the run pass, and if not, why" from the terminal. `gh` must be authenticated for the repository (`gh auth status`).

## When To Use

- A push, dispatch or PR just started a workflow and you need the outcome.
- A run failed, or a PR check is red, and you need the failing job, step and cause.
- A count of failed or skipped jobs decides the next step.

## Do Not Use When

- You are changing a workflow and need to test it. Use `workflow-fork-testing`.
- The failure is already in the log you were given. Read it directly.

## Workflow

### Find The Run

A run for a just-pushed commit can take a few seconds to appear. Retry briefly and filter on the commit and workflow, not on "latest". On a busy branch, `--limit 5` without filters can miss the run:

```bash
gh run list --repo OWNER/REPO --commit SHA --workflow NAME \
  --json databaseId,headSha,status,conclusion,workflowName,event
```

`--event` narrows further (`push`, `pull_request`, `workflow_dispatch`).

If nothing starts, check that the workflow is enabled and that the trigger matches (branch filter, `github.event.created` for new refs only, path filters). A re-run is not a new run. It reuses the original event, `GITHUB_SHA` and `GITHUB_REF`. To test a changed workflow, secret or variable, start a new run (new push or dispatch) instead of trusting a re-run to pick it up.

A run that ends in `startup_failure` with no jobs never started. Common causes: an invalid workflow file (run `actionlint`), an action that the org or repository allowlist blocks, or a called reusable workflow that asks for more `permissions:` than the caller grants. `actionlint` catches only the first.

### Wait For The Result

```bash
gh run watch RUN_ID --repo OWNER/REPO --exit-status
```

The exit code is the verdict. Then read the jobs, because a green run can hide skipped jobs that mattered.

`gh run watch` blocks and polls GitHub itself (every 3 seconds, `--interval` changes it). It needs a run id, so find the run first. Do not write your own loop of `gh run view` and `sleep`. In an agent environment, start the watch in a background or async terminal and end your turn instead of waiting on it. The tool notifies you when the command exits, and the exit code is the result. Do not poll the terminal while you wait.

### List Jobs Without Losing Any

Large repositories run 100+ jobs per run. Depending on the `gh` version, `gh run view --json jobs` may not return all of them, so do not count failures from it. Use the jobs endpoint and extract the array so the pages concatenate:

```bash
gh api --paginate "repos/OWNER/REPO/actions/runs/RUN_ID/jobs?per_page=100" \
  --jq '.jobs[] | {id, name, conclusion}'
```

Filter with `select(.conclusion == "failure")` for failures. `--paginate` on a JSON object response without `--jq` produces invalid concatenated JSON. Use `--paginate --slurp` instead if you need one JSON array to process further.

The endpoint returns the latest attempt only. For a re-run, add `&filter=all` to see every attempt, or use `runs/RUN_ID/attempts/N/jobs` for one attempt, and `gh run view RUN_ID --attempt N` for its logs. Otherwise a failure that a re-run fixed disappears, and so does a flake.

Classify a failure by its failing step and log line, not by the job name. A test job can fail while downloading a tool or installing dependencies, which is an infrastructure failure, not a test failure. A job that only aggregates other jobs' results (a status gate) fails because something upstream failed. Find that root failure.

### Read Annotations First

A job's id is also its check-run id, so its annotations come from the checks API:

```bash
gh api --paginate "repos/OWNER/REPO/check-runs/JOB_ID/annotations" \
  --jq '.[] | "\(.annotation_level) \(.path):\(.start_line) \(.message)"'
```

Annotations are structured, need no cleanup, and stay after logs expire. GitHub keeps only a limited number per step and per job and drops the rest without notice, so a missing annotation does not prove nothing else failed.

### Read Logs

```bash
gh api repos/OWNER/REPO/actions/jobs/JOB_ID/logs     # one job, raw
gh run view RUN_ID --repo OWNER/REPO --log-failed    # all failed jobs
```

On runs with 100+ jobs, use the per-job endpoint. `--log-failed` downloads the whole run's log archive and can be slow or fail. Both work only after the job or run completes, and logs expire under the repository's retention setting (the API then returns 404 `BlobNotFound`).

The two formats differ. The raw job log has `TIMESTAMP message` lines. `gh run view --log` and `--log-failed` add a tab-separated `JOB<TAB>STEP<TAB>` prefix (the step is often `UNKNOWN STEP`). Both can start with a byte-order mark and contain ANSI color codes. Strip them before `grep` (GNU sed, as in Git Bash and Linux):

```bash
# gh run view --log output
sed 's/^[^\t]*\t[^\t]*\t//; s/^\xef\xbb\xbf//; s/^[0-9T:.-]*Z //; s/\x1b\[[0-9;]*m//g'
# raw job log
sed 's/^\xef\xbb\xbf//; s/^[0-9T:.-]*Z //; s/\x1b\[[0-9;]*m//g'
```

Search for `##[error]`, which is how the runner renders an error annotation. Do not search for `::error::`: a step's log can echo a script's source, which contains that string without an error happening. Confirm with the step's conclusion.

Job summaries (`$GITHUB_STEP_SUMMARY`) have no REST endpoint. Read them in the web UI, or find the content in the step's log.

### Explain A Red PR Check

Not every check on a PR is a job. A workflow can post a commit status (for example with `createCommitStatus`) that shows next to the jobs but is not in the jobs list. Look at both:

```bash
gh api "repos/OWNER/REPO/commits/SHA/status" --jq '.statuses[] | "\(.state) \(.context)"'
gh api --paginate "repos/OWNER/REPO/commits/SHA/check-runs?per_page=100" \
  --jq '.check_runs[] | "\(.conclusion) \(.name)"'
```

A status can disagree with the job that posted it, for example when two runs race to set the same context. Find the run that set the current value.

## Behaviors That Mislead

| Looks like | Usually |
|---|---|
| A step silently did not run | An earlier step failed. An `if:` without a status function (`always()`, `failure()`, `cancelled()`, `success()`) gets an implicit `success() &&`. Add `!cancelled()` or `always()` when it must run after a failure. |
| A fix did not take effect | A `workflow_run` workflow runs the YAML on the default branch, not the pushed branch. |
| A secret is empty in a called workflow | `workflow_call` only passes secrets the caller lists (or `secrets: inherit`) and the callee declares. A direct dispatch reads repo secrets and hides this. |
| A secret is empty on a PR | The PR comes from a fork. Fork PRs get no secrets and a read-only `GITHUB_TOKEN`. |
| A job was `cancelled` | A matrix sibling failed and `fail-fast` (default `true`) cancelled the rest, so the cancelled shards say nothing about their own tests. Or the job passed `timeout-minutes`, or a `concurrency` group replaced the run, or someone cancelled it. |
| A job is red but the run is green, or the reverse | `continue-on-error` on the job or step. |
| Fewer failures than expected | The job list was truncated, or you are looking at a later attempt. Paginate, and check `filter=all`. |

## Report

State the run, attempt and commit, which jobs failed, the failing step and the log line or annotation that shows the cause, whether it is a test, code or infrastructure failure, and whether a re-run is worthwhile. Do not say a run passed without the exit code or the job conclusions.
