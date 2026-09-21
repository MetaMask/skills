import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const generator = path.join(repoRoot, 'domains/perps/skills/perps-review-pr/scripts/materialize-review.mjs');
const committed = path.join(repoRoot, 'domains/perps/skills/perps-review-pr');
const installer = process.env.SKILLS_INSTALLER || path.join(repoRoot, 'tools/install');

const CLIENTS = { mobile: 'metamask-mobile', extension: 'metamask-extension', core: 'core' };
const body = text => text.replace(/^---\n[\s\S]*?\n---\n+/, '').trim();

// The installer merges a skill as `base body + "\n\n" + overlay body`, so a client's
// execution template must be exactly what that client's install produces.
function assertMergedTemplates(dir) {
  const base = body(readFileSync(path.join(dir, 'skill.md'), 'utf8'));
  assert.ok(base.length > 0);
  for (const [client, repo] of Object.entries(CLIENTS)) {
    const overlay = body(readFileSync(path.join(dir, `repos/${repo}.md`), 'utf8'));
    const template = body(readFileSync(path.join(dir, `references/templates/review-pr/static-perps.${client}.md`), 'utf8'));
    assert.equal(template, `${base}\n\n${overlay}`, `${client} template must equal the merged install`);
  }
  return base;
}

function assertCriteriaReferencesResolve(dir) {
  const checklists = ['skill.md', ...Object.values(CLIENTS).map(repo => `repos/${repo}.md`)];
  const referenced = [];
  for (const file of checklists) {
    for (const match of readFileSync(path.join(dir, file), 'utf8').matchAll(/See (references\/criteria\/\S+\.md)$/gmu)) {
      assert.ok(existsSync(path.join(dir, match[1])), `${file} references a missing ${match[1]}`);
      referenced.push(match[1]);
    }
  }
  assert.ok(referenced.length > 0);
  return referenced;
}

test('committed review skill, overlays and per-client templates carry the same merged checklist', () => {
  assertMergedTemplates(committed);
  assertCriteriaReferencesResolve(committed);
  assert.equal(existsSync(path.join(committed, 'references/templates/review-pr/static-perps.md')), false, 'the single client-agnostic template is replaced by the per-client set');
});

test('generated review keeps canonical criteria per client and detects drift', () => {
  const work = mkdtempSync(path.join(os.tmpdir(), 'perps-template-'));
  try {
    const library = path.join(work, 'library');
    const out = path.join(work, 'skill');
    mkdirSync(path.join(library, 'review'), { recursive: true });
    const families = {
      'review/antipatterns.md': ['Shared Family One', 'Shared Family Two'],
      'review/antipatterns.extension.md': ['Extension Family'],
      'review/antipatterns.core.md': ['Core Family'],
    };
    const detail = title => `Exact canonical criterion for ${title}: preserve account identity.\n\n- **Detail** that must survive verbatim in ${title}.`;
    for (const [file, titles] of Object.entries(families)) {
      writeFileSync(path.join(library, file), `# Standard\n\n${titles.map(title => `## ${title}\n\n${detail(title)}\n`).join('\n')}`);
    }
    writeFileSync(path.join(library, 'review/parity.md'), '# Parity\n\nMobile is the reference implementation.\n');
    writeFileSync(path.join(library, 'review/shared-packages.md'), '# Shared packages\n\nThe published controller surface.\n');
    writeFileSync(path.join(library, 'owned-paths.json'), JSON.stringify({ domain: 'perps', repos: { core: ['packages/perps-controller/**'] } }));
    for (const args of [['init', '-q'], ['add', '.'], ['-c', 'user.name=Test', '-c', 'user.email=test@example.test', 'commit', '-qm', 'test: record canonical rules']]) {
      const result = spawnSync('git', args, { cwd: library, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
    const args = [generator, '--library', library, '--out', out];
    const generate = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(generate.status, 0, generate.stderr);

    assertMergedTemplates(out);
    assert.match(readFileSync(path.join(out, 'agents/openai.yaml'), 'utf8'), /allow_implicit_invocation: false/);

    // Each family becomes exactly one row, in the checklist its client reads.
    const home = { 'Shared Family One': 'skill.md', 'Shared Family Two': 'skill.md', 'Extension Family': 'repos/metamask-extension.md', 'Core Family': 'repos/core.md' };
    const checklists = ['skill.md', ...Object.values(CLIENTS).map(repo => `repos/${repo}.md`)];
    for (const [title, expected] of Object.entries(home)) {
      const carriers = checklists.filter(file => readFileSync(path.join(out, file), 'utf8').includes(`- [ ] ${title}:`));
      assert.deepEqual(carriers, [expected], `${title} belongs in ${expected} alone`);
    }
    // A row's reference resolves, and the file behind it holds the canonical text.
    for (const reference of assertCriteriaReferencesResolve(out)) {
      const title = Object.keys(home).find(name => reference.endsWith(`${name.toLowerCase().replace(/ /gu, '-')}.md`));
      assert.ok(title, `unexpected criteria file ${reference}`);
      assert.ok(readFileSync(path.join(out, reference), 'utf8').includes(detail(title)), `${reference} must carry the section verbatim`);
    }
    assert.equal(readFileSync(path.join(out, 'references/parity.md'), 'utf8'), readFileSync(path.join(library, 'review/parity.md'), 'utf8'));
    const provenance = JSON.parse(readFileSync(path.join(out, 'references/review-sources.json')));
    assert.equal(Object.keys(provenance.files).length, 6);
    assert.match(provenance.revision, /^[a-f0-9]{40}$/u);

    assert.equal(spawnSync(process.execPath, [...args, '--check']).status, 0);
    // A hand edit anywhere in the generated set fails the check, including a stray file.
    const drift = [
      ['skill.md', text => text.replace('Shared Family One', 'Unreviewed replacement')],
      ['repos/metamask-extension.md', text => text.replace('Extension Family', 'Unreviewed replacement')],
      ['references/criteria/perps/shared-family-one.md', text => text.replace('preserve account identity', 'do whatever')],
    ];
    for (const [file, edit] of drift) {
      const original = readFileSync(path.join(out, file), 'utf8');
      writeFileSync(path.join(out, file), edit(original));
      assert.notEqual(spawnSync(process.execPath, [...args, '--check']).status, 0, `a hand edit to ${file} must fail --check`);
      writeFileSync(path.join(out, file), original);
    }
    assert.equal(spawnSync(process.execPath, [...args, '--check']).status, 0);
    const stray = path.join(out, 'references/criteria/perps/invented-family.md');
    writeFileSync(stray, '# Invented\n');
    assert.notEqual(spawnSync(process.execPath, [...args, '--check']).status, 0, 'a file the generator does not produce must fail --check');
    // Regenerating removes it: the generator owns its output directories.
    assert.equal(spawnSync(process.execPath, args).status, 0);
    assert.equal(existsSync(stray), false);

    // The analyzer copy is per client and self-contained, because it cannot open a reference.
    const analyzer = path.join(work, 'prompt-context.md');
    assert.notEqual(spawnSync(process.execPath, [...args, '--analyzer-out', analyzer]).status, 0, '--analyzer-out without --client is a usage error');
    assert.equal(existsSync(analyzer), false);
    assert.equal(spawnSync(process.execPath, [...args, '--analyzer-out', analyzer, '--client', 'extension']).status, 0);
    const inlined = readFileSync(analyzer, 'utf8');
    for (const title of ['Shared Family One', 'Shared Family Two', 'Extension Family']) assert.ok(inlined.includes(detail(title)), `${title} must be inlined for the analyzer`);
    assert.equal(inlined.includes(detail('Core Family')), false, 'another client\'s families stay out');
    assert.doesNotMatch(inlined, /See references\/criteria\//u, 'a shell-less analyzer is never pointed at a file it cannot open');

    writeFileSync(path.join(library, 'review/antipatterns.md'), '# Standard\n## New unchecked rule\nChanged locally.\n');
    assert.notEqual(spawnSync(process.execPath, args).status, 0, 'uncommitted rules cannot produce a misleading revision stamp');
  } finally { rmSync(work, { recursive: true, force: true }); }
});

test('installing the Perps review delivers only the requested client\'s criteria', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'perps-install-'));
  try {
    // A source tree holding only the committed Perps review skill: the installer walks
    // every domain it is given, and the other skills are irrelevant to this assertion.
    const source = path.join(root, 'source');
    cpSync(committed, path.join(source, 'domains/perps/skills/perps-review-pr'), { recursive: true });
    function install(repo) {
      const target = path.join(root, repo);
      mkdirSync(target, { recursive: true });
      const result = spawnSync('/bin/bash', [installer, '--source', source, '--target', target, '--repo', repo], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stdout + result.stderr);
      return target;
    }
    const installed = file => readFileSync(file, 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '').replace(/^<!-- DO NOT EDIT[^\n]*-->\n/, '').trim();
    const template = client => body(readFileSync(path.join(committed, `references/templates/review-pr/static-perps.${client}.md`), 'utf8'));

    const mobile = path.join(install('metamask-mobile'), '.claude/skills/mms-perps-review-pr');
    const skill = installed(path.join(mobile, 'SKILL.md'));
    assert.equal(skill, template('mobile'), 'the Mobile install must match the Mobile execution template');
    // Every criteria file the installed checklist names must have been copied with it.
    const named = [...skill.matchAll(/references\/criteria\/[a-z]+\/[a-z0-9-]+\.md/g)].map(match => match[0]);
    assert.ok(named.length > 0, 'the checklist names its criteria files');
    for (const file of named) assert.ok(existsSync(path.join(mobile, file)), `criteria reference ships with the install: ${file}`);
    assert.match(skill, /^- \[ \] Signal over noise:/m, 'the base review carries the noise rule for every client');
    assert.equal(skill.includes('## Extension criteria'), false, 'a Mobile reviewer never receives the Extension criteria');
    assert.equal(skill.includes('## Core criteria'), false);
    // The criteria files all ship; only the checklist decides which are referenced.
    for (const family of ['extension', 'core']) {
      assert.equal(skill.includes(`references/criteria/${family}/`), false, `a Mobile checklist never rows a ${family} criterion`);
    }

    const extension = path.join(install('metamask-extension'), '.agents/skills/mms-perps-review-pr');
    assert.equal(installed(path.join(extension, 'SKILL.md')), template('extension'));

    const core = path.join(install('core'), '.agents/skills/mms-perps-review-pr');
    const coreSkill = installed(path.join(core, 'SKILL.md'));
    assert.equal(coreSkill, template('core'), 'the Core install must match the Core execution template');
    assert.ok(coreSkill.includes('## Core criteria'));
    assert.equal(coreSkill.includes('## Extension criteria'), false, 'a Core reviewer never receives the Extension criteria');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
