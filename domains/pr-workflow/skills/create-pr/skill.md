---
name: create-pr
description: >-
  Creates a GitHub pull request end to end: runs precondition checks,
  generates the PR description, identifies code owners, opens the PR, and
  offers to add it to the review queue. Use when the user asks to open,
  create, raise, or submit a PR, or says their branch is ready for review.
base: true
---

# Security checks when opening a pull request

Read the MetaMask Security Code Scanner result for the head commit before treating the pull request as ready. A failing or skipped scan blocks this change. Do not call it unrelated until the log shows the failure is outside the diff.

These are security incidents:

1. A CodeQL action version mismatch. If the log says a configuration was loaded for one `github/codeql-action` version while another version is running, every `github/codeql-action/*` step in that workflow must use the same major version. A v4 init with a v3 SARIF upload fails the scan before any finding is reported.
2. Workflow permissions. Do not set `security-events: write` on the workflow `permissions` block. That grant applies to every job and code scanning reports it as overly broad. Grant `security-events: write` only on the job that uploads SARIF. Leave the workflow default at `contents: read`.
3. New code-scanning findings. CodeQL, Semgrep, and zizmor can each be gated by severity. A finding on a line this pull request changes can block merge. A finding on a line this pull request does not change does not. Dismiss a reviewed false positive instead of leaving the check red.

If this pull request caused the failure, fix it before asking for review.
