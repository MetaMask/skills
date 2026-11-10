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
    const rules = { shared: 'Check shared state', mobile: 'Check native gestures', extension: 'Check background messages', core: 'Check package exports', terminal: 'Check provider boundary' };
    for (const [client, rule] of Object.entries(rules)) {
      writeFileSync(path.join(library, `review/antipatterns${client === 'shared' ? '' : `.${client}`}.md`), `# Rules\n\n## ${rule}\n\nA standing invariant for \`src/**/fees.ts\` spans\ntwo physical lines.\n\n- **Failure case**: Inspect the ${client} failure and its callers.\n  - Preserve this nested example.\n`);
    }
    for (const file of ['parity', 'shared-packages']) writeFileSync(path.join(library, `review/${file}.md`), '# Reference\nContext\n');
    writeFileSync(path.join(library, 'review/report-template.md'), '# Posted review template\n\nCopy this filled example; keep its order and marks.\n');
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
    for (const [client, repo] of Object.entries({ mobile: 'metamask-mobile', extension: 'metamask-extension', core: 'core', terminal: 'va-mmcx-terminal' })) {
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

test('direct delegations and the compact report template survive installation and inline output', () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'perps-delegation-'));
  try {
    const library = path.join(temp, 'library');
    const source = path.join(temp, 'source');
    const skill = path.join(source, 'domains/perps/skills/perps-review-pr');
    mkdirSync(path.join(library, 'review'), { recursive: true });
    const skip = 'Skip this delegation when `perps-review-pr` runs as a capability under `pr-workflow/review-pr`; that router already owns specialist routing.';
    const shared = 'Run `domains/testing/skills/test-i18n-usage` by name when locale assertions change. ' + skip;
    const mobile = 'Run `domains/testing/skills/mobile-testing` by name for application behavior or test changes. ' + skip;
    const extension = 'Run `domains/testing/skills/extension-testing` by name for application behavior or test changes. ' + skip;
    writeFileSync(path.join(library, 'review/antipatterns.md'), '# Shared\n\n## Locale checks\n\n> Delegate: ' + shared + '\n\n- **Perps invariant**: Preserve financial units.\n');
    for (const [client, delegation] of [['mobile', mobile], ['extension', extension], ['core', null], ['terminal', null]]) {
      writeFileSync(path.join(library, `review/antipatterns.${client}.md`), '# Rules\n\n## Client checks\n\n' + (delegation ? '> Delegate: ' + delegation + '\n' : 'Keep the client contract.\n'));
    }
    for (const name of ['parity', 'shared-packages']) writeFileSync(path.join(library, `review/${name}.md`), '# Reference\n');
    const report = '# Posted review template\n\nCopy the filled example; keep its order and marks.\n\nVERDICT: REQUEST_CHANGES\n\n<details>\n<summary>Details for agents</summary>\n\nFull ledger: artifacts/review-ledger.md\n\n</details>\n';
    writeFileSync(path.join(library, 'review/report-template.md'), report);
    writeFileSync(path.join(library, 'owned-paths.json'), JSON.stringify({ domain: 'perps', repos: { mobile: ['app/perps'] } }));
    const git = (...args) => execFileSync('git', ['-C', library, ...args], { stdio: 'pipe' });
    git('init'); git('add', '.');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'test: seed delegated review rules');
    execFileSync(process.execPath, [generator, '--library', library, '--out', skill], { stdio: 'pipe' });
    const target = path.join(temp, 'mobile'); mkdirSync(target);
    execFileSync('bash', [path.join(root, 'tools/install'), '--source', source, '--target', target, '--repo', 'metamask-mobile', '--domain', 'none', '--include', 'perps-review-pr'], { stdio: 'pipe' });
    const installed = path.join(target, '.agents/skills/mms-perps-review-pr');
    const body = readFileSync(path.join(installed, 'SKILL.md'), 'utf8');
    for (const delegation of [shared, mobile]) assert.ok(body.split('\n').includes('- [ ] ' + delegation), delegation);
    assert.equal(body.includes('> Delegate:'), false);
    assert.equal(readFileSync(path.join(installed, 'references/report-template.md'), 'utf8'), report);
    assert.ok(body.includes('Write artifacts/review.md from references/report-template.md; full ledger to artifacts/review-ledger.md'));
    assert.ok(body.includes('Copy this template'));
    assert.ok(body.includes('keep its order and marks'));
    assert.equal(body.includes('COMMENT is only for a draft'), false);
    assert.equal(body.includes('Summary, Criteria outcomes, Findings, Evidence'), false);
    assert.equal(body.includes('Client checks:'), false, 'a delegation-only section is an action, not an empty criterion family');
    const inline = path.join(temp, 'inline.md');
    execFileSync(process.execPath, [generator, '--library', library, '--out', skill, '--analyzer-out', inline, '--client', 'mobile'], { stdio: 'pipe' });
    const analyzer = readFileSync(inline, 'utf8');
    for (const delegation of [shared, mobile]) assert.ok(analyzer.split('\n').includes('- [ ] ' + delegation));
    assert.ok(analyzer.includes(report));
    assert.ok(analyzer.includes('the posted review template below'));
    assert.ok(analyzer.includes('a separate full-ledger section of the analyzer response'));
    assert.equal(analyzer.includes('from references/report-template.md'), false);
    const extensionBody = readFileSync(path.join(skill, 'repos/metamask-extension.md'), 'utf8');
    assert.ok(extensionBody.split('\n').includes('- [ ] ' + extension));
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
