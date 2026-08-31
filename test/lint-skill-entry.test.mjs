import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, test } from 'node:test';
import {
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
