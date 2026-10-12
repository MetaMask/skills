# Profile: technical-doc

For an ADR, RFC, tech spec, design doc, API or SDK documentation, runbook, or postmortem. The audience is usually engineers, but the unit of explanation is a **decision or a system**, not a diff.

## Signals

"ADR", "RFC", "design doc", "tech spec", "postmortem", "runbook", a docs or Confluence page that describes architecture, a README, or an API reference. If a PR implements the doc, treat the doc as primary (decision and why) and the PR as the evidence (code-change rules for any snippets).

## Ingest

- Read the whole doc before planning. Read its own summary or "Decision" section first, then context, options, consequences.
- Google Docs, Confluence, Notion, and Jira are readable through the user's connectors (Drive `read_file_content`, Atlassian `getConfluencePage` / `getJiraIssue`, Notion `notion-fetch`). For a repo doc use `gh api` or the file. If a source is too large for the context window, extract it to a scratch file, strip link noise, and read it in chunks. State what you read.
- Note status (draft, accepted, superseded), date, and owner. Docs go stale; say which version the video explains.
- Follow [../facts.md](../facts.md): benchmarks, limits, versions, dates, and system names go in the ledger with their section.

## What matters

| Rank | Material |
|---|---|
| Cover | The problem and constraints, options considered with the trade-off for each, the decision and its reason, consequences and migration or rollout, open risks |
| Mention | Background history, glossary, implementation detail already visible elsewhere |
| Skip | Boilerplate, link tables, revision logs, reference lists |

Order for understanding: problem → constraints → options → decision → consequences.

## Depth

- **Overview:** ~60–90 s, 3–5 scenes. Problem, the decision, why, what changes. No code.
- **Standard (default):** ~2–3 min, 4–7 scenes. Adds an options comparison and one architecture or sequence diagram; at most 2 snippets, only if the doc has them.
- **Deep dive:** ~4–5 min, 8–10 scenes. Adds each option's trade-offs, failure modes, migration steps, and open questions.

## Scenes

Decision matrix (options × criteria), before/after architecture, sequence or flow diagram, timeline of a migration, risk list. Code only when the doc contains it, trimmed to 10 lines, with its file path as the header.

## Voice

Explain *why this and not that*. Attribute choices to the doc: "the ADR chooses X because…". Do not add opinions the doc does not hold. Define each term on first use.

## Defaults

Script style: Natural. Theme: MetaMask Developer for MetaMask engineering docs; Motion Engineering for general systems; MetaMask for a mixed internal audience.

## Plan contents (in addition to the shared items)

Source stamp (title, owner, status, as-of date, how much you read), scene list mapped to doc sections, the facts ledger, a table of omitted sections and why, and any discrepancies with their proposed resolution.

## Verify after render

Every quoted number, limit, and system name matches the ledger. Run `scripts/verify_facts.py`.
