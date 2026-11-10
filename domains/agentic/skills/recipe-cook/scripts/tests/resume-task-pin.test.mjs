import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import path from 'node:path';
import { recommendedHarness, retainedFixture, snapshot } from './resume-task-pin.fixture.mjs';

const escaped = recommendedHarness.replaceAll('.', '\\.');

test('two retained harness resolutions preserve the producer receipt and task files', async (t) => {
  const { task, provider, scripts, env, before } = await retainedFixture(t, 'accepted');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = spawnSync(path.join(scripts, 'resolve-harness'), [task], {
      encoding: 'utf8', env,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), path.join(provider, 'bin/mm-harness'));
    assert.deepEqual(await snapshot(task), before);
  }
});

for (const scenario of ['existing-runner', 'rejected-pin', 'wrong-provider', 'changed-library']) test(`retained task resume ${scenario}`, async (t) => {
  const { task, scripts, env, before } = await retainedFixture(t, scenario);
  const result = spawnSync(path.join(scripts, 'init-template'), ['--resume-task-dir', task], {
    encoding: 'utf8', env,
  });
  if (scenario === 'existing-runner') {
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(await snapshot(task), before, 'Existing runtime command is preserved');
    return;
  }
  if (scenario !== 'accepted') {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, scenario === 'rejected-pin' ? /TASK_INPUT_CHANGED/ : scenario === 'changed-library' ? /Recorded library source changed/ : /Selected provider is not the MetaMask harness/);
    assert.deepEqual(await snapshot(task), before);
  }
});


for (const scenario of ['pool-update', 'pool-no-registry']) test(`an older recorded harness resolves the selected recommended one with no warning: ${scenario}`, async (t) => {
  const { task, poolProvider, retainedProvider, scripts, env, before } = await retainedFixture(t, scenario);
  const pinBefore = await snapshot(retainedProvider);
  const result = spawnSync(path.join(scripts, 'resolve-harness'), [task, '--verify-only'], { encoding: 'utf8', env });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), path.join(poolProvider, 'bin/mm-harness'));
  assert.doesNotMatch(result.stderr, /below the recommended version|using configured|recommended/);
  const launch = spawnSync(result.stdout.trim(), ['help', '--json'], { encoding: 'utf8', env });
  assert.equal(launch.status, 0, launch.stderr);
  assert.equal(JSON.parse(launch.stdout).version, recommendedHarness);
  assert.deepEqual(await snapshot(retainedProvider), pinBefore);
  assert.deepEqual(await snapshot(task), before);
});

test('a selected harness below the recommended version still runs, with the upgrade command', async (t) => {
  const { task, poolProvider, scripts, env, before } = await retainedFixture(t, 'pool-below-minimum');
  const result = spawnSync(path.join(scripts, 'resolve-harness'), [task, '--verify-only'], { encoding: 'utf8', env });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), path.join(poolProvider, 'bin/mm-harness'));
  assert.match(result.stderr, new RegExp(`0\\.1\\.6 is below the recommended version ${escaped}; upgrade with: npm i -g '@deeeed/metamask-harness@${escaped}'`));
  assert.deepEqual(await snapshot(task), before);
});


test('a direct task uses a public fallback outside its pin with an older SDK', async (t) => {
  const { task, provider, retainedProvider, scripts, env, before } = await retainedFixture(t, 'direct-no-pool');
  const pinBefore = await snapshot(retainedProvider);
  const result = spawnSync(path.join(scripts, 'resolve-harness'), [task, '--verify-only'], { encoding: 'utf8', env });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), path.join(provider, 'bin/mm-harness'));
  assert.doesNotMatch(result.stderr, /below the recommended version|using configured|recommended/);
  const launch = spawnSync(result.stdout.trim(), ['help', '--json'], { encoding: 'utf8', env });
  assert.equal(launch.status, 0, launch.stderr);
  assert.deepEqual(await snapshot(retainedProvider), pinBefore);
  assert.deepEqual(await snapshot(task), before);
});

test('a configured launcher inside a retained pin refuses before bootstrap mutation', async (t) => {
  const { task, retainedProvider, scripts, env, before } = await retainedFixture(t, 'unsafe-pool');
  const pinBefore = await snapshot(retainedProvider);
  const result = spawnSync(path.join(scripts, 'resolve-harness'), [task, '--verify-only'], { encoding: 'utf8', env });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /launcher is inside the frozen task pin/);
  assert.deepEqual(await snapshot(retainedProvider), pinBefore);
  assert.deepEqual(await snapshot(task), before);
});

test('a retained task honors an explicit harness without changing frozen inputs', async (t) => {
  const { task, poolProvider, scripts, env, before } = await retainedFixture(t, 'pool-update');
  const override = path.join(poolProvider, 'bin/mm-harness');
  const result = spawnSync(path.join(scripts, 'resolve-harness'), [task, '--verify-only'], {
    encoding: 'utf8', env: { ...env, MM_HARNESS_BIN: override },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), override);
  assert.equal(result.stderr, '');
  assert.deepEqual(await snapshot(task), before);
});

test('an invalid explicit harness on a retained task refuses instead of using the pool', async (t) => {
  const { task, scripts, env, before } = await retainedFixture(t, 'pool-update');
  const result = spawnSync(path.join(scripts, 'resolve-harness'), [task, '--verify-only'], {
    encoding: 'utf8', env: { ...env, MM_HARNESS_BIN: path.join(task, 'missing-harness') },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ENOENT/);
  assert.deepEqual(await snapshot(task), before);
});

test('an explicit harness inside the retained pin is refused without changing it', async (t) => {
  const { task, retainedProvider, scripts, env, before } = await retainedFixture(t, 'pool-update');
  const pinBefore = await snapshot(retainedProvider);
  const result = spawnSync(path.join(scripts, 'resolve-harness'), [task, '--verify-only'], {
    encoding: 'utf8', env: { ...env, MM_HARNESS_BIN: path.join(retainedProvider, 'bin/mm-harness') },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /launcher is inside the frozen task pin/);
  assert.deepEqual(await snapshot(task), before);
  assert.deepEqual(await snapshot(retainedProvider), pinBefore);
});
