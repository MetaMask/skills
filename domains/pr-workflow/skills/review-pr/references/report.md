# Report

Return one report that guides a human reviewer. A `BLOCKED` report stops before claim checks. A report with an exact diff uses every section below and states `Source coverage: complete` or `Source coverage: DEGRADED`.

## BLOCKED

```text
review-pr status: BLOCKED
missing: <repository | exact diff | scripted operation capability>
attempted: <checked-in script or read-only tool>
recovery: <the checked-in script or skill capability required>
```

Do not add findings, specialist results, or a review conclusion.

## Reports with an exact diff

Print the frozen target block from [providers.md](providers.md) first. Then use these sections, in order:

1. **Target and frozen scope.** Repository, provider, base SHA, head SHA, working-tree inclusion, and `Source coverage: complete` or `Source coverage: DEGRADED`.
2. **Data availability and coverage.** One line per source: local diff, repository files, pull request title and body, linked issue context, checks, and existing review comments. Each line is `available`, `unavailable`, or `failed`, plus the command or tool that established it.
3. **TL;DR.** In two to four concise bullets, synthesize the available pull request description, frozen code changes, comments within changed code, existing review comments, and linked issue context. State the intended outcome, implementation approach, and reviewer-relevant constraints or dependencies. Use original agent wording from the reviewer-assistance perspective. Rephrase the source material and mark material source gaps as unread.
4. **Author evidence.** For each item below, use `provided`, `needs author evidence`, or `unread`, followed by the source:
   - manual testing;
   - screenshots or recordings;
   - changelog;
   - linked issue;
   - pull request template coverage;
   - check rollup;
   - repository readiness guidance.
   These are preparation and validation inputs. Keep them separate from peer-review findings and severity.
5. **Routing decisions.** Give each selected or considered skill its own block in this format:
   ```text
   skill: <installed skill name>
   class: preference | capability
   matching paths: <paths or none>
   semantic signal: <signal or none>
   required inputs: <inputs>
   result: applied | skipped — <reason>
   ```
   Use an independent block for every skipped skill so each class, path match, signal, input set, and reason remains attributable to one skill.
6. **Guided claim checks.** Start with the high-impact claims selected from [reasoning.md](reasoning.md). Use the finding record below for every new concern. Then list **Claims examined** with their evidence boundaries and **Open questions** whose evidence remains unread.
7. **Existing comments as references.** Cite comment ids or URLs, state whether each point remains present at the frozen head, and use it for deduplication. Existing comments stay outside the new-finding count and severity.
8. **Review coverage and conclusion.** Name the claims examined, important claims left open, and the completed checks. For `Source coverage: DEGRADED`, name the guidance affected by each unread source. Describe author preparation as: `Readiness evidence reviewed; open author evidence is listed above.` Reserve approval for the human reviewer.
9. **Comments to add.** Paste-ready GitHub comments for new findings plus an author-evidence follow-up when useful. Write this section in the same response as the report.

## Finding record

Give each new finding a stable `<SEVERITY>-<n>` id. `SEVERITY` is `HIGH`, `MEDIUM`, or `LOW`. `n` is the finding's order in one report-wide sequence starting at 1 across all severities. For example, a low-severity first finding followed by a high-severity second finding uses `LOW-1` and `HIGH-2`.

```text
HIGH-1 — <short subject>
severity: HIGH | MEDIUM | LOW
claim: <behavior or safety claim>
risk checked: <specific counterexample or failure condition>
evidence type: diff | check-rollup | visual | runtime | unread
evidence: <diff hunk, path:line, repository rule, specialist result, or command output>
evidence boundary: <what this establishes and what remains open>
reviewer guidance: <request a change, ask a question, or inspect a named path>
```

Severity describes impact if the concern is confirmed:

| Severity | Conventional comment | Use for |
| --- | --- | --- |
| `HIGH` | `issue (blocking)` | A demonstrated defect with material impact that requires a change before merge |
| `MEDIUM` | `suggestion (non-blocking)` | A demonstrated concern with a concrete improvement |
| `LOW` | `nitpick (non-blocking)` | Wording, a comment, or a small consistency fix |

Template coverage and author-evidence gaps keep their preparation status instead of finding severity.

## Comments to add

One summary goes in the pull request review body:

```text
Review scope: <highest-impact claims and evidence examined>.
Author evidence: <provided items and requested follow-ups>.
New findings: <count by severity, with ids>.
Reviewer guidance: <highest-value next step and important open evidence>.
```

Then one inline comment per new finding:

- Finding: `<SEVERITY>-<n>`.
- Where: `<path>` line `<n>` on the frozen head.
- Severity: `HIGH`, `MEDIUM`, or `LOW`.
- Paste this text on that line:

```text
<issue|suggestion|nitpick|question> (<blocking|non-blocking>): <subject>

<Why this matters, grounded in the cited evidence.>

<Exact requested change: what to add, remove, replace, or verify.>
```

When the fix is a short replacement, add a GitHub suggestion block with the replacement text. Link an existing comment when it already requests the same change.

Author-evidence follow-ups belong in the review body:

```text
Author evidence follow-up: <specific template, validation, screenshot, linked-issue, or check evidence requested>.
```

## Citations and unknown data

An unread check stays `unknown`. Tests are called successful only when the named check or command output supports that conclusion. Existing comments classified `available` are cited as references.

Do not add a numeric review score.

## Later outcome assessment

Use this section only when the user asks to assess a previous `review-pr` report. Freeze the prior report's repository, base SHA, and head SHA. Read later evidence such as an author reply, follow-up commit, resolved conversation, or later defect tied to that frozen diff.

Classify every finding:

| Outcome | Meaning |
| --- | --- |
| `confirmed` | Later evidence supports the concern |
| `rejected` | Later evidence shows the concern was unfounded |
| `unresolved` | Available later evidence has not settled it |
| `missed` | A later defect in the frozen diff was outside the report's findings |

Print one row per finding with its original `<SEVERITY>-<n>` id, outcome, and evidence. A `missed` count requires a defined later defect inventory supplied by an adjudicator, incident review, accepted follow-up fix, or equivalent evidence. When that inventory is unavailable, use `missed: unknown` and `recall: unknown`; never infer zero misses from the assessed findings.

Then print:

```text
confirmed: <count>
rejected: <count>
unresolved: <count>
missed: <count>
precision: confirmed / (confirmed + rejected)
recall: confirmed / (confirmed + missed)
```

Calculate precision when its denominator is greater than zero. Calculate recall when the missed-defect inventory is defined and its denominator is greater than zero. Exclude unresolved findings from both formulas. Return the assessment in the conversation. Persist a ledger row only after the user explicitly requests a destination outside the reviewed checkout.

## Publishing

The conversation report is the review. Posting a GitHub comment or review requires a later explicit approval. Until that approval, do not call `gh pr comment`, `gh pr review`, or a GitHub MCP write tool.
