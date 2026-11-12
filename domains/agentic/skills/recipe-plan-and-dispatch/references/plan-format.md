# Plan format

A cheaper model follows this plan as written. Make it short and exact, so nothing is left to interpret.

## Rules

- About 30 lines. If it needs more, the ticket needs splitting.
- Use the sections below, as bullets. No introduction, summary or closing.
- Name files and symbols as `path:line` or `path` plus symbol.
- Do not restate the ticket. Each criterion takes one line: the criterion, then its proof.
- One decision per bullet. Mention a rejected alternative only when the worker would otherwise pick it, in one line.
- No hedging: drop "consider", "might", "ensure", "robust", "as needed", "if appropriate".
- Risks only when concrete and checkable.
- Reuse existing helpers and controller logic; name them. Never plan a local copy of shared logic.

## Template

```markdown
# <ticket> · <fix-bug|dev>
Approved by <engineer> · planned with <model> · <date>

## Criteria and proof
- AC1 <criterion> → <recipe assertion, state read or screenshot pair>

## Root cause | Current behavior
- `<path:line>` <what happens and why>

## Change
- `<path>` <symbol>: <what changes>
- Files: `<path>`, `<path>`

## Tests
- `<test path>`: <case>

## Risks
- <concrete risk and how the run checks it>

## Out of scope
- <what the worker must not change>
```

Use `Root cause` for fix-bug and `Current behavior` for dev.
