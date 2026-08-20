#!/usr/bin/env node
//
// Every repository named in this repo must be fetchable by an anonymous reader.
//
// This repo is public. Naming a repository here discloses that it exists, who owns it and
// roughly what is in it — and a prohibition discloses exactly as much as a recommendation:
// "do not re-host to acme/secret-notes, it is private" publishes the name either way. So the
// rule is about the mention, not the sentiment attached to it.
//
// The check is a request, not a list. An owner allowlist looked cheaper and was wrong on its
// first run: it cleared nothing useful and flagged `nock/nock` and `phishfort/phishfort-lists`,
// because "is this owner well known" is not the property that matters. The property is whether
// a reader who is not you can open the link — which an unauthenticated request answers exactly.
// 404 means private or absent; both are unresolvable for a public reader, and both are defects.
//
// Deliberately unauthenticated: a token would see private repos and pass them, which is the
// failure this exists to prevent.
//
//   0  every referenced repository resolves anonymously
//   1  one or more do not
//   2  could not run (offline) — reported, not silently passed
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.SKILLS_LINT_ROOT
  ? path.resolve(process.env.SKILLS_LINT_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// `orgs/`, `sponsors/` and friends are github.com paths that are not repositories.
const NOT_A_REPO = new Set(['orgs', 'sponsors', 'users', 'settings', 'apps', 'topics', 'features', 'pricing']);
// Org-internal repos are private to the public but readable by colleagues, and naming them is a
// deliberate call: they are load-bearing context for the audience this repo is written for. The
// rule being enforced is about *personal* repos, which are unreachable by colleagues too.
const INTERNAL_OWNERS = new Set(['MetaMask', 'Consensys']);
// Template placeholders in contributor docs are meant to be substituted, not resolved.
const PLACEHOLDER = /^(YOUR|MY|<|\$\{)/u;
const REPO_REF = /https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9][\w.-]*)\/([A-Za-z0-9][\w.-]*)/gu;
const TEXT = /\.(md|sh|py|mjs|js|ya?ml|json|tsx?)$/u;

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (TEXT.test(e.name)) out.push(full);
  }
  return out;
}

const refs = new Map(); // "owner/repo" -> Set of relative paths
for (const file of walk(ROOT)) {
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { continue; }
  for (const [, owner, repo] of text.matchAll(REPO_REF)) {
    if (NOT_A_REPO.has(owner) || INTERNAL_OWNERS.has(owner) || PLACEHOLDER.test(owner)) continue;
    const key = `${owner}/${repo.replace(/\.git$/u, '')}`;
    if (!refs.has(key)) refs.set(key, new Set());
    refs.get(key).add(path.relative(ROOT, file));
  }
}

if (refs.size === 0) { console.log('check-public-refs: no repository references found'); process.exit(0); }

let bad = 0, unknown = 0;
for (const [key, files] of [...refs].sort()) {
  let status;
  try {
    const res = await fetch(`https://github.com/${key}`, { method: 'HEAD', redirect: 'follow' });
    status = res.status;
  } catch {
    console.error(`  ????  ${key} — request failed; cannot conclude`);
    unknown += 1;
    continue;
  }
  if (status === 200) continue;
  bad += 1;
  console.error(`  FAIL  ${key} — HTTP ${status} anonymously; a public reader cannot open this`);
  for (const f of files) console.error(`          ${f}`);
}

console.log(`\ncheck-public-refs: ${refs.size} repository reference(s) checked`);
if (unknown > 0 && bad === 0) { console.error(`${unknown} could not be checked — offline?`); process.exit(2); }
if (bad > 0) { console.error(`${bad} unresolvable. Cite an org-owned location, or state the rule without the example.`); process.exit(1); }
console.log('every referenced repository resolves anonymously');
