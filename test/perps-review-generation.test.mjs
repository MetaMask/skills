import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));
const generator = path.join(root, 'domains/perps/skills/perps-review-pr/scripts/materialize-review.mjs');

test('generated shared and client checks compose through the standard installer without a second catalog', () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'perps-checklist-'));
  try {
    const library = path.join(temp, 'library');
    const source = path.join(temp, 'source');
    const skill = path.join(source, 'domains/perps/skills/perps-review-pr');
    mkdirSync(path.join(library, 'review'), { recursive: true });
    const rules = { shared: 'Check shared state', mobile: 'Check native gestures', extension: 'Check background messages', core: 'Check package exports' };
    for (const [client, rule] of Object.entries(rules)) {
      writeFileSync(path.join(library, `review/antipatterns${client === 'shared' ? '' : `.${client}`}.md`), `# Rules\n\n## ${rule}\n\nA standing invariant for \`src/**/fees.ts\` spans\ntwo physical lines.\n\n- **Failure case**: Inspect the ${client} failure and its callers.\n  - Preserve this nested example.\n`);
    }
    for (const file of ['parity', 'shared-packages']) writeFileSync(path.join(library, `review/${file}.md`), '# Reference\nContext\n');
    writeFileSync(path.join(library, 'owned-paths.json'), JSON.stringify({ domain: 'perps', repos: { mobile: ['app/perps'] } }));
    const git = (...args) => execFileSync('git', ['-C', library, ...args], { stdio: 'pipe' });
    git('init'); git('add', '.');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'test: seed review rules');
    mkdirSync(path.join(skill, 'references/templates/review-pr'), { recursive: true });
    writeFileSync(path.join(skill, 'references/templates/review-pr/old.md'), 'old duplicate');
    const generate = (...extra) => execFileSync(process.execPath, [generator, '--library', library, '--out', skill, ...extra], { encoding: 'utf8', stdio: 'pipe' });
    generate(); generate('--check');
    assert.equal(existsSync(path.join(skill, 'references/templates/review-pr/old.md')), false);
    assert.match(readFileSync(path.join(skill, 'references/shared.md'), 'utf8'), /two physical lines/);
    assert.match(readFileSync(path.join(skill, 'references/shared.md'), 'utf8'), /  - Preserve this nested example/);
    for (const [client, repo] of Object.entries({ mobile: 'metamask-mobile', extension: 'metamask-extension', core: 'core' })) {
      const target = path.join(temp, client); mkdirSync(target);
      execFileSync('bash', [path.join(root, 'tools/install'), '--source', source, '--target', target, '--repo', repo, '--domain', 'none', '--include', 'perps-review-pr'], { stdio: 'pipe' });
      const installed = path.join(target, '.agents/skills/mms-perps-review-pr');
      const body = readFileSync(path.join(installed, 'SKILL.md'), 'utf8');
      assert.ok(body.includes(rules.shared)); assert.ok(body.includes(rules[client]));
      assert.ok(body.includes("`src/**/fees.ts`"), "scan summaries preserve recursive glob paths");
      for (const other of Object.keys(rules).filter(x => x !== client && x !== 'shared')) assert.ok(!body.includes(rules[other]));
      assert.equal((body.match(/## Verdict and handoff/g) || []).length, 1);
      for (const [, file, anchor] of body.matchAll(/See (references\/[^#\s]+)#([^\s]+)/g)) {
        assert.ok(readFileSync(path.join(installed, file), 'utf8').includes(`id="${anchor}"`), `${repo}: broken criterion link`);
      }
      const analyzer = path.join(temp, client + '.md');
      generate('--analyzer-out', analyzer, '--client', client);
      const inline = readFileSync(analyzer, 'utf8');
      assert.ok(inline.includes(`Inspect the ${client} failure`));
      assert.ok(!inline.includes('See references/'));
    }
    writeFileSync(path.join(skill, 'references/mobile.md'), 'stale');
    assert.throws(() => generate('--check'), /stale/);
    generate();
    writeFileSync(path.join(library, 'review/antipatterns.mobile.md'), '# changed');
    assert.throws(() => generate(), /Commit the canonical review sources/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
