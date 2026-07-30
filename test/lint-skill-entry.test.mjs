import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, test } from 'node:test';
import {
  BUNDLE_DIRS,
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

function lint(root) {
  const result = spawnSync(process.execPath, [LINTER], {
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

  test('a description over the operator ceiling fails', () => {
    const root = makeRoot();
    writeSkill(root, 'testing', 'unit-testing', `name: unit-testing\ndescription: ${'x'.repeat(1100)}`);
    const { code, output } = lint(root);
    assert.equal(code, 1);
    assert.match(output, /operator ceiling/u);
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
