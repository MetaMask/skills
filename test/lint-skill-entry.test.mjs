import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, test } from 'node:test';
import {
  BASE_DESCRIPTION_MIN,
  BUNDLE_DIRS,
  DESCRIPTION_MAX,
  KNOWN_FRONTMATTER,
  KNOWN_KNOWLEDGE_FRONTMATTER,
} from '../tools/skill-schema.mjs';

const LINTER = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '.github',
  'scripts',
  'lint-skill-entry.mjs',
);

const roots = [];

function makeRoot() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'skill-lint-'));
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop(), { recursive: true, force: true });
  }
});

function writeSkill(root, domain, name, frontmatter, body) {
  const dir = path.join(root, 'domains', domain, 'skills', name);
  mkdirSync(dir, { recursive: true });
  const defaultBody = '## When To Use\n\n- always\n\n## Workflow\n\n1. do the thing\n';
  writeFileSync(path.join(dir, 'skill.md'), `---\n${frontmatter}\n---\n\n${body ?? defaultBody}`);
  return dir;
}

function lint(root, ...paths) {
  const result = spawnSync(process.execPath, [LINTER, ...paths], {
    env: { ...process.env, SKILLS_LINT_ROOT: root },
    encoding: 'utf8',
  });
  return { code: result.status, output: `${result.stdout}${result.stderr}` };
}

describe('lint-skill-entry', () => {
  test('a well-formed skill passes', () => {
    const root = makeRoot();
    writeSkill(root, 'testing', 'unit-testing', 'name: unit-testing\ndescription: Write unit tests');
    assert.equal(lint(root).code, 0);
  });

  test('missing name fails', () => {
    const root = makeRoot();
    writeSkill(root, 'testing', 'unit-testing', 'description: x');
    const { code, output } = lint(root);
    assert.equal(code, 1);
    assert.match(output, /missing required `name`/u);
  });

  test('name not matching the directory fails', () => {
    const root = makeRoot();
    writeSkill(root, 'testing', 'unit-testing', 'name: wrong-name\ndescription: x');
    const { code, output } = lint(root);
    assert.equal(code, 1);
    assert.match(output, /must match the directory/u);
  });

  // `workflows/` was the live failure mode this audit surfaced on `main`: 14 files across
  // two web3-tools skills, referenced 22 times, never shipped. It is now IN the bundle
  // list, so the guarantee to test is the general one — a sibling the installer does not
  // copy must fail, whatever it is called.
  test('a sibling directory the installer does not ship fails', () => {
    const root = makeRoot();
    const dir = writeSkill(root, 'testing', 'unit-testing', 'name: unit-testing\ndescription: x');
    mkdirSync(path.join(dir, 'playbooks'));
    const { code, output } = lint(root);
    assert.equal(code, 1, output);
    assert.match(output, /unexpected directory "playbooks\/"/u);
  });

  test('every directory in BUNDLE_DIRS is accepted as a sibling', () => {
    const root = makeRoot();
    const dir = writeSkill(root, 'testing', 'unit-testing', 'name: unit-testing\ndescription: x');
    for (const bundle of BUNDLE_DIRS) {
      mkdirSync(path.join(dir, bundle), { recursive: true });
    }
    const { code, output } = lint(root);
    assert.equal(code, 0, output);
  });

  test('a knowledge/ sibling directory fails (the conversion guarantee)', () => {
    const root = makeRoot();
    const dir = writeSkill(root, 'perps', 'fix-bug', 'name: fix-bug\ndescription: x');
    mkdirSync(path.join(dir, 'knowledge'));
    const { code, output } = lint(root);
    assert.equal(code, 1);
    assert.match(output, /knowledge/u);
  });

  test('an mms- prefix in the source name fails', () => {
    const root = makeRoot();
    writeSkill(root, 'testing', 'mms-unit', 'name: mms-unit\ndescription: x');
    const { code, output } = lint(root);
    assert.equal(code, 1);
    assert.match(output, /prefix/u);
  });

  test('a description over the budget fails', () => {
    const root = makeRoot();
    // Derived from the constant: a hardcoded length silently stops testing the boundary
    // the moment the budget moves.
    writeSkill(root, 'testing', 'unit-testing', `name: unit-testing\ndescription: ${'x'.repeat(DESCRIPTION_MAX + 1)}`);
    const { code, output } = lint(root);
    assert.equal(code, 1);
    assert.match(output, /over the \d+-char budget/u);
  });

  test('an invalid maturity value fails', () => {
    const root = makeRoot();
    writeSkill(root, 'testing', 'unit-testing', 'name: unit-testing\ndescription: x\nmaturity: beta');
    const { code, output } = lint(root);
    assert.equal(code, 1);
    assert.match(output, /maturity/u);
  });

  test('alwaysApply: true fails (on-demand-only contract)', () => {
    const root = makeRoot();
    writeSkill(root, 'testing', 'unit-testing', 'name: unit-testing\ndescription: x\nalwaysApply: true');
    const { code, output } = lint(root);
    assert.equal(code, 1);
    assert.match(output, /on-demand/u);
  });
});

describe('schema tracks the installer', () => {
  // The schema and tools/install (Bash) describe the same facts in two languages. The
  // comment in skill-schema.mjs asks a human to keep them in sync; these check it.
  //
  // Drift here is not cosmetic. `workflows/` existed in two web3-tools skills, was
  // referenced 17 times from their bodies, and was absent from the installer's bundle
  // list — so every installed copy carried 17 dangling links, and nothing reported it.
  const INSTALL = readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'tools', 'install'),
    'utf8',
  );

  test('BUNDLE_DIRS matches the directories tools/install copies', () => {
    const m = /for bundle in ([\w\s]+); do/u.exec(INSTALL);
    assert.ok(m, 'could not find the bundle loop in tools/install');
    const shipped = m[1].trim().split(/\s+/u);
    assert.deepEqual(
      [...shipped].sort(),
      [...BUNDLE_DIRS].sort(),
      'tools/install ships a different set of directories than BUNDLE_DIRS declares',
    );
  });

  test('the schema declares every frontmatter key tools/install reads', () => {
    const read = [...INSTALL.matchAll(/frontmatter_value\s+"\$\w+"\s+"([\w-]+)"/gu)].map((x) => x[1]);
    assert.ok(read.length > 0, 'expected frontmatter_value calls in tools/install');
    const known = new Set([...KNOWN_FRONTMATTER, ...KNOWN_KNOWLEDGE_FRONTMATTER]);
    assert.deepEqual(
      [...new Set(read)].filter((k) => !known.has(k)),
      [],
      'tools/install reads a frontmatter key the schema does not declare',
    );
  });
});

// The workflow invokes the linter WITH changed-file arguments. Every test above runs the
// no-argument full-audit branch, so the branch CI actually depends on had no coverage —
// which is how malformed paths reached main. These mirror the CI invocation.
// 1,536 is a repo budget, not an operator limit — no observed operator rejects or
// truncates a longer description, and several over 1,024 install and load today. The
// check exists to bound always-on context, so what matters is that the number the docs
// state and the number enforced are the same one.
describe('description budget', () => {
  test('the enforced ceiling is the one the docs state', () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    for (const doc of ['README.md', 'CONTRIBUTING.md', path.join('.github', 'SKILL_TEMPLATE.md')]) {
      const body = readFileSync(path.join(root, doc), 'utf8');
      const stated = [...body.matchAll(/(\d[\d,]*)[- ]?character|≤([\d,]+) chars|within ([\d,]+) characters/gu)]
        .flatMap((m) => [m[1], m[2], m[3]])
        .filter(Boolean)
        .map((n) => Number(n.replace(/,/gu, '')))
        .filter((n) => n > 100);
      for (const n of stated) {
        assert.equal(n, DESCRIPTION_MAX, `${doc} states ${n} but the schema enforces ${DESCRIPTION_MAX}`);
      }
    }
  });
});

describe('changed-files mode', () => {
  test('a changed skill.md is linted', () => {
    const root = makeRoot();
    writeSkill(root, 'testing', 'unit-testing', 'name: unit-testing\ndescription: x');
    const { code, output } = lint(root, 'domains/testing/skills/unit-testing/skill.md');
    assert.equal(code, 0, output);
    assert.match(output, /1 skill\(s\) checked/u);
  });

  test('a changed reference file maps back to its skill root', () => {
    const root = makeRoot();
    const dir = writeSkill(root, 'testing', 'unit-testing', 'name: wrong-name\ndescription: x');
    mkdirSync(path.join(dir, 'references'), { recursive: true });
    writeFileSync(path.join(dir, 'references', 'foo.md'), '# foo\n');
    const { code, output } = lint(root, 'domains/testing/skills/unit-testing/references/foo.md');
    assert.equal(code, 1, output);
    assert.match(output, /must match the directory/u, 'should lint the owning skill, not just the file');
  });

  test('a malformed domains path fails', () => {
    const root = makeRoot();
    writeSkill(root, 'testing', 'unit-testing', 'name: unit-testing\ndescription: x');
    const { code, output } = lint(root, 'domains/testing/bar/skill.md');
    assert.equal(code, 1, output);
    assert.match(output, /is not under domains\/<domain>\/skills\/<name>\//u);
  });

  test('a domain knowledge file is accepted and linted', () => {
    const root = makeRoot();
    const dir = path.join(root, 'domains', 'testing', 'knowledge');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, 'testing-layers.md'),
      '---\nname: testing-layers\ndomain: testing\ndescription: Layer policy\n---\n\n# Layers\n',
    );
    const { code, output } = lint(root, 'domains/testing/knowledge/testing-layers.md');
    assert.equal(code, 0, output);
    assert.match(output, /1 knowledge file\(s\) checked/u);
  });

  test('a knowledge file with mismatched domain fails', () => {
    const root = makeRoot();
    const dir = path.join(root, 'domains', 'testing', 'knowledge');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, 'testing-layers.md'),
      '---\nname: testing-layers\ndomain: perps\ndescription: Layer policy\n---\n\n# Layers\n',
    );
    const { code, output } = lint(root, 'domains/testing/knowledge/testing-layers.md');
    assert.equal(code, 1, output);
    assert.match(output, /must match the parent domain/u);
  });

  test('a knowledge file with mismatched name fails', () => {
    const root = makeRoot();
    const dir = path.join(root, 'domains', 'testing', 'knowledge');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, 'testing-layers.md'),
      '---\nname: wrong-name\ndomain: testing\ndescription: Layer policy\n---\n\n# Layers\n',
    );
    const { code, output } = lint(root, 'domains/testing/knowledge/testing-layers.md');
    assert.equal(code, 1, output);
    assert.match(output, /must match the filename stem/u);
  });

  test('a changed path whose skill.md is missing is reported, not skipped', () => {
    const root = makeRoot();
    // Skill-shaped directory, no skill.md — the case that previously printed
    // "0 skill(s) checked, 0 error(s)" and exited 0.
    mkdirSync(path.join(root, 'domains', 'testing', 'skills', 'ghost', 'references'), {
      recursive: true,
    });
    writeFileSync(path.join(root, 'domains', 'testing', 'skills', 'ghost', 'references', 'a.md'), 'x');
    const { code, output } = lint(root, 'domains/testing/skills/ghost/references/a.md');
    assert.equal(code, 1, output);
    assert.match(output, /has no readable skill\.md/u);
  });

  test('a filename containing spaces survives argv handling', () => {
    const root = makeRoot();
    const dir = writeSkill(root, 'testing', 'unit-testing', 'name: unit-testing\ndescription: x');
    writeFileSync(path.join(dir, 'references file.md'), '# spaced\n');
    const { code, output } = lint(root, 'domains/testing/skills/unit-testing/references file.md');
    assert.equal(code, 0, output);
    assert.match(output, /1 skill\(s\) checked/u, 'the path should resolve as one argument');
  });

  test('warnings-only input exits 0', () => {
    const root = makeRoot();
    writeSkill(root, 'testing', 'unit-testing', 'name: unit-testing\ndescription: x', '# no sections\n');
    const { code, output } = lint(root, 'domains/testing/skills/unit-testing/skill.md');
    assert.equal(code, 0, output);
    assert.match(output, /warning:/u);
  });

  // A base skill permanently occupies listing context for every engineer, so the
  // length floor has to FAIL the job. As a warning it never set a non-zero exit
  // code, which meant a thin description sat invisibly inside a green check and
  // "CI warns until it is rewritten" did not actually hold.
  test('a base skill with a short description fails, not warns', () => {
    const root = makeRoot();
    writeSkill(root, 'testing', 'unit-testing', 'name: unit-testing\ndescription: Write unit tests\nbase: true');
    const { code, output } = lint(root);
    assert.equal(code, 1);
    assert.match(output, /base skill needs enough trigger cues/u);
  });

  test('a base skill at exactly BASE_DESCRIPTION_MIN passes', () => {
    const root = makeRoot();
    const description = 'x'.repeat(BASE_DESCRIPTION_MIN);
    writeSkill(root, 'testing', 'unit-testing', `name: unit-testing\ndescription: ${description}\nbase: true`);
    assert.equal(lint(root).code, 0);
  });

  // A short description on a NON-base skill is still fine — the cost only applies
  // to skills that load for everyone.
  test('a short description on a non-base skill still passes', () => {
    const root = makeRoot();
    writeSkill(root, 'testing', 'unit-testing', 'name: unit-testing\ndescription: Write unit tests');
    assert.equal(lint(root).code, 0);
  });

  // `on` was accepted by this linter alone. tools/install, tools/sync and the CLI
  // all match 1/true/yes only, so `base: on` linted clean as a base skill while the
  // installer silently skipped it.
  test('`base: on` is not treated as truthy', () => {
    const root = makeRoot();
    const short = 'Write unit tests';
    writeSkill(root, 'testing', 'unit-testing', `name: unit-testing\ndescription: ${short}\nbase: on`);
    const { code, output } = lint(root);
    // Not base -> the length floor must not fire; it is flagged as unrecognised instead.
    assert.equal(code, 0);
    assert.match(output, /neither truthy nor falsy/u);
  });

  test('a description of exactly DESCRIPTION_MAX passes, +1 fails', () => {
    const atLimit = makeRoot();
    writeSkill(atLimit, 'testing', 'unit-testing', `name: unit-testing\ndescription: ${'x'.repeat(DESCRIPTION_MAX)}`);
    assert.equal(lint(atLimit, 'domains/testing/skills/unit-testing/skill.md').code, 0);

    const overLimit = makeRoot();
    writeSkill(overLimit, 'testing', 'unit-testing', `name: unit-testing\ndescription: ${'x'.repeat(DESCRIPTION_MAX + 1)}`);
    const { code, output } = lint(overLimit, 'domains/testing/skills/unit-testing/skill.md');
    assert.equal(code, 1, output);
    assert.match(output, /over the \d+-char budget/u);
  });
});

describe('cross-reference checks', () => {
  const FM = 'name: probe\ndescription: A probe skill';
  const SECTIONS = '## When To Use\n\n- always\n\n## Workflow\n\n1. do the thing\n';

  test('a lane id in the description fails', () => {
    const root = makeRoot();
    writeSkill(root, 'testing', 'probe', 'name: probe\ndescription: Runs the B7 lane');
    const { code, output } = lint(root);
    assert.equal(code, 1, output);
    assert.match(output, /cites a bare lane id \(B7\)/u);
  });

  test('a lane id in the body warns, naming the line the reader sees', () => {
    const root = makeRoot();
    const dir = writeSkill(root, 'testing', 'probe', FM, `${SECTIONS}\nSee B7 for details.\n`);

    // Derived by scanning the written file, not by repeating the linter's arithmetic. The
    // frontmatter it strips is exactly what shifts the numbers, so a test that recomputed
    // the offset the same way would agree with the defect it exists to catch.
    const lines = readFileSync(path.join(dir, 'skill.md'), 'utf8').split('\n');
    const expected = lines.findIndex((line) => line.includes('See B7')) + 1;
    assert.ok(expected > 1, 'the fixture must place the citation below the frontmatter');

    const { code, output } = lint(root);
    assert.equal(code, 0, output);
    assert.match(output, new RegExp(`line ${expected} cites lane B7`, 'u'));
  });

  test('a lane id on a line that links the catalog is accepted', () => {
    const root = makeRoot();
    const body = '## When To Use\n\n- always\n\n## Workflow\n\n1. Run B7, per [the catalog](references/evidence-catalog.md).\n';
    writeSkill(root, 'testing', 'probe', FM, body);
    const { code, output } = lint(root);
    assert.equal(code, 0, output);
    assert.doesNotMatch(output, /cites lane/u);
  });

  test('the skill that owns the catalog may use lane ids freely', () => {
    const root = makeRoot();
    const dir = writeSkill(root, 'testing', 'probe', 'name: probe\ndescription: Runs the B7 lane', `${SECTIONS}\nRun B7.\n`);
    mkdirSync(path.join(dir, 'references'), { recursive: true });
    writeFileSync(path.join(dir, 'references', 'evidence-catalog.md'), '# catalog\n');
    const { code, output } = lint(root);
    assert.equal(code, 0, output);
    assert.doesNotMatch(output, /lane id|cites lane/u, 'the skill that defines the ids is exempt');
  });

  test('a private-vault wiki link fails', () => {
    const root = makeRoot();
    writeSkill(root, 'testing', 'probe', FM, `${SECTIONS}\nSee [[some_note]].\n`);
    const { code, output } = lint(root);
    assert.equal(code, 1, output);
    assert.match(output, /`\[\[some_note\]\]` is a private-vault wiki link/u);
  });

  test('a nested JS array literal is not a wiki link', () => {
    const root = makeRoot();
    writeSkill(root, 'testing', 'probe', FM, `${SECTIONS}\nPass \`[[signer1.address, signer2.address]]\`.\n`);
    const { code, output } = lint(root);
    assert.equal(code, 0, output);
    assert.doesNotMatch(output, /wiki link/u, 'workflow snippets must not trip the vault-link rule');
  });

  test('`## Related` naming a skill that does not exist warns without failing', () => {
    const root = makeRoot();
    writeSkill(root, 'testing', 'probe', FM, `${SECTIONS}\n## Related\n\n- \`no-such-skill\`\n`);
    const { code, output } = lint(root);
    assert.equal(code, 0, output, 'a forward reference to a concurrent PR must not block the branch');
    assert.match(output, /links `no-such-skill`, which is not a skill on this branch/u);
  });

  test('`## Related` naming an existing sibling is accepted', () => {
    const root = makeRoot();
    writeSkill(root, 'testing', 'sibling-skill', 'name: sibling-skill\ndescription: A sibling');
    writeSkill(root, 'testing', 'probe', FM, `${SECTIONS}\n## Related\n\n- \`sibling-skill\`\n`);
    const { code, output } = lint(root);
    assert.equal(code, 0, output);
    assert.doesNotMatch(output, /is not a skill on this branch/u);
  });

  test('`## Related` may name the skill itself', () => {
    const root = makeRoot();
    writeSkill(root, 'testing', 'probe', FM, `${SECTIONS}\n## Related\n\n- \`probe\`\n`);
    const { output } = lint(root);
    assert.doesNotMatch(output, /is not a skill on this branch/u);
    // Guards the behaviour, not the `name !== skill.name` clause that appears to deliver
    // it: the linted skill is collected from the same tree as the known-name set, so its
    // own name is always in that set and the clause never decides this case. Deleting the
    // clause leaves this test green — which is how it was found.
  });

  test('`## Related` ends at the next heading', () => {
    const root = makeRoot();
    const body = `${SECTIONS}\n## Related\n\n- \`inside-the-section\`\n\n## Notes\n\n- \`outside-the-section\`\n`;
    writeSkill(root, 'testing', 'probe', FM, body);
    const { output } = lint(root);
    assert.match(output, /links `inside-the-section`/u);
    assert.doesNotMatch(
      output,
      /outside-the-section/u,
      'a backticked token after the next heading is not a Related entry',
    );
  });
});
