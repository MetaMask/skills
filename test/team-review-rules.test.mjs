import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));
const perps = path.join(root, 'domains/perps/skills/perps-review-pr');
const generator = path.join(perps, 'scripts/materialize-review.mjs');
const run = (...args) => execFileSync(process.execPath, [generator, ...args], { encoding: 'utf8', stdio: 'pipe' });
const fails = (args, message) => assert.throws(() => run(...args), error => message.test(String(error.stderr)));
const read = (...parts) => readFileSync(path.join(...parts), 'utf8');
const allFiles = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? allFiles(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
const antipatterns = '# Swaps\n\n## Quote freshness\n\nA quote is never submitted after it expires.\n\n- **Stale quote submitted**: reject a quote older than its expiry.\n';

function withTeam(body) {
  const temp = mkdtempSync(path.join(tmpdir(), 'team-review-'));
  const skill = path.join(temp, 'domains/swaps/skills/swaps-review-pr');
  const rules = path.join(skill, 'references/rules');
  const write = (file, text) => writeFileSync(path.join(rules, file), text);
  mkdirSync(path.join(rules, 'review'), { recursive: true });
  write('team.json', JSON.stringify({ domain: 'swaps', name: 'Swaps', repository: 'MetaMask/skills', clients: ['mobile', 'extension'], docs: "and the client's docs.", parityNote: '' }));
  write('owned-paths.json', JSON.stringify({ domain: 'swaps', repos: { mobile: ['app/swaps/**'], extension: ['ui/swaps/**'] } }));
  write('review/antipatterns.md', antipatterns);
  try { body({ temp, skill, rules, write }); } finally { rmSync(temp, { recursive: true, force: true }); }
}

test('a team generates, checks and installs its own review from its rules alone', () => withTeam(({ temp, skill, rules, write }) => {
  write('review/antipatterns.mobile.md', '## Gas token\n\nGas is paid in the shown token.\n\n- **Wrong gas token**: compare both.\n');
  run('--library', rules); run('--library', rules, '--check');
  for (const file of allFiles(skill)) assert.doesNotMatch(readFileSync(file, 'utf8'), /perps/i, file);
  assert.match(read(skill, 'skill.md'), /- \[ \] Quote freshness\n  A quote is never submitted after it expires\. See references\/shared\.md#quote-freshness/);
  assert.match(read(skill, 'repos/metamask-mobile.md'), /- \[ \] Gas token/);
  assert.doesNotMatch(read(skill, 'repos/metamask-extension.md'), /Gas token/);
  assert.equal(existsSync(path.join(skill, 'repos/core.md')), false);
  for (const [, file] of read(skill, 'skill.md').matchAll(/(references\/[a-z-]+\.(?:md|json))/g)) assert.ok(existsSync(path.join(skill, file)), `${file} is linked and missing`);
  const target = path.join(temp, 'mobile'); mkdirSync(target);
  execFileSync('bash', [path.join(root, 'tools/install'), '--source', temp, '--target', target, '--repo', 'metamask-mobile', '--domain', 'none', '--include', 'swaps-review-pr'], { stdio: 'pipe' });
  assert.match(read(target, '.agents/skills/mms-swaps-review-pr/SKILL.md'), /Quote freshness[\s\S]*Gas token[\s\S]*Verdict and handoff/);
}));

test('requirements keep their reason and class, and advisory ones do not block', () => withTeam(({ skill, rules, write }) => {
  write('review/requirements.md', '## Shared amounts\n\nAmounts use the shared component.\n\nWhy: team decision\nClass: advisory\n\n- **Shared amount**: use it.\n');
  write('review/requirements.mobile.md', '## Offline quotes\n\nThe quote screen offers a retry.\n\nWhy: product requirement\n\n- **Retry**: offer it.\n');
  run('--library', rules);
  assert.match(read(skill, 'skill.md'), /- \[ \] Shared amounts \(advisory\)/);
  assert.match(read(skill, 'repos/metamask-mobile.md'), /- \[ \] Offline quotes\n[\s\S]*A confirmed blocking requirement is blocking too; an advisory requirement is at most a suggestion\./);
  const byId = Object.fromEntries(JSON.parse(read(skill, 'references/pack.json')).families.map(family => [family.id, family]));
  assert.deepEqual([byId['shared-amounts'].class, byId['shared-amounts'].rules[0].why], ['advisory', 'team decision']);
  assert.deepEqual([byId['offline-quotes'].class, byId['offline-quotes'].clients], ['blocking', ['mobile']]);
  write('review/requirements.md', '## Shared amounts\n\nAmounts use the shared component.\n');
  fails(['--library', rules], /needs a Why: line/);
  write('review/requirements.md', '## Shared amounts\n\nAmounts.\n\nWhy: x\nClass: nice\n');
  fails(['--library', rules], /use blocking or advisory/);
  write('review/requirements.md', '## Quote freshness\n\nAmounts.\n\nWhy: x\n');
  fails(['--library', rules], /quote-freshness appears in/);
}));

test('stale, hand-edited, orphaned or misdirected output is refused', () => withTeam(({ temp, skill, rules, write }) => {
  write('review/antipatterns.mobile.md', '## Gas token\n\nGas is paid in the shown token.\n');
  run('--library', rules);
  write('review/antipatterns.md', antipatterns.replace('its expiry', 'its deadline'));
  fails(['--library', rules, '--check'], /is stale/);
  run('--library', rules);
  writeFileSync(path.join(skill, 'skill.md'), `${read(skill, 'skill.md')}\nhand edit\n`);
  fails(['--library', rules, '--check'], /is stale/);
  run('--library', rules);
  rmSync(path.join(rules, 'review/antipatterns.mobile.md'));
  fails(['--library', rules, '--check'], /stale|Unexpected file/);
  run('--library', rules);
  assert.equal(existsSync(path.join(skill, 'references/mobile.md')), false);
  write('owned-paths.json', JSON.stringify({ domain: 'swap', repos: { mobile: ['a/**'], extension: ['b/**'] } }));
  fails(['--library', rules], /must name domain swaps/);
  write('owned-paths.json', JSON.stringify({ domain: 'swaps', repos: { mobile: ['a/**'] } }));
  fails(['--library', rules], /no paths for extension/);
  const elsewhere = path.join(temp, 'library'); cpSync(rules, elsewhere, { recursive: true });
  fails(['--library', elsewhere], /--out is required for swaps/);
}));

test('a review launched by hand keeps rounds, and only finished work counts', () => withTeam(({ temp, rules }) => {
  run('--library', rules);
  const repo = path.join(temp, 'repo'); mkdirSync(path.join(repo, 'app'), { recursive: true });
  const env = { ...process.env, PATH: [path.dirname(process.execPath), '/usr/bin', '/bin'].join(path.delimiter), GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
  const git = (...args) => execFileSync('git', ['-C', repo, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', ...args], { encoding: 'utf8', stdio: 'pipe', env }).trim();
  const put = (file, text) => writeFileSync(path.join(repo, file), text);
  const commit = message => { git('add', '-A'); git('commit', '-qm', message); return git('rev-parse', 'HEAD'); };
  git('init', '-q', '-b', 'main');
  put('.gitignore', '.agents/\n.claude/\n.cursor/\n'); put('app/x.ts', 'one\n'); put('app/other.ts', 'one\n'); commit('base');
  execFileSync('bash', [path.join(root, 'tools/install'), '--source', temp, '--target', repo, '--repo', 'metamask-mobile', '--domain', 'none', '--include', 'swaps-review-pr'], { stdio: 'pipe' });
  // A mm-harness on the machine would own the checklist; this test covers the plain one.
  const bin = path.join(temp, 'bin'); mkdirSync(bin); writeFileSync(path.join(bin, 'mm-harness'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  env.PATH = `${bin}${path.delimiter}${env.PATH}`;
  const script = path.join(repo, '.agents/skills/mms-swaps-review-pr/scripts/review-task.mjs');
  const task = (...args) => execFileSync(process.execPath, [script, ...args], { cwd: repo, encoding: 'utf8', stdio: 'pipe', env });
  const refuses = (args, message) => assert.throws(() => task(...args), error => message.test(String(error.stderr)));
  const base = 'temp/tasks/review/pr-7';
  const at = (round, file) => path.join(repo, base, `r${round}`, file);
  const json = round => JSON.parse(readFileSync(at(round, 'review.json'), 'utf8'));
  const fill = (round, head, { evidence = 'app/x.ts:1' } = {}) => {
    writeFileSync(at(round, 'artifacts/review-ledger.md'), readFileSync(at(round, 'artifacts/review-ledger.md'), 'utf8').replaceAll('Outcome:', `Outcome: PASS ${evidence}`));
    writeFileSync(at(round, 'artifacts/learnings.md'), '- None\n');
    writeFileSync(at(round, 'artifacts/line-comments.json'), '{"comments": []}');
    writeFileSync(at(round, 'artifacts/review.md'), `VERDICT: APPROVE\nCOMMIT: ${head}\n`);
    writeFileSync(at(round, 'CHECKLIST.md'), readFileSync(at(round, 'CHECKLIST.md'), 'utf8').replaceAll('- [ ]', '- [x]'));
  };
  git('checkout', '-qb', 'feature'); put('app/x.ts', 'two\n'); put('app/y.ts', 'one\n'); const first = commit('change');

  assert.match(task('start', 'main..feature', '--pr', '7'), /Started cold round r1: first round/);
  assert.equal(git('status', '--porcelain'), '', 'the task folder stays out of git');
  assert.match(task('start', 'main..feature', '--pr', '7'), /Resuming cold round r1/);
  refuses(['finish', `${base}/r1`], /is missing or empty/);
  fill(1, first, { evidence: '' }); refuses(['finish', `${base}/r1`], /no evidence/);
  writeFileSync(at(1, 'artifacts/review-ledger.md'), readFileSync(at(1, 'artifacts/review-ledger.md'), 'utf8').replaceAll(/^Outcome:.*$/gm, 'Outcome:'));
  refuses(['finish', `${base}/r1`], /no outcome/);
  fill(1, '0'.repeat(40)); refuses(['finish', `${base}/r1`], /must name COMMIT/);
  writeFileSync(at(1, 'artifacts/review.md'), `VERDICT: APPROVE\nCOMMIT: ${first}\n`);
  writeFileSync(at(1, 'CHECKLIST.md'), readFileSync(at(1, 'CHECKLIST.md'), 'utf8').replace('- [x]', '- [ ]'));
  refuses(['finish', `${base}/r1`], /1 rows are still open/);
  fill(1, first); assert.match(task('finish', `${base}/r1`), /Finished r1: APPROVE/);

  git('checkout', '-q', 'main'); put('app/other.ts', 'main moved\n'); commit('main'); git('checkout', '-q', 'feature');
  git('merge', '-q', '--no-edit', 'main'); put('app/y.ts', 'two\n'); const second = commit('fix');
  assert.match(task('start', 'main..feature', '--pr', '7'), /Started warm round r2/);
  assert.deepEqual(json(2).changedFiles, ['app/y.ts']);
  assert.equal(json(2).previous, 'r1');
  fill(2, second); task('finish', `${base}/r2`);
  assert.match(task('start', 'main..feature', '--pr', '7', '--cold'), /Started cold round r3: cold was requested/);
  git('checkout', '-q', '-B', 'feature', 'main'); put('app/y.ts', 'three\n'); commit('rewritten');
  assert.match(task('start', 'main..feature', '--pr', '7'), /Started cold round r4: r3 did not finish/);
  refuses(['start', 'nope'], /unknown review target/);
}));

test('every team library in this repository matches its generated review', () => {
  for (const domain of readdirSync(path.join(root, 'domains'))) {
    const skills = path.join(root, 'domains', domain, 'skills');
    for (const skill of existsSync(skills) ? readdirSync(skills) : []) {
      const rules = path.join(skills, skill, 'references/rules');
      if (existsSync(path.join(rules, 'team.json'))) run('--library', rules, '--check');
    }
  }
});

test('Perps rows name real checks, and each check in a review has exactly one row', () => {
  const pack = JSON.parse(read(perps, 'references/pack.json'));
  const { rows, clients } = JSON.parse(read(perps, 'references/team.json'));
  const ids = new Set(pack.families.map(family => family.id));
  for (const [id, row] of Object.entries(rows)) {
    assert.ok(ids.has(id), `team.json names unknown check ${id}`);
    for (const client of row.clients ?? []) assert.ok(clients.includes(client), `${id}: unknown client ${client}`);
  }
  const overlays = { mobile: 'metamask-mobile', extension: 'metamask-extension', core: 'core', terminal: 'va-mmcx-terminal' };
  for (const [client, repo] of Object.entries(overlays)) {
    const steps = `${read(perps, 'skill.md')}\n${read(perps, `repos/${repo}.md`)}`.split(/^- \[ \] /m).slice(1);
    for (const family of pack.families) {
      const linked = steps.filter(step => new RegExp(`${family.file}#${family.id}(?![a-z0-9-])`).test(step)).length;
      assert.equal(linked, !family.clients || family.clients.includes(client) ? 1 : 0, `${client}: ${family.id}`);
    }
    for (const step of steps) assert.ok([...step.matchAll(/See references\/[a-z-]+\.md#/g)].length <= 1, `${client}: one row links one check`);
  }
});
