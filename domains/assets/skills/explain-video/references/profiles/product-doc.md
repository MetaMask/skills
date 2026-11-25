# Profile: product-doc

For a PRD, one-pager, strategy or vision doc, roadmap, research readout, project brief, Jira epic, Confluence page, or a Google Doc a PM, EM, designer, or leader wrote. The video explains **what is being proposed or decided, why, and what happens next**, in plain language, for people who may not read the doc.

## Signals

A Google Doc / Docs link, "PRD", "one-pager", "strategy", "roadmap", "epic", "readout", "exec summary", "brief", a Confluence or Notion page that is about product intent rather than system design. If it is mainly architecture or an ADR, use [technical-doc.md](technical-doc.md). If it is code, use [code-change.md](code-change.md). A PRD plus its implementing PRs: product-doc is primary; mention the PRs only where the doc points at them.

## Audience (ask if not given)

The audience changes the video more than the depth does. Offer these and default to the first:

- **Leadership / executives.** Decision and ask up front. One idea per scene, at most one headline number per scene unless the scene is the metrics scene, every number source-tagged. No jargon; define any product term once. Close with the decisions and dependencies that need leadership.
- **Cross-functional team (eng, design, data).** Adds scope by phase, non-goals, ownership, dependencies, open questions.
- **Stakeholder update.** What changed since last time, what is decided, what is next.

State the audience in the plan. It also sets the vocabulary: say "the team decided", not "we shipped"; avoid internal acronyms unless the audience uses them.

## Ingest

1. Read the document's metadata: title, owner, status, created and last-modified dates. Put them in the ledger `source` and show "as of <date>" in the video.
2. Use the user's connectors: Google Docs via Drive `read_file_content` (add `includeComments` if the user wants unresolved comments surfaced), Confluence/Jira via the Atlassian tools, Notion via `notion-fetch`, Slack threads via the Slack read tools. If a connector cannot read it, ask the user to paste the text.
3. Long documents will not fit in context. The tool will save them to a file. Extract the text to a scratch file, strip link noise, **list the headings first**, then read in chunks of about 10 KB until you have read every section you plan to cover. Record what you read in `source.read` and say so in the plan. Never summarize a section you did not read.
4. Read the document's own summary spine first ("Executive summary", "TL;DR", "Part 0", "The decision"). A well-written doc already ranks its own importance; reuse its ordering, then check the detail sections against it.
5. Look for the document's self-flagged caveats ("needs reconciling", "TBD", "open question", "external source, may be inaccurate"). Each one is a ledger entry or a discrepancy.
6. Do not paste source text into the repo, a PR, a ticket, or Slack. The working files stay in the explainer folder.

## What matters

| Rank | Material |
|---|---|
| Cover | The decision or ask; the problem and why now; the evidence for it; who it is for; what is being built (scope) and what is explicitly not; success metrics with baseline and target; risks and dependencies; timeline and rollout; open questions and decisions needed |
| Mention | Research method and sample sizes, competitor detail beyond the one comparison that drives the decision, history of earlier iterations |
| Skip | Reference and link tables, templates and boilerplate, per-field specs, per-screen detail, long quote walls, anything marked internal-only that the audience does not need |

Group many similar items into one scene (for example six asset types into one "one chassis, many pages" scene). Order for a decision-maker: **answer first, then the reasoning**, not the document's order of discovery.

## Depth

- **Overview:** ~60–90 s, 3–5 scenes. The problem, the bet, what ships, how we will know.
- **Standard (default):** ~2–3 min, 5–7 scenes. Adds the evidence and phasing.
- **Deep dive:** ~4–6 min, 8–11 scenes. Use the executive spine below. Longer than 6 minutes means it should be two videos.

### Executive deep-dive spine

Scenes in this order, merging or dropping those the document does not support:

1. **The decision and the ask.** What this is, what leadership is being asked to confirm. As-of date and status.
2. **Why now.** The market or product evidence that makes this timely. Source-tagged numbers.
3. **What we learned.** The research or data behind the direction, with sample sizes only if the document states them.
4. **The options and the call.** The alternatives considered and what the document chose, with the reason.
5. **Who it is for.** The user groups and the one the plan optimizes first.
6. **What we are building.** The scope in one picture.
7. **Phasing.** What ships when. Dates exactly as the document gives them.
8. **What is not in scope.** Non-goals and what is owned by other teams.
9. **How we will know.** Metrics with baseline → target, guardrails, and any kill criteria. Mark targets as targets.
10. **Risks and dependencies.** Highest severity first, each with its owner or mitigation as the document states.
11. **Open questions and asks.** What is undecided, and what the audience is asked to decide or unblock.

## Scenes

No code. Use: decision card, evidence stat (large number + source chip), comparison matrix, user-group cards, phase roadmap (columns by version or date), baseline → target metric rows, severity-ordered risk list, ask/decision list. Every scene that carries a fact shows a small source chip ("PRD §10.1"). Prefer the document's own table or figure as the on-screen structure.

## Voice

Plain, calm, neutral. Explain the document; do not advocate for it and do not editorialize ("exciting", "huge", "clearly"). Attribute: "the PRD proposes", "the team decided in September", "research found", "the target is". Use the verb that matches the fact's kind (`facts.md`). Spell out each acronym or product term on first use. Say numbers the way a person would, as the source gives them. No jokes.

## Defaults

Script style: Natural. Theme: **MetaMask** for MetaMask product work (Motion Engineering only on request). Destination: **keep local**.

## Confidentiality

Product docs often carry revenue, roadmap, vendor, and people details. Before approval, list in the plan every person's name, vendor or partner name, revenue or financial figure, and unreleased date the video would show, so the user can strip any of them. Default to team or function names rather than individuals unless the audience needs the owner. The video is stored locally; do not upload or attach it anywhere unless the user names the destination.

## Plan contents (in addition to the shared items)

- **Reading as:** profile, audience, depth, theme.
- **Source stamp:** title, owner, status, as-of date, and exactly which sections you read in full.
- **Narrative outline:** each scene → the document section it comes from → the one idea. Include a table of **omitted sections and why**.
- **Facts ledger table** (from `facts.json`): id, text as shown, source section, kind, derivation or attribution where relevant.
- **Discrepancies and caveats:** every conflict or self-flagged caveat, what you propose to do, and a question for the user.
- **Confidential content** list (above).
- **Spoken lines**, `spoken` already expanded; unknowns from `speak_prep.py`.

## Verify after render

Run `scripts/verify_facts.py <scenes.json> --facts facts.json --also segments/*/index.ts`. Then read the extracted frames against the ledger: every number, date, and name on screen is in it, every source chip points to a real section, and nothing says more than its fact's kind allows (a hypothesis is not shown as a result). Check the length against the depth.
