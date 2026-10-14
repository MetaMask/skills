---
name: planning-spec
description: >-
  Use after mms-planning recommends a spec and the engineer confirms, and
  when the user asks for a planning spec. Ask one product or engineering
  question at a time, then write one English file at
  .specs/spec-XXX-short-description.md in the MetaMask Mobile checkout. Do
  not implement the planned change and do not write a -pt.md sibling.
base: true
maturity: stable
---

# Planning spec

Installed name: `mms-planning-spec`. Use it only after `mms-planning` recommends a spec and the engineer confirms, or when the engineer asks for a planning spec. Do not implement the planned change. Do not edit product code in the turn that writes the file.

## When to use

- The engineer confirmed a spec recommendation from `mms-planning`.
- The engineer asked for a planning spec.

## Workflow

1. Ask one question at a time. Cover product unknowns and engineering unknowns. Product includes who is affected, what they see, scope, and non-goals. Engineering includes where the change lives, compatibility, and how it will be tested.
2. Stop asking when each unknown is decided, explicitly deferred, or recorded as an open question. State the direction.
3. When the direction is ready, state it and wait. Write the file only after the engineer approves. If they do not approve, ask the next question.
4. After approval, and before writing, use the same catalog rule as `mms-planning`. Read the installed `mms-*` catalog. Read every skill whose area the spec touches, including a partial fit. Skip a skill only when the spec has no surface for it. Run an explicit performance check. Read `mms-performance` when the change has a performance surface. The named routing list in `mms-planning` is a floor, not an allowlist. Name a matching skill that is unavailable. Do not pretend it was applied.
5. Write one English file at `.specs/spec-XXX-short-description.md` in the checkout. Do not write a `-pt.md` sibling. `.specs/` is local and not team-shared storage. Sharing the file is a manual step outside this skill.

Numbering is the highest existing `.specs/spec-*.md` plus one. If none exist, start at `001`. The slug is two to five kebab-case words. The H1 is `# spec-XXX: <short name>`.

Section order:

1. Summary
2. Copy Prompt for Implementation
3. Context
4. Hypothesis
5. Decisions
6. Implementation Details
7. `## Development Flow`
8. `## Performance`
9. `## Security`
10. `## UX`
11. Open Questions
12. Acceptance Criteria
13. `## How to Test`, with `### Agent`, `### Human — Android`, `### Human — iOS`, and `### Optional`
14. Log

Keep every heading. When Performance, Security, or UX has no surface, the body of that section is `N/A`. The chat brief from `mms-planning` still omits empty areas. This file does not.

`## Development Flow` is one Mermaid diagram of the change being specified: sequence, decisions, loops, and any path that does not reach implementation. The diagram describes that feature. It does not describe `mms-planning`, `mms-planning-spec`, or `mms-jira-brief`. If the diagram disagrees with Decisions or Implementation Details, the prose wins and the diagram is corrected before approval. Do not embed a diagram of this skill's own procedure.

UX states who is affected and what they see. Include empty, error, and loading states when the change has them. State iOS versus Android when they differ.

Copy Prompt for Implementation is one or more fenced `text` blocks. Labels, in order, omitting an empty optional label: `LOCK`, optional `BASELINE`, `CHANGE`, `VERIFY`, `CLOSEOUT`, `HARD STOPS`, `IF STUCK`. `LOCK` points at the `.specs/` file inside the checkout. `IF STUCK` is exactly `Ask any questions needed if anything ambiguous.`

After the file is written, stop. Do not implement the planned change.
