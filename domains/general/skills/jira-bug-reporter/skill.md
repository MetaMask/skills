---
name: jira-bug-reporter
description: >-
  File or update bug reports for MetaMask Mobile or Extension. As of
  Nov 2026, all new bugs go to Jira via the Slack Bug Intake form or
  directly in the owning team's Jira project. Use when: raise a bug,
  create a bug, log a defect, file a ticket, report an issue, or
  describe unexpected app behavior; update, correct, clarify, or add
  context to an existing Jira bug.
maturity: stable
---

# MetaMask Bug Reporter

Routes bug reports for MetaMask Extension and Mobile to the right Jira
project. Covers both the fast path (Slack Bug Intake form) and direct
Jira filing, with severity guidance and project routing built in.

## When to use

- User says: raise/create/log/file a bug, report an issue, or describes
  unexpected MetaMask behaviour.
- User asks to update, correct, clarify, or add context to an existing Jira
  bug.

Out of scope: non-bug Jira tickets (use the appropriate product-specific
ticketing skill, such as `perps-write-ticket` or `perps-breakdown-tickets`).

## Prerequisites

- Access to MetaMask's Slack workspace (for the Bug Intake shortcut)
- Or: access to https://consensyssoftware.atlassian.net (for direct Jira)
- `getAccessibleAtlassianResources` when the Jira site `cloudId` is unknown
- Atlassian MCP primary tools (`getJiraIssue`, `searchJiraIssuesUsingJql`,
  `createJiraIssue`, `editJiraIssue`, `addOrEditJiraIssueComment`) and generic
  runners (`executeRead`, `executeWrite`) — optional, for automated filing and
  updates

When using Atlassian MCP tools, use the Jira site hostname or URL as
`cloudId`, or call `getAccessibleAtlassianResources` when it is unknown.
For `executeRead` and `executeWrite`, pass `cloudId` as a top-level argument
alongside `name` and `inputs`, never inside `inputs`.
For direct filing, always pass the project key selected by the routing table.

## Instructions

### Mode A — File a new bug (→ Jira)

#### Step 1: Collect required fields

If not already provided, ask for all missing fields in one message:

| Field | Notes |
|-------|-------|
| **Platform** | Extension / Mobile / Other |
| **What's broken** | One-line summary — becomes the ticket title |
| **Description** | Additional narrative about the problem |
| **Functional area** | e.g. Swaps/Bridge, Confirmations, Accounts, Networks |
| **Environment** | Production / RC / UAT |
| **Release / version** | e.g. v13.56.0 RC or v8.15.0 (7173); required for direct filing, and for RC/UAT Slack intake |
| **Impact** | What happens to the user (severity is derived from this) |
| **Steps to reproduce** | Numbered steps |
| **Expected result** | What should happen |
| **Actual result** | What actually happens |
| **Device & OS** | e.g. "iPhone 15, iOS 17" or "Chrome 150, macOS" |
| **Extra context** | (optional) recordings, Sentry links, Slack thread links |

#### Step 2: Route to the right Jira project

Apply these routing decisions in order:

1. Platform Other, cross-platform, or unresolved platform always routes to
   MBTB; stop routing.
2. Mobile Core UX routes to TMCU only when Platform is Mobile. An Extension
   report in that area routes to MBTB; stop routing.
3. Otherwise, match the functional area and platform to the table below.
When a table row includes a platform suffix, the separate Platform field is
authoritative: Extension routes to the Extension row and Mobile routes to the
Mobile row. If the area label and Platform field conflict or Platform is
unclear, route to MBTB.
Normalize free-text area labels before matching: Assets/Tokens/Balances maps
to ASSETS; Networks, Settings/General, and Accounts/Hardware wallets use the
platform-specific MWPE or MCWP row; Swaps or Bridge maps to SWAPS. Do not
route a clear area to MBTB only because the user used a shorter label such as
“Networks” or “Accounts”.

| Functional area | Jira project |
|-----------------|-------------|
| Swaps/Bridge | SWAPS |
| Confirmations | CONF |
| Assets / Tokens / Balances | ASSETS |
| Perps / Leverage trading | TAT |
| Prediction Markets | PRED |
| Mobile Core UX (Mobile) | TMCU |
| Networks — Extension | MWPE |
| Networks — Mobile | MCWP |
| Settings / General — Extension | MWPE |
| Settings / General — Mobile | MCWP |
| Accounts / Hardware wallets — Extension | MWPE |
| Accounts / Hardware wallets — Mobile | MCWP |
| Not sure / unmapped area | MBTB (Bug Triage — auto-routed) |

Use the platform when it affects routing: Mobile Core UX on Mobile goes to
TMCU; an Extension report described as Mobile Core UX, or a report with
Other, cross-platform, or ambiguous platform/area, goes to MBTB. Extension
network/settings/accounts issues go to MWPE, and Mobile network/settings/
accounts issues go to MCWP.

#### Step 3: File via Slack Bug Intake form (preferred)

Open the **Report a MetaMask bug** Slack workflow:
👉 https://slack.com/shortcuts/Ft0C4A8EASDP/9592519342daf2a6837226f4ed2cb228

Fields to fill in:
- **What's broken** — one-line summary
- **Functional area** — e.g. Swaps/Bridge, Confirmations, Accounts
- **Platform** — Extension / Mobile / Other
- **Environment** — Production / RC / UAT
- **Release** — the version where it was found (for RC/UAT)
- **Impact** — what happens to the user (severity is derived from this)
- **Steps / link** (optional) — repro steps, recordings, Sentry link

After submitting, a Slack message returns the Jira ticket link.

#### Step 4: Alternative — file directly in Jira

If the user asks for direct or automated Jira filing, skip the Slack form.
Otherwise, use the Slack form as the preferred path. When direct filing is
selected, create the Bug in the project routed in Step 2; the user does not
need to name the owning team.
Required fields:

- **Issue type**: Bug
- **Summary**: one-line title
- **Description**: steps, expected, actual, environment (see template below)
- **Severity**: derived from impact (see guidance)
- **Environment**: Production / RC / UAT
- **Found in**: the version/build where the bug was observed

**Impact** is also mandatory because severity is derived from it.
Severity, Environment, and Found in are mandatory for direct Jira filing.
Severity must be derived from the impact description; the reporter does not
need to choose it separately. For Slack intake, Release is required for RC/UAT
reports and optional for Production reports.

When creating through Atlassian MCP, first check for an existing duplicate
using `searchJiraIssuesUsingJql` when the report resembles an existing bug.
Scope the search to the routed board with a query equivalent to:
`project in ({projectKey}, MBTB) AND issuetype = Bug AND text ~ "{safe summary keywords}"`.
Build safe summary keywords from normalized alphanumeric tokens: remove
backslashes, quotes, `*`, and `?` before interpolating them. Never insert the
raw user title into the JQL string.
Join multiple remaining tokens with single spaces inside the quoted
`text` value.
If no keywords remain, omit the `text` clause and search the scoped projects
only after the user confirms a manual review is useful; do not treat an
arbitrary `maxResults: 10` slice as duplicate evidence. Ask for a descriptive
summary if needed, or proceed only after explicitly confirming that automatic
duplicate detection was skipped.
Pass the Jira `cloudId`, request the relevant issue fields, and cap the
results (for example, `maxResults: 10`) so the search is scoped to the
authenticated site and returns enough detail to compare likely matches.
If a likely duplicate is found, do not create another issue. Show the
existing issue link and ask whether to update it or add a comment.
Before passing custom fields, resolve the Bug issue type ID for the routed
project with `executeRead` using
`name: "listJiraProjectIssueTypesMetadata"` and
`inputs: { projectIdOrKey: projectKey }`. Then resolve the target Bug issue
type's field IDs and allowed values with `getJiraIssueTypeMetaWithFields`
through `executeRead`, using inputs equivalent to
`{ projectIdOrKey: projectKey, issueTypeId: bugIssueTypeId }`.
Use the returned IDs or accepted field names for Severity and Environment.
Resolve the Found in version string by discovering the Jira project
version/release read operation and calling it through `executeRead`. Pass the
returned version ID or Jira version object in `additional_fields` rather than
the raw display string.
If the version cannot be resolved, do not create an incomplete direct Jira
issue; ask for a valid version/build or use the Slack intake path, which
accepts the release value as entered.
After the duplicate check and all field/version resolutions succeed, call
`createJiraIssue` with:

- `cloudId`: the Jira site hostname, URL, or resolved site UUID
- `projectKey`: the key selected in Step 2
- `issueType`: `Bug`
- `summary`: the one-line title
- `description`: the Markdown Jira description template below
- `additional_fields`: the resolved project-specific Severity, Environment,
  and Found in fields

`createJiraIssue` is the preferred primary tool for creation. Use
`discover` followed by `executeRead` for metadata and version lookups and
`discover` followed by `executeWrite` for a write operation that is not
available as a primary tool. If MCP tools are unavailable, direct the user
to: https://consensyssoftware.atlassian.net

#### Severity guidance (Jira field — not a label)

| Severity | When to use |
|----------|-------------|
| **Sev1 - Critical** | Complete feature broken, data loss, security issue, release blocker |
| **Sev2 - Normal** | Major feature degraded, significant UX impact, regression |
| **Sev3 - Low** | Minor visual/UX issue, edge case, cosmetic defect |

Severity is derived from the impact description — the user does not need
to pick it themselves. The labels in this table are guidance only; when
creating or updating Jira, use the exact allowed Severity value returned by
the target project's field metadata.

#### Jira description template

```
## Description
{description}

- **Steps to Reproduce**
{numbered steps}

- **Expected Result**
{expected_result}

- **Actual Result**
{actual_result}

- **Environment**
  - Platform: {Extension / Mobile}
  - Version: {version}
  - Build type: {Production / RC / UAT}
  - OS: {operating system}
  - Browser: {browser and version — Extension only}
  - Hardware wallet: {device name, or None}

- **Additional context**
{any extra context, Sentry links, Slack thread links, recordings}
```

---

### Mode B — Update an existing Jira bug

Use when the user provides a Jira issue key or link and wants to correct,
clarify, or supplement an existing bug.

1. Identify the Jira issue key or URL and fetch the current issue details with
   `getJiraIssue`, passing `cloudId` and `issueIdOrKey`. Request editable
   fields when preparing a field update.
2. Confirm which fields should change before editing the issue. For severity
   or other triage-field changes, confirm the user’s intended impact and
   verify the target project’s available fields before writing.
3. For description changes, only merge and rewrite a plain Markdown body
   returned by `getJiraIssue`, sending it with `contentFormat: markdown`
   through `editJiraIssue` in a `fields` object, for example
   `{ cloudId, issueIdOrKey, fields: { description: mergedBody },
   contentFormat: markdown }`. If the returned body is HTML, ADF, or another
   rich/unrecognized format, do not rewrite the description; add the requested
   context as a comment or ask the user to confirm a replacement.
   Do not replace the description with a partial snippet. Preserve existing
   reproduction details unless the user explicitly asks to replace them.
4. For non-description field changes, update with `editJiraIssue`, passing
   `cloudId`, `issueIdOrKey`, and a `fields` object containing the complete
   intended field values. `additional_fields` is the create-tool convention;
   do not use it for `editJiraIssue`. Use field names or IDs returned by the
   issue metadata.
5. For a comment-only update, pass the same `cloudId` and `issueIdOrKey` to
   `addOrEditJiraIssueComment`.
6. Confirm the updated Jira issue link and summarize the changes.

Fields that may be updated include Summary, Description, Severity, Environment,
and Found in. When updating Found in, resolve the version string through the
project's release/version lookup and pass the returned Jira version ID or
version object rather than the raw display string. If the requested update is
not supported by a primary Atlassian tool, use the Atlassian `discover`
operation to identify the correct write operation, then call it through
`executeWrite`.

---

## Examples

### Example 1: Filing an RC bug via Slack

```
User: "Create a bug on Extension 13.40.0 RC — bridging mUSD on Linea
to POL, the destination tx explorer link is missing when using Lattice1."

Agent: I'll file this via the Slack Bug Intake form. Here are the details
I'll submit:
- What's broken: Bridge destination tx explorer link missing (Linea→POL, Lattice1)
- Functional area: Swaps/Bridge
- Platform: Extension
- Environment: RC — v13.40.0
- Impact: Transaction confirmation incomplete; user cannot verify destination tx
- Steps: 1) Connect Lattice1 2) Bridge mUSD Linea→POL 3) Approve tx 4) Check tx details
  → no explorer link shown for destination chain

Please open: https://slack.com/shortcuts/Ft0C4A8EASDP/9592519342daf2a6837226f4ed2cb228
and fill in the fields above. The form will send you the Jira link.
```

### Example 2: Routing an ambiguous bug

```
User: "Mobile bug — wrong balance shown after importing SRP"

Agent: That sounds like an Assets/Balances issue on Mobile → I'll route
it to the ASSETS project. Can you confirm:
- Version/build: ?
- Steps to reproduce: ?
- Expected vs actual balance: ?
```

## Troubleshooting

### Unsure which Jira project

**Problem:** Functional area doesn't map cleanly to a project.

**Solution:** Route to **MBTB** (MetaMask Bug Triage Board). The triage
team will re-route it to the right project within one business day.

### Slack shortcut not loading

**Problem:** The Bug Intake Slack shortcut returns an error.

**Solution:** File directly in Jira at https://consensyssoftware.atlassian.net
using the routing table in Step 2.

## Security considerations

- No credentials are required for the Slack Bug Intake form.
- For direct Jira filing via MCP tools, the session needs an active
  Atlassian connector with Jira write permissions.
- Do not include customer PII, internal credentials, or secrets in bug
  descriptions.
