---
name: inline-comment-policy
domain: pr-workflow
description: Inline code comments are targeted documentation for future contributors, not line-by-line narration of what changed
---

# Inline Comment Policy

Code comments are documentation for future contributors, not play-by-plays of a diff.

## Leave out
- One-liners restating what the code obviously does (`// Moved to X`, `// Renamed from Y`)
- Narration of changes visible from the diff or commit message

## Belongs
- TODOs for planned follow-ups with enough context to act on
- Comments clarifying motivation, architectural background, or constraints not apparent from the code
- Context that would otherwise require archaeology (why a workaround exists, what invariant a block depends on)

## For reviewer clarity
Use the PR description / commit body / review threads first. Inline comments persist after merge — they must earn their place as documentation, not serve as transient review aids.
