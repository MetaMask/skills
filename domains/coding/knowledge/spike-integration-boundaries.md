---
name: spike-integration-boundaries
domain: coding
description: Test the riskiest integration seam in isolation with a 10-line spike before building the full multi-system script.
---

# Spike Hard Integrations Before Committing

When building automation that combines 3+ systems or APIs, test the hardest integration point in isolation before writing the full script.

## Rule

Multi-system integrations fail at boundaries — not in any single system but at the seam between them. A 10-line spike that tests the hardest seam saves hours debugging a full script that can't work.

## Procedure

1. **Identify the single hardest unknown.** Ask: "Which integration point am I least confident about?"
2. **Write a 10-line throwaway test** for just that one thing.
3. **Run it.** If it fails, you've saved hours. If it passes, proceed.

## Cost Analysis

| | Skip spike | Do spike |
|---|---|---|
| Spike succeeds | N/A | +5 min |
| Spike fails | Hours debugging dead-end script | 5 min + pivot |
| Expected value | Negative (boundary failures are the norm) | Positive |

## Common Integration Unknowns

- Can API A connect to service B in this environment/process?
- Does state persist across the lifecycle event I'm relying on?
- Will the runtime I'm using support the protocol I'm assuming?

## Anti-Pattern

Building the full 400-line script first, then discovering the core integration is impossible — requiring full restart after multiple debug iterations across unrelated failure modes.
