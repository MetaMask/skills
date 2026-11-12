import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'domains',
  'perps',
  'skills',
  'perps-manual-cpu-profile-audit',
  'scripts',
  'analyze-profile.cjs',
);

const INTERVAL_US = 10_000;
const START_TS = 4_500_000_000;

const STACK_FRAMES = {
  1: { name: '[root]', category: 'root' },
  2: { name: 'A', category: 'JavaScript', funcVirtAddr: '100', parent: 1 },
  3: { name: 'B', category: 'JavaScript', funcVirtAddr: '200', parent: 2 },
  4: { name: '[GC Young Gen]', category: 'Metadata', parent: 2 },
  5: { name: '', category: 'JavaScript', funcVirtAddr: '300', parent: 2 },
};

const IDLE = 1;
const A = 2;
const B = 3;
const GC = 4;
const ANON = 5;

function buildProfile({ idleHead = 30, leadingMarker = false } = {}) {
  const blocks = [
    [IDLE, idleHead],
    [B, 20],
    [GC, 10],
    [IDLE, 20],
    [A, 5],
    [IDLE, 5],
    [ANON, 5],
    [IDLE, 5],
  ];
  const samples = [];
  let ts = START_TS;
  if (leadingMarker) {
    samples.push({ ts: String(ts - 90_000_000), sf: A, weight: '1' });
  }
  for (const [sf, count] of blocks) {
    for (let i = 0; i < count; i += 1) {
      samples.push({ ts: String(ts), sf, weight: '1' });
      ts += INTERVAL_US;
    }
  }
  return { traceEvents: [], samples, stackFrames: STACK_FRAMES };
}

describe('perps-manual-cpu-profile-audit analyzer', () => {
  let dir;

  before(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'perps-profile-audit-'));
  });

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function write(name, content) {
    const file = path.join(dir, name);
    writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
    return file;
  }

  function run(args) {
    return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  }

  function runJson(args) {
    const result = run([...args, '--json']);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  }

  test('counts idle share, tracked frames and tasks', () => {
    const file = write('base.cpuprofile', buildProfile());
    const out = runJson([file]);
    assert.equal(out.capture.samples, 100);
    assert.equal(out.capture.busySamples, 40);
    assert.equal(out.capture.intervalMs, 10);
    assert.equal(out.capture.sampledSeconds, 1);
    assert.equal(out.metrics.idlePct.value, 60);
    assert.equal(out.metrics['frame:[GC Young Gen]'].value, 25);
    assert.equal(out.metrics['frame:_onSpanEnded'].value, 0);
    assert.equal(out.metrics.tasksOver50.value, 3);
    assert.equal(out.metrics.tasksOver100.value, 1);
    assert.equal(out.metrics.tasksOver300.value, 1);
    assert.equal(out.metrics.longestTaskMs.value, 300);
  });

  test('reports extra frames with inclusive share and self time', () => {
    const file = write('frames.cpuprofile', buildProfile());
    const out = runJson([file, '--frames', 'A,B']);
    const rowA = out.frames.find((row) => row.name === 'A');
    const rowB = out.frames.find((row) => row.name === 'B');
    assert.equal(rowA.inclusivePctBusy, 100);
    assert.equal(rowA.selfMs, 50);
    assert.equal(rowB.inclusivePctBusy, 50);
    assert.equal(rowB.inclusiveMs, 200);
    assert.equal(out.metrics['frame:B'].value, 50);
  });

  test('lists the longest tasks with their offset from the first sample', () => {
    const file = write('longest.cpuprofile', buildProfile());
    const out = runJson([file]);
    assert.deepEqual(out.tasks.longest, [
      { startSeconds: 0.3, durationMs: 300 },
      { startSeconds: 0.8, durationMs: 50 },
      { startSeconds: 0.9, durationMs: 50 },
    ]);
  });

  describe('--window', () => {
    test('counts only the samples inside the window', () => {
      const file = write('window.cpuprofile', buildProfile());
      const out = runJson([file, '--window', '0.3:0.6']);
      assert.equal(out.capture.samples, 30);
      assert.equal(out.metrics.idlePct.value, 0);
      assert.equal(out.metrics['frame:[GC Young Gen]'].value, 33.33);
      assert.deepEqual(out.capture.window, { fromSeconds: 0.3, toSeconds: 0.6 });
      assert.match(out.notes.join(' '), /keeps 30 of 100 samples/);
    });

    test('accepts an open-ended window', () => {
      const file = write('window-open.cpuprofile', buildProfile());
      const tail = runJson([file, '--window', '0.8:']);
      assert.equal(tail.capture.samples, 20);
      assert.equal(tail.capture.busySamples, 10);
      const head = runJson([file, '--window', ':0.4']);
      assert.equal(head.capture.samples, 40);
      assert.equal(head.capture.busySamples, 10);
    });

    test('rejects a malformed or empty window', () => {
      const file = write('window-bad.cpuprofile', buildProfile());
      assert.equal(run([file, '--window', '5']).status, 1);
      assert.equal(run([file, '--window', '9:3']).status, 1);
      assert.equal(run([file, '--window', 'a:b']).status, 1);
      const empty = run([file, '--window', '50:60']);
      assert.equal(empty.status, 1);
      assert.match(empty.stderr, /inside the window/);
    });

    test('applies the window to raw baselines and warns on a mismatched saved one', () => {
      const file = write('window-base.cpuprofile', buildProfile());
      const saved = write('window-saved.json', runJson([file]));
      const out = runJson([file, '--window', '0.3:0.6', '--baseline', saved]);
      assert.ok(out.baselineWarnings.some((warning) => /different --window/.test(warning)));
    });
  });

  test('keeps anonymous functions apart by address', () => {
    const file = write('anon.cpuprofile', buildProfile());
    const out = runJson([file]);
    const names = out.topSelf.map((row) => row.name);
    assert.ok(names.includes('(anonymous) @300'), names.join(', '));
  });

  test('excludes a leading start-marker sample and says so', () => {
    const file = write('marker.cpuprofile', buildProfile({ leadingMarker: true }));
    const out = runJson([file]);
    assert.equal(out.capture.samples, 100);
    assert.equal(out.metrics.idlePct.value, 60);
    assert.equal(out.notes.length, 1);
    assert.match(out.notes[0], /start marker/);
  });

  test('reads the app version and capture time from the file name', () => {
    const file = write(
      'io.metamask.MetaMask_v8.15.0_1791215876954.cpuprofile',
      buildProfile(),
    );
    const out = runJson([file]);
    assert.equal(out.app.version, '8.15.0');
    assert.equal(out.app.capturedAt, '2026-10-05T15:57:56.954Z');
  });

  test('prints the metric table in text mode', () => {
    const file = write('text.cpuprofile', buildProfile());
    const result = run([file, '--top', '0']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Idle \(% of samples\)\s+60\.0%/);
    assert.match(result.stdout, /\[GC Young Gen\]\s+25\.0%/);
    assert.match(result.stdout, /Longest task\s+300 ms/);
    assert.doesNotMatch(result.stdout, /Top 0/);
  });

  describe('input errors', () => {
    test('rejects a converted Chrome trace array', () => {
      const result = run([write('converted.json', [{ ph: 'B', name: 'x', ts: 1 }])]);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /converted Chrome trace/);
    });

    test('rejects the V8 cpuprofile format', () => {
      const result = run([
        write('v8.cpuprofile', { nodes: [], samples: [], timeDeltas: [] }),
      ]);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /V8 \.cpuprofile format/);
    });

    test('rejects invalid JSON, a missing file and a missing argument', () => {
      assert.equal(run([write('bad.cpuprofile', '{nope')]).status, 1);
      assert.equal(run([path.join(dir, 'missing.cpuprofile')]).status, 1);
      assert.equal(run([]).status, 1);
    });

    test('rejects a profile with no busy samples', () => {
      const idleOnly = {
        samples: [
          { ts: '1000', sf: IDLE },
          { ts: '11000', sf: IDLE },
          { ts: '21000', sf: IDLE },
        ],
        stackFrames: STACK_FRAMES,
      };
      const result = run([write('idle.cpuprofile', idleOnly)]);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /no busy JS samples/);
    });
  });

  describe('baseline comparison', () => {
    const idleFor = (idleHead) => write(`idle-${idleHead}.cpuprofile`, buildProfile({ idleHead }));

    test('flags a value above the noise band as better when higher is better', () => {
      const out = runJson([
        idleFor(30),
        '--baseline',
        idleFor(10),
        '--baseline',
        idleFor(20),
      ]);
      const cmp = out.comparisons.idlePct;
      assert.equal(cmp.status, 'better');
      assert.equal(cmp.runs, 2);
      assert.equal(cmp.bandMin, 50);
    });

    test('flags a value below the noise band as worse', () => {
      const out = runJson([
        idleFor(30),
        '--baseline',
        idleFor(40),
        '--baseline',
        idleFor(50),
      ]);
      assert.equal(out.comparisons.idlePct.status, 'worse');
    });

    test('treats a value inside the band as noise', () => {
      const out = runJson([
        idleFor(30),
        '--baseline',
        idleFor(25),
        '--baseline',
        idleFor(40),
      ]);
      assert.equal(out.comparisons.idlePct.status, 'within-noise');
    });

    test('reports only a change, not a band, for a single baseline', () => {
      const out = runJson([idleFor(30), '--baseline', idleFor(40)]);
      assert.equal(out.comparisons.idlePct.status, 'no-band');
      assert.equal(out.comparisons.idlePct.runs, 1);
    });

    test('accepts a saved --json result as a baseline', () => {
      const saved = write('saved.json', runJson([idleFor(30)]));
      const out = runJson([idleFor(30), '--baseline', saved]);
      assert.equal(out.comparisons.idlePct.status, 'no-band');
      assert.equal(out.comparisons.idlePct.deltaPct, 0);
      assert.equal(out.comparisons.longestTaskMs.deltaPct, 0);
    });

    test('warns when a baseline has a very different capture length', () => {
      const longer = {
        ...buildProfile(),
        samples: [...buildProfile().samples, ...buildProfile({ idleHead: 30 }).samples.map((sample) => ({ ...sample, ts: String(Number(sample.ts) + 2_000_000) }))],
      };
      const out = runJson([idleFor(30), '--baseline', write('longer.cpuprofile', longer)]);
      assert.equal(out.baselineWarnings.length, 1);
      assert.match(out.baselineWarnings[0], /Task counts scale with capture length/);
    });
  });

  describe('--check', () => {
    const statusOf = (out, id) => out.checks.find((check) => check.id === id).status;

    test('fails a capture shorter than the minimum and exits 2', () => {
      const file = write('short.cpuprofile', buildProfile());
      const result = run([file, '--check', '--json']);
      assert.equal(result.status, 2);
      assert.equal(statusOf(JSON.parse(result.stdout), 'capture-length'), 'fail');
    });

    test('passes length, screens and version when they match', () => {
      const file = write(
        'io.metamask.MetaMask_v8.15.0_1791215876954.cpuprofile',
        buildProfile(),
      );
      const out = runJson([
        file,
        '--check',
        '--min-seconds',
        '1',
        '--expect',
        'B,A',
        '--expect-version',
        '8.15.0',
      ]);
      assert.equal(statusOf(out, 'capture-length'), 'pass');
      assert.equal(statusOf(out, 'expect:B'), 'pass');
      assert.equal(statusOf(out, 'expect:A'), 'pass');
      assert.equal(statusOf(out, 'app-version'), 'pass');
    });

    test('fails when an expected screen is missing', () => {
      const file = write('missing.cpuprofile', buildProfile());
      const result = run([file, '--check', '--min-seconds', '1', '--expect', 'NoSuchScreen', '--json']);
      assert.equal(result.status, 2);
      assert.equal(statusOf(JSON.parse(result.stdout), 'expect:NoSuchScreen'), 'fail');
    });

    test('fails when the version does not match', () => {
      const file = write(
        'io.metamask.MetaMask_v8.14.0_1791215876954.cpuprofile',
        buildProfile(),
      );
      const result = run([file, '--check', '--min-seconds', '1', '--expect-version', '8.15.0', '--json']);
      assert.equal(result.status, 2);
      assert.equal(statusOf(JSON.parse(result.stdout), 'app-version'), 'fail');
    });

    test('warns about a mostly idle capture without failing it', () => {
      const file = write('idle-warn.cpuprofile', buildProfile());
      const result = run([file, '--check', '--min-seconds', '1', '--max-idle', '50', '--json']);
      assert.equal(result.status, 0);
      assert.equal(statusOf(JSON.parse(result.stdout), 'idle-share'), 'warn');
    });

    test('warns when samples leave a large gap in the capture', () => {
      const profile = buildProfile();
      const half = Math.floor(profile.samples.length / 2);
      profile.samples = profile.samples.map((sample, index) =>
        index >= half ? { ...sample, ts: String(Number(sample.ts) + 5_000_000) } : sample,
      );
      const result = run([write('gap.cpuprofile', profile), '--check', '--min-seconds', '1', '--json']);
      assert.equal(statusOf(JSON.parse(result.stdout), 'sampling-gaps'), 'warn');
    });

    test('says the screens are unconfirmed when --expect is not given', () => {
      const out = runJson([write('noexpect.cpuprofile', buildProfile()), '--check', '--min-seconds', '1']);
      assert.equal(statusOf(out, 'expected-screens'), 'skip');
    });
  });
});
