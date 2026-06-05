---
name: diagnose-blockers
domain: general
description: When blocked, diagnose before acting. Stop, investigate, report findings with evidence, present options, then wait for approval before any destructive or scope-reducing action.
---

# Diagnose Before Acting

When encountering a blocker, risk signal, or unexpected failure, the correct response is to diagnose — not to revert, reduce scope, or create workarounds.

## Protocol

1. **Stop.** Do not change anything yet.
2. **Diagnose.** What is actually failing or risky, and why?
3. **Report.** State the finding with evidence (logs, lockfile analysis, API docs, etc.).
4. **Present options.** Fix it / add safeguards / skip with stated tradeoffs / revert.
5. **Wait.** Get explicit approval before any spec modification, scope reduction, or destructive action.

## Prohibited First Responses

| Signal | Wrong | Right |
|--------|-------|-------|
| "This is untested" | Revert to safe version | Assess what would actually break, report finding |
| "This might not work" | Create simplified alternative | Investigate actual compatibility, report |
| "Tests are failing" | Weaken assertions | Diagnose root cause, present options |
| "Dependency conflict" | Remove the dependency | Analyze dependency trees, check isolation |
| Risk flagged by user | Undo the risky work | Investigate the risk, quantify it |

## Key Distinction

**"Untested" ≠ "broken."** An untested dependency or path is a risk to assess, not a trigger to revert. The investigation may reveal the risk is negligible (isolated dependency trees, separate processes) or real (shared runtime, incompatible APIs). Either finding is useful. Reverting without investigating wastes work and obscures the actual risk.

## Destructive Actions Requiring Confirmation

Before any of these, stop and get explicit approval:

- Reverting a file to a previous state
- Deleting code or files
- Reducing scope of an implementation
- Adding skip/ignore flags
- Replacing an implementation with a "simpler" alternative

## Evidence Standards

A finding report must include:
- What was checked (commands run, files read, docs consulted)
- What was found (specific versions, error messages, dependency relationships)
- Confidence level (confirmed vs suspected)
- What remains unknown

## Red Flags to Self-Monitor

- "Let me revert this to be safe" — without diagnosing what's unsafe
- "Let me try a simpler approach" — after the specified approach hit a snag
- Creating new files when existing ones don't work
- Reporting "success" after silently excluding the hard parts
- Any destructive action taken without explicit user approval
