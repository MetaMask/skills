import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, describe, test } from 'node:test';

const BIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'metamask-skills.mjs');

function runCli(args, env = {}) {
  return spawnSync(process.execPath, [BIN, ...args], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    // Neutralize any source-dir env vars from the host shell so tests are deterministic.
    env: { ...process.env, METAMASK_SKILLS_DIR: '', CONSENSYS_SKILLS_DIR: '', ...env },
  });
}

describe('CLI entrypoint', () => {
  test('--help prints usage and exits 0', () => {
    const result = runCli(['--help']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /MetaMask skills CLI/u);
    assert.match(result.stdout, /metamask-skills sync/u);
  });

  test('no command prints usage and exits 0', () => {
    const result = runCli([]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage:/u);
  });

  test('unknown command exits 1 with error', () => {
    const result = runCli(['frobnicate']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unknown command: frobnicate/u);
  });
});

describe('CLI list against a fixture source', () => {
  let root;
  let source;

  before(() => {
    root = mkdtempSync(path.join(os.tmpdir(), 'mms-cli-'));
    source = path.join(root, 'skills-source');
    const skillDir = path.join(source, 'domains', 'testing', 'skills', 'unit-testing');
    mkdirSync(path.join(skillDir, 'repos'), { recursive: true });
    mkdirSync(path.join(source, 'tools'), { recursive: true });
    writeFileSync(
      path.join(skillDir, 'skill.md'),
      ['---', 'name: unit-testing', 'description: Write unit tests', 'maturity: stable', '---', 'Body.'].join('\n'),
    );
  });

  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test('list --json emits valid JSON scoped to the configured source', () => {
    const result = runCli(['list', '--json', '--target', root, '--repo', 'core'], {
      METAMASK_SKILLS_DIR: source,
    });
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.repo, 'core');
    assert.deepEqual(parsed.sources, [source]);
    assert.deepEqual(parsed.skills.map((s) => s.id), ['testing/unit-testing']);
  });

  test('search narrows results and exits 0', () => {
    const result = runCli(['search', 'unit', '--json', '--target', root], {
      METAMASK_SKILLS_DIR: source,
    });
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.skills.length, 1);
    assert.equal(parsed.query, 'unit');
  });
});
