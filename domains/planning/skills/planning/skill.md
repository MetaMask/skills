---
name: planning
description: >-
  Use before the first edit in MetaMask Mobile, including when the user did
  not ask for a plan. Decide whether to proceed, write a scope brief, read
  Jira through mms-jira-brief, open installed mms-* domain skills, or
  recommend mms-planning-spec. A mechanical edit proceeds. Any other change
  stops until the engineer agrees.
base: true
maturity: stable
---

# Planning

Installed names: `mms-planning`, `mms-planning-spec`, `mms-jira-brief`. Domain skills use their installed `mms-*` names. This skill applies to MetaMask Mobile engineers. Other repositories are out of scope.

## Decision order

This is the first procedure. Follow it before the first edit. Do not embed a diagram of this procedure.

### 1. Classify

A change is mechanical when it cannot change behavior, a contract, or a risk surface. Formatting, comments, behavior-preserving renames, and copy typos that do not change what the product does are mechanical. Uncertainty means the change is not mechanical.

### 2. Jira

Apply these rules on the mechanical path and on the non-mechanical path.

A browse URL whose path contains `/browse/<KEY>` is a ticket. Do not ask. A bare token is a ticket only when Jira resolves it or the engineer confirms it. Tokens that are clearly not Jira issues are ignored without a question. `mms-jira-brief` owns that identification.

If a Jira issue is identified, follow `mms-jira-brief`. On standalone `mms-jira-brief` with no key, ask which ticket. When Jira cannot open a named key, write `.briefs/<KEY>.md` that records the key, the failure, and any ticket text the user already provided. Do not block.

If no ticket is identified, or a named ticket cannot be opened, say what was missing and add this line. It is not a question and does not wait:

`A Jira ticket would improve this context.`

Include that line on mechanical changes too. Omit it when a brief was actually read. A failure file is not a brief that was read.

### 3. Mechanical

Proceed. Do not show a brief. Do not ask for approval. Apply the Jira step, then edit. Do not load the installed `mms-*` catalog.

### 4. Non-mechanical

Stop before the first product edit. Apply the Jira step. Do not block on a missing ticket.

Read the installed `mms-*` catalog on every non-mechanical change, before the brief. Read every skill whose area the task touches. A partial or uncertain fit is read. Skip a skill only when the task has no surface for it. Prefer an installed skill over restating its guidance. The engineer does not have to name a skill.

Performance is an explicit check on every non-mechanical change. Read `mms-performance` before the brief when the task has any of these surfaces: screen, list, animation, polling, prefetch, realtime data, heavy image, blur, frequent update, large collection, startup path, account or network switch, selector, context provider, bundle, memory, battery, latency, or profiling. This list is a floor for that skill, not an allowlist of skills.

Minimum routing, also a floor and not an allowlist:

- Product-code test strategy reads `mms-mobile-testing`.
- Flag work reads `mms-feature-flags`.
- UI work reads `mms-ui-development`.
- Analytics work reads `mms-analytics`.
- Navigation work reads `mms-navigation`.
- User-facing copy reads `mms-content-guidelines`.

`mms-planning-spec` uses this same catalog rule for the spec it writes.

A matching skill that is unavailable is named in the brief. Do not pretend it was applied. Do not block only because it is missing.

Then brief scope and non-goals. Include performance, security, UX, and tests only when that area can change the work. Omit empty areas.

After the brief, recommend a spec when any of these is true. Say why in one line. Do not name `mms-planning-spec` in chat:

- New user-facing behavior.
- A security or privacy surface.
- A migration or feature flag.
- More than one screen or system.
- Scope and non-goals that do not fit in a few lines.

Wait for confirmation. A refusal returns to the brief and still waits for the question below. A confirmation reads and follows `mms-planning-spec` and does not edit product code in that turn.

If none of those is true, end the brief with this question and wait. No product edit happens before the answer:

`Do you agree, or do you want to discuss something in more detail?`

More detail returns to the brief. Agreement is the point where the edit may start.

## When to use

- Before the first edit on any MetaMask Mobile change, including when the user did not ask for a plan.
- When the work might be mechanical or might need a brief, Jira context, a domain skill, or a spec.

## Workflow

Follow Decision order, in that sequence. Do not measure skill adoption. Do not write to Jira. `.specs/` and `.briefs/` are local and not team-shared storage.
