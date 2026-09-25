---
name: review-pr
description: >-
  Run an evidence-guided MetaMask pull request review or self-review in one
  read-only static pass. Use when asked to review a PR, review my branch,
  assess review findings, or review a peer pull request URL or number.
  Separate author evidence from peer guidance, route installed specialist
  skills, and preserve the human review decision.
maturity: stable
base: true
---

# Review a pull request

One read-only, evidence-guided review of the current checkout or an existing pull request. The review helps a peer examine important claims, evidence limits, and concrete next steps. The human reviewer owns the approval decision.

This skill selects installed specialist skills and aggregates their results. Each specialist remains the source of truth for its rules.

## When to use

- Review the current branch or working tree before opening a pull request.
- Review a peer pull request by URL or number.
- Ask which checks ran, which were skipped, and which sources could not be read.
- Assess the later outcome of findings from an earlier `review-pr` report.

## Workflow

1. **Resolve the target.** A pull request URL or number is a peer review. "This branch", "my changes", or no target is a self-review of the current checkout. Read [references/providers.md](references/providers.md) and [references/operations.md](references/operations.md), then run the matching checked-in preflight script.
2. **Freeze the target before reviewing.** Resolve the repository, provider, base SHA, head SHA, and working-tree inclusion. The report returns this frozen target once as its first section, followed by every source as `available`, `unavailable`, or `failed`.
3. **Stop when the target is blocked.** A missing repository identity or an empty diff returns the `BLOCKED` report from [references/report.md](references/report.md). Do not open specialist skills and do not write findings.
4. **Separate author evidence.** Report pull request template coverage, manual testing, screenshots, linked issue, changelog, checks, and repository readiness guidance under **Author evidence**. These inputs describe preparation and validation; they do not become code findings or an approval.
5. **Map and rank claims.** Open [references/reasoning.md](references/reasoning.md). Extract explicit and implicit claims, rank them, and choose concrete risks or counterexamples to examine.
6. **Route the diff.** Open [references/routing.md](references/routing.md) and the repository overlay. Classify each selected skill as a repository `preference` or domain `capability`. Invoke it only when installed and its required inputs are `available`. Record paths, semantic signal, inputs, and the skip or apply result.
7. **Run one guided static pass.** Read the frozen diff and cited files. For each substantive observation, record the claim, risk checked, evidence, evidence boundary, severity, and reviewer guidance. Keep existing comments as references.
8. **Aggregate.** Copy specialist results with their source into the stable sections in [references/report.md](references/report.md). Include GitHub-ready comments with exact requested changes.
9. **Ask before publishing.** Return the report in the conversation. The comments section is the text to post. Posting it to GitHub waits for explicit approval in this conversation.

When the user asks to assess an earlier report, follow **Later outcome assessment** in [references/report.md](references/report.md). Use later evidence to classify findings and calculate correctness metrics.

## Require

- Print the frozen target before the first specialist skill or finding.
- Run every terminal operation as one invocation of a documented script under this skill's `scripts/` directory. Native file reads, native searches, and read-only MCP tools remain available.
- Use `check-worktree.mjs` for checkout status. When terminal invocations are reported, every ledger entry names a checked-in script.
- Return `BLOCKED` with the missing scripted capability when the operation registry does not cover required terminal evidence.
- Classify the local diff, repository files, pull request title and body, linked issue context, checks, and existing review comments.
- Treat linked issue context as available when a GitHub issue or a Jira issue was read. Either one is enough.
- For a peer review, review the exact `gh pr diff` between the frozen pull request base and head. Read cited files at that head SHA.
- For a peer review through `gh`, run the checked-in `scripts/collect-pr-context.mjs` collector so data collection and parsing use one reviewed command.
- Include a two-to-four-bullet TL;DR in original agent wording, synthesized from the available pull request description, frozen diff, comments within changed code, existing review comments, and linked issue context.
- Keep author evidence separate from peer-review findings and severity.
- Follow the fixed reasoning flow before routing specialist skills.
- Record every routing decision in a separate per-skill block with skill class, paths, semantic signal, required inputs, and result.
- Cite a diff hunk, file and line, repository rule, specialist result, or command output for every finding.
- Cite existing review comments as references. Do not report those comments as blockers.
- When the diff is tooling, CI, build, or documentation and not application code, apply matching repository preferences and domain capabilities, and review the tests for that tooling.
- Keep an unread source unknown. Say that the source was unavailable or failed.
- State what the evidence establishes and what remains open.
- Limit the conclusion to the claims and checks examined.
- In an outcome assessment, report zero misses and recall only when later evidence defines the defect inventory.
- Ask before posting a GitHub review comment.
- Include paste-ready comments: one review summary and one inline comment per new finding. Each comment states the severity, rationale, and exact requested change.

## Reject

- Editing, committing, pushing, or otherwise changing the reviewed checkout.
- A global review score.
- A finding with no citation.
- Treating an unread check, test, comment, or pull request body as passed, unique, or ready.
- Treating author validation evidence or green checks as a peer-review approval.
- Treating a quiet review as evidence that the pull request is correct.
- Inferring zero missed defects from the findings that were assessed.
- Publishing to GitHub before explicit approval.
- Replacing a specialist skill's rule with a summary written from memory.
- Reviewing the local checkout diff in place of the pull request branch diff.
- Applying app test-layer, screen, or component skills to a script-only diff.
- A paste-ready comment that does not state the change to make.
