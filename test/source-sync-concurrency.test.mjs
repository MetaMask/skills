import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin', 'metamask-skills.mjs');
const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();

async function waitFor(check) {
  const deadline = Date.now() + 2500;
  while (!check()) {
    assert.ok(Date.now() < deadline, 'source update did not reach its barrier');
    await delay(10);
  }
}

function fixture(t) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'mms-source-sync-'));
  const children = [];
  t.after(async () => {
    const results = await Promise.allSettled(children.map(async ({ child, done }) => {
      if (child.pid && child.exitCode === null && child.signalCode === null) {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch (error) {
          if (error.code !== 'ESRCH') throw error;
        }
      }
      await done;
    }));
    rmSync(directory, { recursive: true, force: true });
    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length) throw new AggregateError(failures.map((result) => result.reason), 'child cleanup failed');
  });
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: os.devNull,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_TERMINAL_PROMPT: '0',
    METAMASK_SKILLS_DIR: '',
    CONSENSYS_SKILLS_DIR: '',
    SKILLS_DOMAINS: 'testing',
    SKILLS_INCLUDE: '',
    SKILLS_EXCLUDE: '',
    SKILLS_PRUNE_STALE: '',
    SKILLS_MATURITY: 'stable',
    SKILLS_AUTO_UPDATE: '0',
  };
  for (const name of [
    'BASH_ENV', 'NODE_OPTIONS', 'NODE_TEST_CONTEXT', 'TMUX', 'TMUX_PANE',
    'GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY',
  ]) {
    delete env[name];
  }
  const git = (cwd, ...args) => execFileSync(realGit, ['-C', cwd, ...args], {
    env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  const upstream = path.join(directory, 'upstream');
  mkdirSync(upstream);
  git(upstream, 'init', '-b', 'main');
  git(upstream, 'config', 'user.name', 'Fixture');
  git(upstream, 'config', 'user.email', 'fixture@example.invalid');
  git(upstream, 'config', 'commit.gpgsign', 'false');
  mkdirSync(path.join(upstream, 'tools'));
  writeFileSync(path.join(upstream, 'tools', '.gitkeep'), '');
  const skill = path.join('domains', 'testing', 'skills', 'fresh', 'skill.md');
  mkdirSync(path.dirname(path.join(upstream, skill)), { recursive: true });
  const content = (revision) => `---\nname: fresh\ndescription: Verify source synchronization\nmaturity: stable\n---\nRevision ${revision}.\n`;
  writeFileSync(path.join(upstream, skill), content(1));
  git(upstream, 'add', '.');
  git(upstream, 'commit', '-m', 'initial fixture');
  const sources = [0, 1].map((number) => {
    const source = path.join(directory, `source-${number}`);
    git(directory, 'clone', upstream, source);
    git(source, 'config', 'pull.rebase', 'true');
    return source;
  });
  writeFileSync(path.join(upstream, skill), content(2));
  git(upstream, 'add', '.');
  git(upstream, 'commit', '-m', 'updated fixture');
  const expectedHead = git(upstream, 'rev-parse', 'HEAD');
  const monitor = path.join(directory, 'monitor');
  const wrapper = path.join(directory, 'bin');
  mkdirSync(monitor);
  mkdirSync(wrapper);
  symlinkSync('/bin/bash', path.join(wrapper, 'bash'));
  // Instrument the Git process boundary. The actual pulls still use real Git.
  // Hold the first pull until the other caller has reached Git or its lock lookup.
  writeFileSync(path.join(wrapper, 'git'), `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const args = process.argv.slice(2);
const monitor = process.env.MMS_TEST_MONITOR;
const log = (event) => fs.appendFileSync(path.join(monitor, 'events'), JSON.stringify({ event, pid: process.pid }) + '\\n');
const pull = args.includes('pull');
if (args.includes('--absolute-git-dir')) log('lookup');
if (pull) {
  log('start');
  const limit = Date.now() + 2500;
  const clock = new Int32Array(new SharedArrayBuffer(4));
  while (!fs.existsSync(path.join(monitor, 'release'))) {
    if (Date.now() >= limit) process.exit(90);
    Atomics.wait(clock, 0, 0, 10);
  }
}
const result = spawnSync(process.env.MMS_TEST_REAL_GIT, args, { stdio: 'inherit' });
if (pull) log('end');
if (result.error) throw result.error;
process.exit(result.status ?? 1);
`, { mode: 0o755 });
  const events = () => {
    const file = path.join(monitor, 'events');
    return existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  };
  function sync(source, name) {
    const target = path.join(directory, name);
    mkdirSync(target);
    const child = spawn(process.execPath, [bin, 'sync', '--target', target, '--repo', 'core', '--no-save'], {
      detached: true,
      env: {
        ...env,
        BASH: path.join(wrapper, 'bash'),
        PATH: `${wrapper}${path.delimiter}${env.PATH}`,
        METAMASK_SKILLS_DIR: source,
        XDG_CACHE_HOME: path.join(directory, `cache-${name}`),
        MMS_TEST_MONITOR: monitor,
        MMS_TEST_REAL_GIT: realGit,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (data) => { output += data; });
    child.stderr.on('data', (data) => { output += data; });
    const done = once(child, 'close').then(([code, signal]) => ({ code, signal, output }));
    children.push({ child, done });
    return { done, target };
  }
  return {
    sources, git, upstream, expectedHead, sync, events,
    release: () => writeFileSync(path.join(monitor, 'release'), ''),
    checkInstalled: (target) => assert.match(
      readFileSync(path.join(target, '.claude', 'skills', 'mms-fresh', 'SKILL.md'), 'utf8'),
      /Revision 2\./u,
    ),
    alias: () => {
      const alias = path.join(directory, 'source-alias');
      symlinkSync(sources[0], alias);
      return alias;
    },
  };
}

function maximumPulls(events) {
  let active = 0;
  let maximum = 0;
  for (const { event } of events) {
    if (event === 'start') maximum = Math.max(maximum, ++active);
    if (event === 'end') active--;
  }
  assert.equal(active, 0);
  return maximum;
}

test('concurrent syncs serialize one checkout across aliases and cache directories', { timeout: 10000 }, async (t) => {
  const f = fixture(t);
  const first = f.sync(f.sources[0], 'slot-a');
  await waitFor(() => f.events().some(({ event }) => event === 'start'));
  const second = f.sync(f.alias(), 'slot-b');
  await waitFor(() => f.events().filter(({ event }) => event === 'lookup').length >= 2
    || f.events().filter(({ event }) => event === 'start').length >= 2);
  f.release();
  for (const result of await Promise.all([first.done, second.done])) {
    assert.equal(result.code, 0, result.output);
  }
  assert.equal(maximumPulls(f.events()), 1, 'Git pulls of the same checkout overlapped');
  assert.equal(f.git(f.sources[0], 'rev-parse', 'HEAD'), f.expectedHead);
  f.checkInstalled(first.target);
  f.checkInstalled(second.target);
});

test('different source checkouts can update concurrently', { timeout: 10000 }, async (t) => {
  const f = fixture(t);
  const first = f.sync(f.sources[0], 'slot-a');
  const second = f.sync(f.sources[1], 'slot-b');
  await waitFor(() => f.events().filter(({ event }) => event === 'start').length === 2);
  f.release();
  for (const result of await Promise.all([first.done, second.done])) {
    assert.equal(result.code, 0, result.output);
  }
  assert.equal(maximumPulls(f.events()), 2);
  f.checkInstalled(first.target);
  f.checkInstalled(second.target);
});

test('a failed pull refuses stale installation and releases the source lock', { timeout: 10000 }, async (t) => {
  const f = fixture(t);
  f.git(f.sources[0], 'remote', 'set-url', 'origin', path.join(f.upstream, 'missing'));
  f.release();
  const failed = f.sync(f.sources[0], 'failed');
  const result = await failed.done;
  assert.equal(result.code, 1);
  assert.match(result.output, /Refusing to install potentially stale skills/u);
  assert.equal(existsSync(path.join(failed.target, '.claude', 'skills', 'mms-fresh')), false);
  f.git(f.sources[0], 'remote', 'set-url', 'origin', f.upstream);
  const recovered = f.sync(f.sources[0], 'recovered');
  const success = await recovered.done;
  assert.equal(success.code, 0, success.output);
  f.checkInstalled(recovered.target);
});
