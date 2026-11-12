#!/usr/bin/env node
//
// What actually loaded, and what published without its gate.
//
// Skill loading is not deterministic. A description is matched by a model, so "did the right
// skill load" is a question about a probabilistic event, and the only honest way to answer it
// is to look at what happened rather than at what the description says should happen.
//
// Two reports:
//   loaded    every skill that entered context, by route. Three routes exist and they leave
//             different traces, which is why counting only one of them reads as silence.
//   ungated   every outward-facing publish with no gate run before it in the same session.
//             This one is deterministic and is the reason the script exists: whether a gate
//             ran before a write is a fact about the transcript, not a judgement.
//
// Usage: node tools/skill-audit.mjs <transcript.jsonl> [--json]
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error('usage: skill-audit.mjs <transcript.jsonl> [--json]');
  process.exit(2);
}

const ROUTES = [
  // Skill tool call — the explicit path.
  [/"skill"\s*:\s*"([a-z0-9-]+)"/g, 'skill-tool'],
  // Slash command injected into the turn.
  [/<command-name>\/?([a-z0-9-]+)<\/command-name>/g, 'slash-command'],
  // Description match / directory scope: the loader announces where it read the file from.
  [/Base directory for this skill:[^\n"]*?skills\/([a-z0-9-]+)/g, 'auto-load'],
];

// An outward-facing write. Deliberately broader than the porcelain: `gh api` with a body
// field is the path that bypasses `gh pr comment`, and it is the one that got used.
const PUBLISH = /gh\s+(?:pr|issue)\s+(?:comment|edit|create)\b|gh\s+api\b[^"']*(?:-F|-f|--field|--raw-field)\s+body=/;
const GATE = /attest-gate\.sh|pr-evidence-gate\.py/;

const loaded = new Map();
const events = [];
let line = 0;

const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
for await (const raw of rl) {
  line += 1;
  for (const [re, route] of ROUTES) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(raw)) !== null) {
      const key = `${m[1]} (${route})`;
      loaded.set(key, (loaded.get(key) ?? 0) + 1);
    }
  }
  const isGate = GATE.test(raw);
  const isPublish = PUBLISH.test(raw);
  if (isGate) events.push({ line, kind: 'gate' });
  // Chained means the gate and the write are one command, so the shell enforces the
  // ordering. A gate that merely ran EARLIER proves nothing: the verdict can be read after
  // the write, or not read at all, which is how a blocked artifact reached a public PR in
  // the session this script was written from.
  if (isPublish) events.push({ line, kind: 'publish', chained: isGate });
}

// A publish is gated if a gate invocation appears earlier in the transcript. This is
// deliberately generous — same session, any distance — because the failure it looks for is
// "no gate at all", and a stricter window would produce arguments about proximity rather
// than findings.
let lastGate = -1;
const ungated = [];
const unchained = [];
for (const e of events) {
  if (e.kind === 'gate') { lastGate = e.line; continue; }
  if (lastGate < 0) ungated.push(e.line);
  if (!e.chained) unchained.push(e.line);
}

const report = {
  transcript: file,
  loaded: Object.fromEntries([...loaded].sort((a, b) => b[1] - a[1])),
  publishes: events.filter((e) => e.kind === 'publish').length,
  gateRuns: events.filter((e) => e.kind === 'gate').length,
  ungatedPublishLines: ungated,
  unchainedPublishLines: unchained,
};

if (flags.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`skill-audit: ${file}\n`);
  console.log('loaded:');
  for (const [k, v] of Object.entries(report.loaded)) console.log(`  ${String(v).padStart(4)}  ${k}`);
  if (!Object.keys(report.loaded).length) console.log('  (none)');
  console.log(`\npublishes: ${report.publishes}   gate runs: ${report.gateRuns}`);
  console.log(`unchained publishes: ${unchained.length} of ${report.publishes}`);
  if (ungated.length) {
    console.log(`\nUNGATED (${ungated.length}) — no gate ran at all before these:`);
    for (const l of ungated.slice(0, 10)) console.log(`  line ${l}`);
  }
  if (unchained.length) {
    console.log(`\nUNCHAINED (${unchained.length}) — a gate ran earlier, but not as the same`);
    console.log('command, so nothing forced the write to depend on its verdict:');
    for (const l of unchained.slice(0, 10)) console.log(`  line ${l}`);
  }
}
process.exit(ungated.length || unchained.length ? 1 : 0);
