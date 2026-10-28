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

If nothing starts, check that the workflow is enabled and that the trigger matches (branch filter, `github.event.created` for new refs only, path filters). A re-run is not a new run: it reuses `vars.*` values resolved at creation, so push a new commit to pick up a changed variable.

### Wait For The Result

```bash
gh run watch RUN_ID --repo OWNER/REPO --exit-status
```

The exit code is the verdict. Then read the jobs, because a green run can hide skipped jobs that mattered.

### List Jobs Without Losing Any

Large repositories run 100+ jobs per run. `gh run view --json jobs` truncates silently, so a failure count from it is wrong. Use the jobs endpoint and extract the array so the pages concatenate:

```bash
gh api --paginate "repos/OWNER/REPO/actions/runs/RUN_ID/jobs?per_page=100" \
  --jq '.jobs[] | {name, conclusion}'
```

Filter with `select(.conclusion == "failure")` for failures. `--paginate` on a JSON object response without `--jq` produces invalid concatenated JSON.

### Read Logs

```bash
gh run view RUN_ID --repo OWNER/REPO --log-failed
gh api repos/OWNER/REPO/actions/jobs/JOB_ID/logs     # one job, raw
```

Raw log lines carry a job and step prefix, a timestamp and ANSI color codes. Strip them before `grep`:

```bash
sed 's/^[^\t]*\t[^\t]*\t[0-9T:.-]*Z //; s/\x1b\[[0-9;]*m//g'
```

An `::error::` match is not proof of an error. A setup action's log can echo its own script source, which contains the string. Confirm with the step's conclusion.

## Behaviors That Mislead

| Looks like | Usually |
|---|---|
| A step silently did not run | It has an `if:` condition, which drops the implicit `success()` check. Add `!cancelled()` or `always()` when it must run after a failure. |
| A fix did not take effect | A `workflow_run` workflow runs the YAML on the default branch, not the pushed branch. |
| A secret is empty in a called workflow | `workflow_call` only passes secrets the caller lists and the callee declares. A direct dispatch reads repo secrets and hides this. |
| Fewer failures than expected | The job list was truncated. Paginate. |

## Report

State the run and commit, which jobs failed, the likely cause with the log line that shows it, and whether a re-run is worthwhile. Do not say a run passed without the exit code or the job conclusions.
