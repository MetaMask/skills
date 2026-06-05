---
name: epic-hierarchy
domain: pr-workflow
description: GitHub sub-issues are a structural relationship via the API, not parsed from body text — always create the link explicitly
---

# GitHub Epic Hierarchy

Parent-child epic relationships are structural (GitHub sub-issues API), not body text. A `**Parent Epic:**` reference in the body is documentation only — the link won't exist without the API call.

## Pattern
Always both steps:
1. Create the issue (body may reference the parent)
2. Establish the sub-issue link via the API (sub-issues endpoint) using the new issue ID

Without step 2 the epic is orphaned — invisible in the parent's sub-issue list.

## Also
If the parent epic has a manual sub-epics table in its body, update it to include the new child.
