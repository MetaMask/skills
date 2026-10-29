---
maturity: experimental
name: ci-run-triage
description: >-
  Watch a GitHub Actions run and find out why it failed with the gh CLI. Use when asked to monitor, watch or check a CI run, to explain a failed workflow, to count failed jobs, or to read job logs. Covers waiting for a run to appear, pass or fail by exit code, listing every job on runs with more than 100 jobs, filtering logs, and the workflow behaviors that make a run look broken when it is not.
---

# CI Run Triage

Answer "did the run pass, and if not, why" from the terminal. `gh` must be authenticated for the repository (`gh auth status`).

## When To Use

- A push, dispatch or PR just started a workflow and you need the outcome.
- A run failed and you need the failing job, step and cause.
- A count of failed or skipped jobs decides the next step.

## Do Not Use When

- You are changing a workflow and need to test it. Use `workflow-fork-testing`.
- The failure is already in the log you were given. Read it directly.

## Workflow

### Find The Run

A run for a just-pushed commit can take a few seconds to appear. Retry briefly and match on the commit, not on "latest":

```bash
gh run list --repo OWNER/REPO --branch BRANCH --limit 5 --json databaseId,headSha,status,conclusion,workflowName
```

If nothing starts, check that the workflow is enabled and that the trigger matches (branch filter, `github.event.created` for new refs only, path filters). A re-run is not a new run. It reuses the original event, `GITHUB_SHA` and `GITHUB_REF`. To test a changed workflow, secret or variable, start a new run (new push or dispatch) instead of trusting a re-run to pick it up.

If the run failed at startup (`startup_failure`) with no jobs, the workflow file is usually invalid. Run `actionlint` on it.

### Wait For The Result

```bash
gh run watch RUN_ID --repo OWNER/REPO --exit-status
```

The exit code is the verdict. Then read the jobs, because a green run can hide skipped jobs that mattered.

### List Jobs Without Losing Any

Large repositories run 100+ jobs per run. Depending on the `gh` version, `gh run view --json jobs` may not return all of them, so do not count failures from it. Use the jobs endpoint and extract the array so the pages concatenate:

```bash
gh api --paginate "repos/OWNER/REPO/actions/runs/RUN_ID/jobs?per_page=100" \
  --jq '.jobs[] | {name, conclusion}'
```

Filter with `select(.conclusion == "failure")` for failures. `--paginate` on a JSON object response without `--jq` produces invalid concatenated JSON. Use `--paginate --slurp` instead if you need one JSON array to process further.

The endpoint returns the latest attempt only. For a re-run, add `&filter=all` to see every attempt, or use `runs/RUN_ID/attempts/N/jobs` for one attempt, and `gh run view RUN_ID --attempt N` for its logs. Otherwise a failure that a re-run fixed disappears, and so does a flake.

Classify a failure by its failing step and log line, not by the job name. A test job can fail while downloading a tool or installing dependencies, which is an infrastructure failure, not a test failure. A job that only aggregates other jobs' results (a status gate) fails because something upstream failed. Find that root failure.

### Read Logs

```bash
gh run view RUN_ID --repo OWNER/REPO --log-failed
gh api repos/OWNER/REPO/actions/jobs/JOB_ID/logs     # one job, raw
```

`--log-failed` and `--log` work only after the run completes, and logs expire under the repository's retention setting (the API then returns 404 `BlobNotFound`).

The two formats differ. The raw job log has `TIMESTAMP message` lines. `gh run view --log` and `--log-failed` add a tab-separated `JOB<TAB>STEP<TAB>` prefix (the step is often `UNKNOWN STEP`). Both can start with a byte-order mark and contain ANSI color codes. Strip them before `grep` (GNU sed, as in Git Bash and Linux):

```bash
# gh run view --log output
sed 's/^[^\t]*\t[^\t]*\t//; s/^\xef\xbb\xbf//; s/^[0-9T:.-]*Z //; s/\x1b\[[0-9;]*m//g'
# raw job log
sed 's/^\xef\xbb\xbf//; s/^[0-9T:.-]*Z //; s/\x1b\[[0-9;]*m//g'
```

Search for `##[error]`, which is how the runner renders an error annotation. Do not search for `::error::`: a step's log can echo a script's source, which contains that string without an error happening. Confirm with the step's conclusion.

## Behaviors That Mislead

| Looks like | Usually |
|---|---|
| A step silently did not run | An earlier step failed. An `if:` without a status function (`always()`, `failure()`, `cancelled()`, `success()`) gets an implicit `success() &&`. Add `!cancelled()` or `always()` when it must run after a failure. |
| A fix did not take effect | A `workflow_run` workflow runs the YAML on the default branch, not the pushed branch. |
| A secret is empty in a called workflow | `workflow_call` only passes secrets the caller lists (or `secrets: inherit`) and the callee declares. A direct dispatch reads repo secrets and hides this. |
| A job was `cancelled` | A `concurrency` group replaced the run with a newer one, or someone cancelled it. It is not a test failure. |
| Fewer failures than expected | The job list was truncated, or you are looking at a later attempt. Paginate, and check `filter=all`. |

## Report

State the run, attempt and commit, which jobs failed, the failing step and the log line that shows the cause, whether it is a test, code or infrastructure failure, and whether a re-run is worthwhile. Do not say a run passed without the exit code or the job conclusions.
