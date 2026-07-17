---
name: migration-context-cost
description: A file's JS→TS migration cost is dominated by context fan-in (upstream files whose source types to derive from) + fan-out (downstream files that import it and must update), not its line count. Scope and sequence migration tickets by this cost.
maturity: experimental
---

# TypeScript Migration Context Cost — Fan-In and Fan-Out

The cost of converting a file to TypeScript is not its line count. It is the **context the conversion pulls in** — everything the converter, human or AI, must load to do it correctly.

## The two axes

- **Fan-in (upstream source types).** To type the file's values correctly you must load every upstream module whose types the code should _derive_ from — controller state, function returns, library exports, schemas (see `derive-types`). A file that touches many upstream types has high fan-in even if it is short.
- **Fan-out (downstream consumers).** Changing the file's types ripples to every module that imports it; each may need its own update or re-type. A widely-imported file has high fan-out even if it is small.

The real work — and the real review surface — is the sum of these, not the target file's length. A 200-line hub imported by 100 files can be a larger migration than a self-contained 2,000-line leaf.

## Why it matters even for AI

Single-pass conversion of a high-fan-in/fan-out file is impractical even for a capable AI: it must hold the target file in context **and** progressively load every upstream source-type file **and** every downstream consumer. That context fan-in/fan-out is the binding constraint, not the model's ability to read the file itself.

## How to use it

- **Scope tickets by context cost, not LOC.** Estimate fan-in (upstream types the file derives from) + fan-out (`grep -rl` importer count) before sizing a migration ticket. Size by the import-rewrite / re-type surface, not the line count.
- **Sequence low-cost first.** Convert leaf / low-fan-out files early (few downstream updates), and files whose upstream types are already TypeScript (low fan-in), so later conversions have more typed ground to derive from.
- **When the cost won't fit one PR, reduce it before converting.** High fan-in → the upstream types may need to land first. High fan-out through a hub → decompose the hub into coherent units so each unit's fan-out is bounded (see `decompose-large-files`). Decomposition is one response to high context cost — not the only place the cost applies.
- **Keep the fan-out map honest.** A barrel / re-export file inflates apparent fan-out and hides real dependencies; importing from the actual source file (not a barrel) keeps the dependency graph — and the cost estimate — accurate.
