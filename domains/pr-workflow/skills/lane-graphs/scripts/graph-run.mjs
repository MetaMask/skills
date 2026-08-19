#!/usr/bin/env node
//
// graph-run — validate a lane graph, and refuse to call a run complete while any node of it
// is unanswered.
//
// The three .graph.json specs named an `executor` and nothing parsed them, so they were
// prose wearing a schema: a run could skip a node and still describe itself as having
// followed the graph, because nothing held the description to the file.
//
// What this can and cannot do is worth being exact about, because overstating it would
// reproduce the failure it addresses. The `check`, `run` and `expect` fields are natural
// language. No interpreter evaluates them, and this one does not pretend to — a node's
// verdict is supplied by whoever ran it. What is mechanised is the part that was actually
// being skipped: that every node HAS a verdict, that the verdict names its evidence, and
// that a graph with an unanswered node cannot report as complete. Judgement stays on the
// claim; the bookkeeping stops depending on memory.
//
// Usage:
//   graph-run.mjs <graph.json> --scaffold > ledger.json   write a blank ledger for the graph
//   graph-run.mjs <graph.json> --ledger ledger.json       check a filled-in ledger
//   graph-run.mjs <graph.json>                            validate graph structure only
//
// Exit 0 = graph valid / every node answered and passing.
// Exit 1 = a node failed, is unanswered, or the ledger does not match the graph.
// Exit 2 = usage or parse error.
import { readFileSync, existsSync } from 'node:fs';

const argv = process.argv.slice(2);
const graphPath = argv[0];
const scaffold = argv.includes('--scaffold');
const ledgerPath = argv.includes('--ledger') ? argv[argv.indexOf('--ledger') + 1] : null;

if (!graphPath || !existsSync(graphPath)) {
  console.error('usage: graph-run.mjs <graph.json> [--scaffold | --ledger <ledger.json>]');
  process.exit(2);
}

let graph;
try {
  graph = JSON.parse(readFileSync(graphPath, 'utf8'));
} catch (err) {
  console.error(`graph-run: ${graphPath} is not valid JSON — ${err.message}`);
  process.exit(2);
}

// ── structure ──────────────────────────────────────────────────────────────
// A graph missing its baseline or its prediction is the shape of every vacuous run this
// package documents: a treatment applied to nothing, or a result compared to no stated
// expectation. Those two absences are structural and worth refusing up front.
const REQUIRED_TYPES = ['precondition', 'baseline', 'treatment', 'prediction', 'capture'];
const problems = [];
const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];

if (!graph.lane) problems.push('no `lane` — the graph does not say which claim it answers');
if (!nodes.length) problems.push('no `nodes`');

const seen = new Set();
for (const [i, n] of nodes.entries()) {
  if (!n.id) problems.push(`node ${i}: no id`);
  else if (seen.has(n.id)) problems.push(`node ${i}: duplicate id "${n.id}"`);
  else seen.add(n.id);
  if (!n.type) problems.push(`node ${n.id ?? i}: no type`);
}
for (const t of REQUIRED_TYPES) {
  if (!nodes.some((n) => n.type === t)) problems.push(`no node of type "${t}"`);
}

if (problems.length) {
  console.error(`graph-run: ${graphPath}`);
  for (const p of problems) console.error(`  INVALID  ${p}`);
  process.exit(1);
}

// ── scaffold ───────────────────────────────────────────────────────────────
if (scaffold) {
  process.stdout.write(
    `${JSON.stringify(
      {
        graph: graphPath,
        lane: graph.lane,
        // status is one of: pass | fail | absent. `absent` is a first-class outcome —
        // a node that could not be run is reported, never quietly dropped.
        nodes: Object.fromEntries(
          nodes.map((n) => [n.id, { status: 'absent', evidence: '', note: '' }]),
        ),
      },
      null,
      2,
    )}\n`,
  );
  process.exit(0);
}

console.error(`graph-run: ${graph.lane}`);

if (!ledgerPath) {
  console.error(`  VALID    ${nodes.length} nodes, all required types present`);
  console.error('  (no --ledger given, so nothing was checked about an actual run)');
  process.exit(0);
}

if (!existsSync(ledgerPath)) {
  console.error(`  ERROR    ledger not found: ${ledgerPath}`);
  process.exit(2);
}

let ledger;
try {
  ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
} catch (err) {
  console.error(`  ERROR    ledger is not valid JSON — ${err.message}`);
  process.exit(2);
}

const entries = ledger.nodes ?? {};
let failed = 0;
for (const n of nodes) {
  const e = entries[n.id];
  if (!e) {
    console.error(`  UNANSWERED  ${n.id} (${n.type}) — no ledger entry`);
    failed += 1;
    continue;
  }
  if (e.status === 'pass') {
    // A pass with no evidence is a claim about a run, which is the thing the whole
    // package refuses to accept anywhere else. It is not accepted here either.
    if (!e.evidence) {
      console.error(`  NO-EVIDENCE ${n.id} (${n.type}) — status pass with empty evidence`);
      failed += 1;
    } else {
      console.error(`  pass        ${n.id} (${n.type}) — ${e.evidence}`);
    }
  } else if (e.status === 'absent') {
    console.error(`  ABSENT      ${n.id} (${n.type}) — ${e.note || 'not run'}`);
    failed += 1;
  } else {
    console.error(`  FAIL        ${n.id} (${n.type}) — ${e.note || e.evidence || ''}`);
    failed += 1;
  }
}

const extra = Object.keys(entries).filter((k) => !seen.has(k));
for (const k of extra) console.error(`  UNKNOWN     ${k} — in ledger, not in graph`);

console.error('');
if (failed === 0 && extra.length === 0) {
  console.error(`graph-run: complete — ${nodes.length}/${nodes.length} nodes answered and passing`);
  process.exit(0);
}
console.error(
  `graph-run: INCOMPLETE — ${failed} node(s) unanswered or failing` +
    `${extra.length ? `, ${extra.length} unknown` : ''}. This run does not satisfy the lane.`,
);
process.exit(1);
