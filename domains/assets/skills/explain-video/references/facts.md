# Facts: nothing on screen or in the voice is invented

Applies to every profile. A walkthrough with no numbers, dates, names, or claims has nothing to trace, so its ledger can be empty. Anything that does carry a fact follows these rules.

## What counts as a fact

Any number, percentage, currency amount, date, version, quarter, count, name of a person, team, product, vendor, or system, ticket id, file path, quote, ranking ("largest", "first"), or causal claim ("because X, Y happened") that appears in `display` or `spoken`.

## The rules

1. **Trace it.** Every fact has a source location: PR number + file/line, doc section, table row, ticket, message link. If you cannot point at it, it does not go in the video. Ask the user or leave it out.
2. **Say it as the source says it.** Do not round, convert, merge, or "tidy" a number. `~9.3%` stays `about 9.3 percent`, not "nearly 10". A range stays a range.
3. **Show your arithmetic.** If you add, subtract, divide, or compare values, mark the fact `derived` and write the derivation (`28.5 + 12.75 = 41.25`). Prefer the source's own total when it has one.
4. **Attribute external data.** Numbers from a third-party dashboard or estimate are `external`: say whose they are ("per an industry report", "an outside estimate"). If the source itself calls the number approximate or unreliable, carry that caveat.
5. **Keep status honest.** Do not narrate a plan as a result or a hypothesis as a finding. Use the right verb and mark the fact with its kind:
   - `verbatim`: stated in the source as fact.
   - `decision`: the source records it as decided ("the team decided", dated).
   - `hypothesis`: a target, forecast, or assumption ("targets", "the hypothesis is").
   - `open`: unresolved ("still open", "undecided").
   - `external`, `derived`, `quote` as above.
6. **Quotes are verbatim and attributed.** No paraphrase inside quotation marks. Say who said it as the source does ("a participant said"), not a person's name unless the source names them and the user agrees.
7. **Conflicts are never resolved silently.** If the source disagrees with itself (two figures for one thing, two dates for one milestone), or disagrees with another source you read, list it under `discrepancies` and ask the user which to use. If the source itself flags a figure as needing reconciliation, do not use the flagged figure unless the user says so.
8. **Say what you read.** For long sources, state which sections you read in full and which you skimmed or skipped. Never summarize a document you only partly read without saying so.
9. **Missing means ask.** If the video needs a fact the source does not give (a baseline, an owner, a date), ask once in the plan. Do not estimate.
10. **Stamp it.** For documents, put the title, owner, status, and last-modified date in the plan, and show "as of <date>" on the title or closing scene. Documents change; the video must say which version it explains.

## The ledger: `facts.json`

Written in the explainer folder before approval, shown in the plan, and checked before render. Keep it small: one row per fact on screen or spoken, not per sentence in the source.

```json
{
  "source": {
    "title": "Doc or PR title",
    "location": "URL, PR number, or path",
    "owner": "Owner or author",
    "status": "e.g. Ready for review",
    "as_of": "2026-10-09",
    "read": "100%: sections 0-5, 10-14; skimmed 6-9"
  },
  "allow": ["1", "3"],
  "facts": [
    {
      "id": "F1",
      "shown": "41.25M",
      "kind": "derived",
      "source": "§2.2 table, Acme row + Bolt row",
      "quote": "30d revenue $28.5M + $12.75M",
      "derivation": "28.5 + 12.75 = 41.25",
      "attribution": "per the analyst firm named in the source"
    }
  ],
  "discrepancies": [
    {
      "topic": "Acme + Bolt 30-day revenue",
      "values": ["$55M (§2.1 headline)", "$41.25M (§2.2 table)"],
      "resolution": "Use $41.25M; the doc says the headline needs reconciling"
    }
  ]
}
```

- `shown`: the exact text as displayed (digits and units). The checker matches on it.
- `allow`: bare numbers that are harmless (scene counters like `01`, counting list items) and need no source. Section references such as `§10.1` are citations and are ignored automatically.
- `derived` needs `derivation`; `external` needs `attribution`; every fact needs `id`, `shown`, `kind`, `source`.
- A `discrepancy` is only done when `resolution` is filled in by the user's yes.

## The check

```bash
python3 scripts/verify_facts.py <explainer>/scenes.json --facts <explainer>/facts.json [--also segments/*/index.ts]
```

It fails when a number or date in the script or the named segment files is not covered by a fact or `allow`, when a fact is malformed, or when a discrepancy has no resolution. It warns about ledger facts that never appear on screen. Run it before approval (script only) and again after the segments are written (with `--also`). It cannot tell if a fact is *true*; it only guarantees every number was deliberately sourced. The plan review is where the user checks the sources.
