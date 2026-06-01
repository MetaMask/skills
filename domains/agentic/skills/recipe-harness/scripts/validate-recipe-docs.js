#!/usr/bin/env node
'use strict';

// validate-recipe-docs.js — offline validator that keeps every recipe-AUTHORING
// example (fenced ```json recipe blocks in the recipe-* skill docs) and the
// adapter verify.sh embedded smoke recipes consistent with the MetaMask v1 runner
// manifest, so doc/recipe field-schema drift is caught mechanically.
//
// Source of truth: the runner manifest. Action NAMES + field SHAPES are encoded
// in the committed vendored fixture recipe-action-vocab.fixture.json (derived
// from the metamask-recipe-runner manifests AND the runner's shipped recipes,
// because the installed manifest's action_metadata examples are minimal while the
// shipped recipes reveal the full accepted field set). The fixture is the offline
// fallback so this does not hard-depend on an external runner checkout.
//
// If an installed manifest is found under the harness root (or passed via
// --manifest <path>), the validator RECONCILES the fixture's action-name lists
// against it and fails on divergence — that is the "prefer the installed
// manifest" drift guard. Field schemas always come from the fixture.
//
// Checks (exit nonzero on any): (1) a fenced json recipe block that does not parse
// as a single JSON value; (2) an unknown action name; (3) a node field that
// contradicts the action's known field set; (4) a removed/stale field token in
// PROSE (denylist in the fixture's prose.forbiddenFieldPatterns). Reports
// file:line for each.
//
// When a manifest is available it is reconciled BOTH ways (fail on actions only in
// the manifest AND only in the fixture) and hard-fails on an unreadable/empty
// manifest — a stale fixture or drifted/empty manifest can never report OK.
//
// SCOPE LIMIT: only fenced json recipe blocks + the adapter verify.sh embedded
// recipes are fully field-validated. Free prose is checked ONLY against the
// stale-field denylist, not the full schema, so a brand-new wrong field in prose
// (not on the denylist) can still slip through. Keep authoring field guidance in
// fenced json examples; add removed fields to the denylist via gen-action-vocab.js.
// nameOnly actions (no action_metadata) are validated against universal + their
// shipped-recipe field set; a valid-but-never-yet-shipped field could be flagged.
//
// Usage:
//   validate-recipe-docs.js [--manifest <action-manifest.json>] [--target <repo>]
//                           [--fixture <path>] [file ...]
// With no file args it scans the default recipe-* docs + adapter verify.sh recipes.

const fs = require('node:fs');
const path = require('node:path');

// __dirname = domains/agentic/skills/recipe-harness/scripts → up 2 = the skills dir.
const SKILL_ROOT = path.resolve(__dirname, '../..'); // domains/agentic/skills

function parseArgs(argv) {
  const a = { manifest: '', target: '', fixture: '', files: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--manifest') a.manifest = argv[++i] || '';
    else if (arg === '--target') a.target = argv[++i] || '';
    else if (arg === '--fixture') a.fixture = argv[++i] || '';
    else if (arg === '-h' || arg === '--help') { printHelp(); process.exit(0); }
    else a.files.push(arg);
  }
  return a;
}

function printHelp() {
  console.error('Usage: validate-recipe-docs.js [--manifest <action-manifest.json>] [--target <repo>] [--fixture <path>] [file ...]');
}

function loadFixture(fixturePath) {
  const p = fixturePath || path.join(__dirname, 'recipe-action-vocab.fixture.json');
  const v = JSON.parse(fs.readFileSync(p, 'utf8'));
  return {
    official: new Set(v.officialActions || []),
    custom: new Set(v.customActions || []),
    nameOnly: new Set(v.nameOnlyActions || []),
    universal: new Set(v.universalFields || []),
    actionFields: v.actionFields || {},
    forbidden: (v.prose && v.prose.forbiddenFieldPatterns) || [],
    meta: { protocolVersion: v.protocolVersion, registryVersion: v.registryVersion },
  };
}

// Two-way "prefer installed manifest" drift guard. Hard-fails on an
// unreadable/empty manifest, and on action sets that diverge in EITHER direction
// (only-in-manifest = stale fixture; only-in-fixture = removed from manifest), so a
// stale fixture or a drifted/empty manifest can never report OK.
function reconcileNames(vocab, manifestPath) {
  let m;
  try { m = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
  catch (e) { return [`manifest ${manifestPath} is unreadable/unparseable: ${e.message}`]; }
  const official = m.supported_official_actions || [];
  const custom = (m.custom_actions || []).map((c) => (typeof c === 'string' ? c : c && c.name)).filter(Boolean);
  if (!official.length) return [`manifest ${manifestPath} has an empty/absent supported_official_actions list`];
  if (!custom.length) return [`manifest ${manifestPath} has an empty/absent custom_actions list`];
  const mOff = new Set(official);
  const mCus = new Set(custom);
  const errs = [];
  for (const n of official) if (!vocab.official.has(n)) errs.push(`official action '${n}' is in the manifest but missing from the fixture — regenerate recipe-action-vocab.fixture.json`);
  for (const n of custom) if (!vocab.custom.has(n)) errs.push(`custom action '${n}' is in the manifest but missing from the fixture — regenerate recipe-action-vocab.fixture.json`);
  for (const n of vocab.official) if (!mOff.has(n)) errs.push(`official action '${n}' is in the fixture but not in the manifest (removed/renamed?) — regenerate recipe-action-vocab.fixture.json`);
  for (const n of vocab.custom) if (!mCus.has(n)) errs.push(`custom action '${n}' is in the fixture but not in the manifest (removed/renamed?) — regenerate recipe-action-vocab.fixture.json`);
  return errs;
}

function findInstalledManifest(target) {
  const root = process.env.RECIPE_HARNESS_ROOT || 'temp/agentic/recipe-harness';
  for (const adapter of ['mobile', 'extension']) {
    const p = path.join(target || process.cwd(), root, adapter, 'action-manifest.json');
    if (fs.existsSync(p)) return p;
  }
  return '';
}

// Deep-collect every object with a string `action` anywhere in the value tree.
// This covers full recipes (validate.workflow.nodes), single nodes, node arrays,
// AND inline action nodes nested under cases/default/setup/teardown branches.
function collectActionNodes(value, out = []) {
  if (Array.isArray(value)) { for (const v of value) collectActionNodes(v, out); return out; }
  if (value && typeof value === 'object') {
    if (typeof value.action === 'string') out.push(value);
    for (const v of Object.values(value)) if (v && typeof v === 'object') collectActionNodes(v, out);
  }
  return out;
}

function validateNode(node, vocab, where, violations) {
  const action = node.action;
  if (!vocab.official.has(action) && !vocab.custom.has(action)) {
    violations.push(`${where}: unknown action "${action}" (not in supported_official_actions or custom_actions)`);
    return;
  }
  // Every action (including nameOnly actions, whose field set is derived from
  // shipped-recipe usage) is checked against universal + its known field set.
  const allowed = new Set([...vocab.universal, ...(vocab.actionFields[action] || [])]);
  for (const field of Object.keys(node)) {
    if (!allowed.has(field)) {
      violations.push(`${where}: action "${action}" has field "${field}" not in its manifest field set [${[...allowed].sort().join(', ')}]`);
    }
  }
}

// Extract ```json ... ``` fences with their starting line numbers.
function jsonFences(src) {
  const lines = src.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*```json\s*$/i.test(lines[i])) {
      const startLine = i + 1;
      const buf = [];
      i += 1;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { buf.push(lines[i]); i += 1; }
      out.push({ startLine, text: buf.join('\n') });
    }
  }
  return out;
}

function validateMarkdown(file, vocab, violations) {
  const src = fs.readFileSync(file, 'utf8');
  for (const fence of jsonFences(src)) {
    if (!fence.text.includes('"action"')) continue; // not a recipe block
    const where = `${file}:${fence.startLine}`;
    let value;
    try { value = JSON.parse(fence.text); } catch (e) {
      violations.push(`${where}: json recipe block does not parse as a single JSON value (${e.message}). Wrap multiple node examples in a JSON array.`);
      continue;
    }
    const nodes = collectActionNodes(value);
    if (!nodes.length) continue; // parsed JSON but not a recipe/node shape
    for (const node of nodes) validateNode(node, vocab, where, violations);
  }
}

// Prose isn't fully field-validated; this catches the curated denylist of
// stale/removed field tokens (fixture prose.forbiddenFieldPatterns) anywhere in a
// doc — code or prose — so removed fields can't silently linger in guidance.
function scanProseForbidden(file, vocab, violations) {
  if (!vocab.forbidden.length) return;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const res = vocab.forbidden.map((p) => ({ src: p, re: new RegExp(p) }));
  for (let i = 0; i < lines.length; i += 1) {
    for (const { src, re } of res) {
      if (re.test(lines[i])) violations.push(`${file}:${i + 1}: stale/removed field token matching /${src}/ in prose — reconcile to the manifest field set`);
    }
  }
}

// Extract a single heredoc recipe ( <<'JSON' ... JSON ) from an adapter verify.sh.
function validateEmbeddedRecipe(file, vocab, violations) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (/<<'JSON'/.test(lines[i])) {
      const startLine = i + 1;
      const buf = [];
      i += 1;
      while (i < lines.length && !/^JSON$/.test(lines[i])) { buf.push(lines[i]); i += 1; }
      const where = `${file}:${startLine} (embedded smoke recipe)`;
      let value;
      try { value = JSON.parse(buf.join('\n')); } catch (e) {
        violations.push(`${where}: embedded recipe does not parse (${e.message})`);
        continue;
      }
      for (const node of collectActionNodes(value)) validateNode(node, vocab, where, violations);
    }
  }
}

function defaultMarkdownTargets() {
  const skills = ['recipe-cook', 'recipe-wallet-control', 'recipe-dev', 'recipe-fix-ticket', 'recipe-doctor', 'recipe-evidence', 'recipe-quality', 'recipe-harness'];
  const files = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.md')) files.push(p);
    }
  };
  for (const s of skills) { const d = path.join(SKILL_ROOT, s); if (fs.existsSync(d)) walk(d); }
  return files;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const vocab = loadFixture(args.fixture);
  const violations = [];

  const manifestPath = args.manifest || findInstalledManifest(args.target);
  if (manifestPath) {
    const nameErrs = reconcileNames(vocab, manifestPath);
    if (nameErrs.length) { for (const e of nameErrs) console.error(`[vocab-drift] ${e}`); violations.push(...nameErrs); }
    else console.error(`[validate-recipe-docs] reconciled fixture action names against ${manifestPath} — OK`);
  } else {
    console.error('[validate-recipe-docs] no installed manifest found; using committed vocabulary fixture (offline).');
  }

  const mdTargets = args.files.length ? args.files.filter((f) => f.endsWith('.md')) : defaultMarkdownTargets();
  for (const f of mdTargets) { validateMarkdown(f, vocab, violations); scanProseForbidden(f, vocab, violations); }

  const verifyScripts = args.files.length
    ? args.files.filter((f) => f.endsWith('verify.sh'))
    : [
        path.join(SKILL_ROOT, 'recipe-harness/adapters/mobile/scripts/verify.sh'),
        path.join(SKILL_ROOT, 'recipe-harness/adapters/extension/scripts/verify.sh'),
      ];
  for (const f of verifyScripts) validateEmbeddedRecipe(f, vocab, violations);

  if (violations.length) {
    console.error(`\n${violations.length} recipe-doc validation violation(s):`);
    for (const v of violations) console.error(`  - ${v}`);
    process.exit(1);
  }
  console.error(`[validate-recipe-docs] OK — all recipe blocks valid against vocab (protocol ${vocab.meta.protocolVersion}/registry ${vocab.meta.registryVersion}).`);
}

main();
