---
name: ticket-management
domain: pr-workflow
description: MetaMask ticket conventions — never auto-assign, edit don't comment, priority distribution targets, consolidation methodology
---

# Ticket Management

## Never auto-assign
**Never assign yourself or anyone when creating tickets unless explicitly directed.** Leave `assignees` empty by default. Assignment implies commitment — let humans decide who owns work.

## Edit, don't comment
Don't add a comment explaining a change you made to the ticket itself ("updated the description…", "changed priority because…"). Edit the ticket directly; GitHub tracks edit history natively. Comments are for discussion.

## MetaMask labels
| Pattern | Meaning |
|---|---|
| `team-{name}` | Team assignment (e.g. `team-extension-platform`) |
| `Epic` | Issue is an epic (has sub-issues) |
| `area-*` | Area (e.g. `area-performance`) |
| `priority-critical` / `-high` / `-medium` | P0 / P1 / P2 |

## Priority distribution (target)
P0 10-15% · P1 40-50% · P2 30-40% · P3 5-10%. Everything marked P0/P1 = no prioritization.

## Consolidation (epic review)
Target ~20-40% ticket reduction. Merge when: **scope overlap** (same code in same PR), **sequential dependency** (always done together), or **trivial standalone** (few lines, not a separate module). Confirm: the smaller ticket's criteria fit the larger, no separate assignee/timeline, work is truly sequential.
