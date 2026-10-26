---
name: planning
description: >-
  Use before the first edit in MetaMask Mobile, including when the user did
  not ask for a plan. Decide whether to proceed, write a scope brief, read
  Jira through mms-jira-brief, open installed mms-* domain skills, or
  recommend mms-planning-spec. A mechanical edit, an unkept spike or POC,
  and CI-only work proceed. A revert of a merged pull request or commit
  states the target and files, then one yes or no. A spec is only for a new
  design, a contract or API change, or multi-surface work. Any other change
  stops until the engineer agrees.
base: true
maturity: stable
---

# Planning

This skill installs as `mms-planning`. Related skills are `mms-planning-spec` and `mms-jira-brief`. Domain skills use their installed `mms-*` names. This skill applies to MetaMask Mobile engineers. Other repositories are out of scope.

## Decision order

This is the first procedure. Follow it before the first edit. Do not embed a diagram of this procedure.

### 1. Classify

A change proceeds without a brief when any of these is true:

- It is mechanical. A change is mechanical when it cannot change behavior, a contract, or a risk surface. Formatting, comments, behavior-preserving renames, and copy typos that do not change what the product does are mechanical.
- The engineer will not keep the result. That is a throwaway, exploratory, or disposable spike or POC. A spike or POC the engineer will merge does not proceed without a brief. A spike or POC that touches security or privacy does not proceed without a brief.
- It is CI-only: coverage, Jest flags, Sonar, or a workflow edit that does not change how jobs or E2E launch. A CI change that changes how jobs or E2E launch does not proceed without a brief.

Uncertainty about whether the result will be kept, or whether a workflow changes launch, means the change does not proceed without a brief. Uncertainty about behavior, a contract, or a risk surface means the change is not mechanical.

A revert of a merged pull request or commit does not use steps 2, 3, or 4. Scope is that original change. State the revert target and the files in one line. When it touches security or privacy, name that risk in one yes/no question and wait. Otherwise end with one yes/no and wait. Do not offer a menu. Do not write a brief, do not recommend a spec, and do not read the catalog. On yes, edit. Security or privacy means auth, secrets, logs or exports of state, permissions, or keyring or vault.

### 2. Jira

Apply this step on every path except a revert.

Follow `mms-jira-brief` for ticket identification and the brief. That skill owns URL, bare-key, and non-Jira-token identification.

When no brief was actually read, say what was missing. A failure file is not a brief that was read.

Add this line only when no brief was actually read and the change stops for a brief. It is not a question and does not wait:

`A Jira ticket would improve this context.`

Omit that line when a brief was actually read, when the change proceeds without a brief, or when the change is a revert.

### 3. Proceed without a brief

A revert does not use this step. Proceed. Do not show a brief. Do not ask for approval. Do not recommend a spec. Apply the Jira step. Run Checks, then edit. Do not load the installed `mms-*` catalog.

### 4. Stop for a brief

A revert does not use this step. Stop before the first product edit. Apply the Jira step. Do not block on a missing ticket.

Read the installed `mms-*` catalog on every change that stops for a brief, before the brief. Read every skill whose area the task touches. A partial or uncertain fit is read. Skip a skill only when the task has no surface for it. Prefer an installed skill over restating its guidance. The engineer does not have to name a skill.

Performance is an explicit check on every change that stops for a brief. Read `mms-performance` before the brief when the task has any of these surfaces: screen, list, animation, polling, prefetch, realtime data, heavy image, blur, frequent update, large collection, startup path, account or network switch, selector, context provider, bundle, memory, battery, latency, or profiling. This list is a floor for that skill, not an allowlist of skills.

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

Run Checks. Then recommend a spec only for a new design, a contract or API change, or multi-surface work. Say why in one line. Do not name `mms-planning-spec` in chat. Do not recommend a spec for a single-file change or a fully specified ask.

A fully specified ask names the target and the action. When the ask is fully specified, do not recommend a spec. End with one yes/no and wait. Do not offer a menu, and do not use either question below.

When a spec was recommended, do not end on the recommendation alone. Write the brief in the chat output, then end that same output with this question and wait. Do not use a structured choice prompt or a bottom sheet.

`Do you want me to continue with a planning spec, continue from this brief, or discuss something in more detail?`

Continuing with a planning spec reads and follows `mms-planning-spec` and does not edit product code in that turn. Continuing from the brief is agreement and the edit may start. More detail returns to the brief and asks this question again.

When a spec was not recommended, and the ask is not fully specified, write the brief in the chat output, then end that same output with this question and wait. Do not use a structured choice prompt or a bottom sheet. No product edit happens before the answer:

`Do you agree, or do you want to discuss something in more detail?`

More detail returns to the brief. Agreement is the point where the edit may start.

## Checks

Run these before an edit that proceeds without a brief, before a spec recommendation, and before the agreement question. Every item that applies is required. A miss goes back to that step. Do not continue with it open.

- Classification says whether the change proceeds without a brief, is a revert, or stops for a brief.
- A revert states the target and the files in one line and ends with one yes/no. A security or privacy revert names the risk in that question. There is no brief, spec, catalog, menu, or Jira line.
- The Jira step is done except on a revert. The Jira line is present only when that step requires it.
- A spec is recommended only for a new design, a contract or API change, or multi-surface work, and not for a single-file change or a fully specified ask.
- A fully specified ask that stops for a brief ends with one yes/no.
- When the change stops for a brief, the catalog was read, each matching skill was read or named missing, and the performance check ran.
- When the change stops for a brief, the brief states scope and non-goals. Performance, security, UX, and tests are present only when that area can change the work.

## When to use

- Before the first edit on any MetaMask Mobile change, including when the user did not ask for a plan.
- When the work might be mechanical, a revert, or might need a brief, Jira context, a domain skill, or a spec.

## Workflow

Follow Decision order, in that sequence. Run Checks at the points it names. Do not measure skill adoption. Do not write to Jira. `.specs/` and `.briefs/` are local and not team-shared storage. Do not stage them.
