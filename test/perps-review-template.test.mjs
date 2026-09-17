import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const generator = fileURLToPath(new URL('../domains/perps/skills/perps-review-pr/scripts/materialize-review.mjs', import.meta.url));

const committed = fileURLToPath(new URL('../domains/perps/skills/perps-review-pr/', import.meta.url));
const withoutFrontmatter = text => text.replace(/^---\n[\s\S]*?\n---\n+/, '');

// The canonical library is not available to this repository's CI, so the public
// guard is equality of the two committed copies: a hand edit to either fails here.
test('committed review skill and execution template carry the same checklist', () => {
  const skill = readFileSync(path.join(committed, 'skill.md'), 'utf8');
  const template = readFileSync(path.join(committed, 'references/templates/review-pr/static-perps.md'), 'utf8');
  assert.equal(withoutFrontmatter(skill), withoutFrontmatter(template));
  assert.ok(withoutFrontmatter(skill).trim().length > 0);
});

test('review skill, execution template and analyzer preserve canonical criteria and detect drift', () => {
  const work = mkdtempSync(path.join(os.tmpdir(), 'perps-template-'));
  try {
    const library = path.join(work, 'library');
    const out = path.join(work, 'skill');
    mkdirSync(path.join(library, 'review'), { recursive: true });
    const sources = ['antipatterns.md', 'antipatterns.extension.md', 'antipatterns.core.md', 'parity.md', 'shared-packages.md'];
    for (const [i, file] of sources.entries()) writeFileSync(path.join(library, 'review', file), `# Standard\n\n## Rule ${i}\n\nExact canonical criterion ${i}: preserve account identity.\n`);
    writeFileSync(path.join(library, 'owned-paths.json'), JSON.stringify({ domain: 'perps', repos: { core: ['packages/perps-controller/**'] } }));
    for (const args of [['init', '-q'], ['add', '.'], ['-c', 'user.name=Test', '-c', 'user.email=test@example.test', 'commit', '-qm', 'test: record canonical rules']]) {
      const result = spawnSync('git', args, { cwd: library, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
    const analyzer = path.join(work, 'prompt-context.md');
    const args = [generator, '--library', library, '--out', out, '--analyzer-out', analyzer];
    const generate = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(generate.status, 0, generate.stderr);
    const body = text => text.replace(/^---\n[\s\S]*?\n---\n+/, '');
    assert.match(readFileSync(path.join(out, 'agents/openai.yaml'), 'utf8'), /allow_implicit_invocation: false/);
    const skill = readFileSync(path.join(out, 'skill.md'), 'utf8');
    const template = readFileSync(path.join(out, 'references/templates/review-pr/static-perps.md'), 'utf8');
    assert.equal(body(skill), body(template));
    assert.equal(body(skill), readFileSync(analyzer, 'utf8'));
    for (const i of sources.keys()) assert.ok(skill.includes(`Exact canonical criterion ${i}: preserve account identity.`));
    const provenance = JSON.parse(readFileSync(path.join(out, 'references/review-sources.json')));
    assert.equal(Object.keys(provenance.files).length, sources.length + 1);
    assert.match(provenance.revision, /^[a-f0-9]{40}$/);
    assert.equal(spawnSync(process.execPath, [...args, '--check']).status, 0);
    writeFileSync(path.join(out, 'skill.md'), skill.replace('Exact canonical criterion 0', 'Unreviewed replacement'));
    assert.notEqual(spawnSync(process.execPath, [...args, '--check']).status, 0);
    writeFileSync(path.join(library, 'review/antipatterns.md'), '# Standard\n## New unchecked rule\nChanged locally.\n');
    assert.notEqual(spawnSync(process.execPath, args).status, 0, 'uncommitted rules cannot produce a misleading revision stamp');
  } finally { rmSync(work, { recursive: true, force: true }); }
});
