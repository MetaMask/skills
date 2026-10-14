---
name: jira-brief
description: >-
  Use when an issue key or browse URL is present, when mms-planning calls
  it, and when the user wants to understand a Jira ticket. Write
  .briefs/<ISSUE-KEY>.md with the Goal, Decisions Already Made, Open
  Decisions, and Code Surfaces sections. Name the path in chat. Do not paste the
  file, implement the change, or write to Jira.
base: true
maturity: stable
---

# Jira brief

Installed name: `mms-jira-brief`. `mms-planning` calls it when a ticket is available. The engineer can invoke it directly. Do not implement. Do not write to Jira. Do not embed a Mermaid diagram of this procedure, and do not put one in `.briefs/`.

## When to use

- An issue key or a Jira browse URL is present.
- `mms-planning` calls this skill.
- The user wants to understand a Jira ticket.

## Workflow

1. If there is no browse URL and no key, ask which ticket. On standalone `mms-jira-brief` with no key, that question is required. Then continue with the answer.
2. A browse URL whose path contains `/browse/<KEY>` is a ticket. Do not ask.
3. A bare `<PROJECT>-<number>` token is not a ticket from the pattern alone. `MCWP` is the mobile platform project, not the only valid project. There is no project allowlist.
4. Ignore tokens that are clearly not Jira issues, without a question. Examples: `EIP-7702`, `CAIP-19`, and `HIP-3`.
5. A bare token is a ticket when Jira resolves it, or when the engineer confirms it. When no URL is present and a token might be a Jira issue but Jira does not resolve it, or the lookup is inconclusive, infer from surrounding words such as ticket, Jira, or issue. If still unsure, ask whether that token is a Jira issue. Yes continues the brief flow. No treats it as not a ticket.
6. Not a ticket: stop. Do not write a file.
7. Each resolved key produces one `.briefs/<ISSUE-KEY>.md`. Several keys produce one file each. `.briefs/` is local and not team-shared storage.
8. If `.briefs/<ISSUE-KEY>.md` already exists and the engineer did not ask to regenerate it, read that file. Do not regenerate it.
9. Otherwise open the issue in Jira. If it opens, write the file with these headings, in this order: `## Goal`, `## Decisions Already Made`, `## Open Decisions`, `## Code Surfaces`. If it does not open, do not block. Write `.briefs/<KEY>.md` that records the key, the failure, and any ticket text the user already provided. Say what was missing.
10. Do not copy secrets, tokens, credentials, or customer data into the file.
11. In chat, name the path. Do not paste the file. Do not implement. Do not write to Jira.

`A Jira ticket would improve this context.` belongs to `mms-planning` when no brief was actually read. This skill does not add that line after a brief was read.
