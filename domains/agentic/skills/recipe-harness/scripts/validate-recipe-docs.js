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
// Checks (exit nonzero on any): (1) a ```json recipe block that does not parse as
// a single JSON value; (2) an unknown action name; (3) a node field that
// contradicts the action's known field set. Reports file:line for each.
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
    meta: { protocolVersion: v.protocolVersion, registryVersion: v.registryVersion },
  };
}

// "prefer installed manifest" drift guard: if a manifest is available, ensure the
// fixture's name lists still match it; mismatch => the fixture must be regenerated.
function reconcileNames(vocab, manifestPath) {
  let m;
  try { m = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch { return []; }
  const official = m.supported_official_actions || [];
  const custom = (m.custom_actions || []).map((c) => (typeof c === 'string' ? c : c && c.name)).filter(Boolean);
  const errs = [];
  for (const n of official) if (!vocab.official.has(n)) errs.push(`manifest official action '${n}' missing from fixture — regenerate recipe-action-vocab.fixture.json`);
  for (const n of custom) if (!vocab.custom.has(n)) errs.push(`manifest custom action '${n}' missing from fixture — regenerate recipe-action-vocab.fixture.json`);
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

// Collect recipe nodes from a parsed fence value. Returns [] if it is not a recipe.
function nodesFromValue(value) {
  if (Array.isArray(value)) return value.filter((v) => v && typeof v === 'object' && typeof v.action === 'string');
  if (value && typeof value === 'object') {
    const wf = value.validate && value.validate.workflow;
    if (wf && wf.nodes && typeof wf.nodes === 'object') {
      return Object.values(wf.nodes).filter((v) => v && typeof v === 'object' && typeof v.action === 'string');
    }
    if (typeof value.action === 'string') return [value];
  }
  return [];
}

function validateNode(node, vocab, where, violations) {
  const action = node.action;
  if (!vocab.official.has(action) && !vocab.custom.has(action)) {
    violations.push(`${where}: unknown action "${action}" (not in supported_official_actions or custom_actions)`);
    return;
  }
  if (vocab.nameOnly.has(action)) return; // no action_metadata — validate name only
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
    if (/^\s*```json\s*$/.test(lines[i])) {
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
    const nodes = nodesFromValue(value);
    if (!nodes.length) continue; // parsed JSON but not a recipe/node shape
    for (const node of nodes) validateNode(node, vocab, where, violations);
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
      for (const node of nodesFromValue(value)) validateNode(node, vocab, where, violations);
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
  for (const f of mdTargets) validateMarkdown(f, vocab, violations);

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
