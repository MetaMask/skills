import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, test } from 'node:test';

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
