#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const SCHEMA = 'perps-profile-metrics/1';
const ROOT_FRAME = '[root]';
const ANONYMOUS_FRAME = '(anonymous)';
const DEFAULT_FRAMES = [
  '[GC Young Gen]',
  '_onSpanEnded',
  'normalize',
  'useMarketInsightsEntryTrace',
  'dispatch',
  'propagateParentContextChanges',
];
const TASK_THRESHOLDS_MS = [50, 100, 300];
const TASK_GAP_FACTOR = 2.5;
const MARKER_MIN_GAP_US = 1e6;
const MARKER_GAP_INTERVALS = 100;
const SAMPLING_GAP_WARN_PCT = 10;

const HELP = `Usage: node analyze-profile.cjs <profile.cpuprofile> [options]

Counts a raw Hermes .cpuprofile (the file exported from the shake-menu profiler)
and prints the fixed metric table. No source map and no other tooling needed.

Options:
  --baseline <file>        Compare against a baseline: a raw profile or a saved
                           --json result. Repeat the flag to add baseline runs.
                           With two or more, their min-max range is the noise band.
  --frames <a,b,c>         Extra frame names to report, added to the default set.
  --window <from>:<to>     Count only samples from <from> up to <to> seconds after the
                           first sample. Either side may be empty (":30", "10:").
                           Use it to isolate the slow moment. Applies to raw baselines too.
  --check                  Check the capture is usable (length, idle share, version,
                           expected screens). Exit code 2 if any check fails.
  --expect <a,b,c>         Frame names that must appear in the capture (for --check).
  --expect-version <x.y.z> App version the capture must come from (for --check).
  --min-seconds <n>        Shortest acceptable capture, in sampled seconds (default 30).
  --max-idle <n>           Idle share above which --check warns (default 95).
  --top <n>                Rows in the top-frames lists (default 10).
  --json                   Print machine-readable JSON instead of the tables.
  --help                   Show this help.

Exit codes: 0 ok, 1 unreadable or unsupported input, 2 a --check failed.`;

class UsageError extends Error {}

function splitList(value) {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function toPositiveNumber(flag, value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new UsageError(`${flag} needs a non-negative number, got "${value}"`);
  }
  return parsed;
}

function parseWindow(value) {
  const parts = value.split(':');
  if (parts.length !== 2) {
    throw new UsageError(`--window needs <from>:<to> in seconds, got "${value}"`);
  }
  const fromSeconds = parts[0] === '' ? 0 : Number(parts[0]);
  const toSeconds = parts[1] === '' ? Infinity : Number(parts[1]);
  if (!Number.isFinite(fromSeconds) || Number.isNaN(toSeconds) || fromSeconds < 0 || fromSeconds >= toSeconds) {
    throw new UsageError(`--window "${value}" is not a valid range of seconds`);
  }
  return { fromSeconds, toSeconds };
}

function parseArgs(argv) {
  const opts = {
    profile: undefined,
    baselines: [],
    frames: [],
    expect: [],
    expectVersion: undefined,
    window: undefined,
    minSeconds: 30,
    maxIdle: 95,
    top: 10,
    check: false,
    json: false,
    help: false,
  };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) {
        throw new UsageError(`${arg} needs a value`);
      }
      i += 1;
      return argv[i];
    };
    switch (arg) {
      case '--help':
      case '-h':
        opts.help = true;
        break;
      case '--json':
        opts.json = true;
        break;
      case '--check':
        opts.check = true;
        break;
      case '--baseline':
        opts.baselines.push(next());
        break;
      case '--frames':
        opts.frames.push(...splitList(next()));
        break;
      case '--expect':
        opts.expect.push(...splitList(next()));
        break;
      case '--expect-version':
        opts.expectVersion = next();
        break;
      case '--window':
        opts.window = parseWindow(next());
        break;
      case '--min-seconds':
        opts.minSeconds = toPositiveNumber(arg, next());
        break;
      case '--max-idle':
        opts.maxIdle = toPositiveNumber(arg, next());
        break;
      case '--top':
        opts.top = Math.floor(toPositiveNumber(arg, next()));
        break;
      default:
        if (arg.startsWith('-')) {
          throw new UsageError(`Unknown option ${arg}. Run with --help.`);
        }
        positional.push(arg);
    }
  }
  if (positional.length > 1) {
    throw new UsageError(
      `Expected one profile, got ${positional.length}. Pass extra runs with --baseline.`,
    );
  }
  opts.profile = positional[0];
  return opts;
}

function readJson(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    throw new UsageError(`Cannot read ${file}: ${error.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new UsageError(`${file} is not valid JSON: ${error.message}`);
  }
}

function assertHermesProfile(raw, file) {
  if (Array.isArray(raw)) {
    throw new UsageError(
      `${file} is a converted Chrome trace (an array of events). Pass the raw .cpuprofile exported from the app.`,
    );
  }
  if (raw && Array.isArray(raw.nodes) && Array.isArray(raw.timeDeltas)) {
    throw new UsageError(
      `${file} is in V8 .cpuprofile format. This script reads the raw Hermes format (samples and stackFrames).`,
    );
  }
  const hasFrames =
    raw && typeof raw.stackFrames === 'object' && raw.stackFrames !== null;
  if (!raw || !Array.isArray(raw.samples) || !hasFrames) {
    throw new UsageError(
      `${file} is not a Hermes .cpuprofile (expected "samples" and "stackFrames").`,
    );
  }
}

function frameName(frame) {
  const name =
    typeof frame.name === 'string' ? frame.name.split('(')[0].trim() : '';
  if (name === '' && frame.category === 'JavaScript') {
    return frame.funcVirtAddr === undefined
      ? ANONYMOUS_FRAME
      : `${ANONYMOUS_FRAME} @${frame.funcVirtAddr}`;
  }
  return name === '' ? '?' : name;
}

function createStackResolver(stackFrames) {
  const cache = new Map();
  return (id) => {
    const key = String(id);
    const cached = cache.get(key);
    if (cached) {
      return cached;
    }
    const chain = [];
    const seen = new Set();
    let current = key;
    while (current !== undefined && stackFrames[current] && !seen.has(current)) {
      seen.add(current);
      chain.push(frameName(stackFrames[current]));
      const parent = stackFrames[current].parent;
      current = parent === undefined || parent === null ? undefined : String(parent);
    }
    const entry = { chain, names: new Set(chain) };
    cache.set(key, entry);
    return entry;
  };
}

function median(values) {
  if (values.length === 0) {
    return NaN;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function deltas(samples) {
  const out = [];
  for (let i = 1; i < samples.length; i += 1) {
    out.push(samples[i].ts - samples[i - 1].ts);
  }
  return out;
}

function fileFacts(file) {
  const match = path.basename(file).match(/_v(\d+(?:\.\d+)+[^_]*)_(\d{10,})\.cpuprofile$/);
  if (!match) {
    return { version: null, capturedAt: null };
  }
  const capturedAt = new Date(Number(match[2]));
  return {
    version: match[1],
    capturedAt: Number.isNaN(capturedAt.getTime()) ? null : capturedAt.toISOString(),
  };
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function analyzeProfile(raw, file, { frameList, extraFrames, top, window }) {
  assertHermesProfile(raw, file);
  const resolve = createStackResolver(raw.stackFrames);
  const notes = [];

  let samples = raw.samples
    .map((sample) => ({ ts: Number(sample.ts), sf: sample.sf }))
    .filter((sample) => Number.isFinite(sample.ts))
    .sort((a, b) => a.ts - b.ts);

  if (samples.length > 2) {
    const interval = median(deltas(samples.slice(1)));
    const lead = samples[1].ts - samples[0].ts;
    if (lead > Math.max(MARKER_MIN_GAP_US, MARKER_GAP_INTERVALS * interval)) {
      samples = samples.slice(1);
      notes.push(
        `Excluded 1 leading sample that sits ${round(lead / 1e6, 1)} s before the next one (likely a profiler start marker).`,
      );
    }
  }
  if (samples.length < 2) {
    throw new UsageError(`${file} has fewer than 2 usable samples.`);
  }

  const originTs = samples[0].ts;
  if (window) {
    const before = samples.length;
    samples = samples.filter((sample) => {
      const offset = (sample.ts - originTs) / 1e6;
      return offset >= window.fromSeconds && offset < window.toSeconds;
    });
    if (samples.length < 2) {
      throw new UsageError(`${file} has fewer than 2 samples inside the window.`);
    }
    notes.push(`Window ${window.fromSeconds}-${window.toSeconds === Infinity ? 'end' : window.toSeconds} s keeps ${samples.length} of ${before} samples.`);
  }

  const intervalUs = median(deltas(samples));
  const selfCounts = new Map();
  const inclusiveCounts = new Map();
  const busy = [];
  let idleSamples = 0;
  let unresolved = 0;

  for (const sample of samples) {
    const entry = resolve(sample.sf);
    if (entry.chain.length === 0) {
      unresolved += 1;
    } else if (entry.chain[0] === ROOT_FRAME) {
      idleSamples += 1;
    } else {
      busy.push({ ts: sample.ts });
      const leaf = entry.chain[0];
      selfCounts.set(leaf, (selfCounts.get(leaf) || 0) + 1);
      for (const name of entry.names) {
        inclusiveCounts.set(name, (inclusiveCounts.get(name) || 0) + 1);
      }
    }
  }
  if (unresolved > 0) {
    notes.push(`Ignored ${unresolved} samples that point at unknown stack frames.`);
  }

  const busySamples = busy.length;
  const totalSamples = idleSamples + busySamples;
  if (totalSamples === 0 || busySamples === 0) {
    throw new UsageError(
      `${file} has no busy JS samples. Nothing to analyze; the capture is empty or only idle.`,
    );
  }

  const tasks = [];
  let start = null;
  let previous = null;
  const closeTask = () => {
    tasks.push({
      startSeconds: (start - originTs) / 1e6,
      durationMs: (previous - start + intervalUs) / 1000,
    });
  };
  for (const { ts } of busy) {
    if (previous !== null && ts - previous <= intervalUs * TASK_GAP_FACTOR) {
      previous = ts;
    } else {
      if (start !== null) {
        closeTask();
      }
      start = ts;
      previous = ts;
    }
  }
  closeTask();
  const taskDurations = tasks.map((task) => task.durationMs);

  const pctBusy = (count) => (100 * count) / busySamples;
  const ms = (count) => (count * intervalUs) / 1000;
  const sampledSeconds = (totalSamples * intervalUs) / 1e6;
  const spanSeconds = (samples[samples.length - 1].ts - samples[0].ts) / 1e6;

  const frameRow = (name) => {
    const inclusiveSamples = inclusiveCounts.get(name) || 0;
    const selfSamples = selfCounts.get(name) || 0;
    return {
      name,
      inclusiveSamples,
      inclusivePctBusy: round(pctBusy(inclusiveSamples), 2),
      inclusiveMs: round(ms(inclusiveSamples), 1),
      selfSamples,
      selfMs: round(ms(selfSamples), 1),
    };
  };

  const metrics = {
    idlePct: {
      label: 'Idle (% of samples)',
      value: round((100 * idleSamples) / totalSamples, 2),
      unit: '%',
      better: 'higher',
    },
  };
  for (const name of frameList) {
    metrics[`frame:${name}`] = {
      label: name,
      value: round(pctBusy(inclusiveCounts.get(name) || 0), 2),
      unit: '% busy',
      better: 'lower',
    };
  }
  for (const threshold of TASK_THRESHOLDS_MS) {
    metrics[`tasksOver${threshold}`] = {
      label: `Tasks >= ${threshold} ms`,
      value: taskDurations.filter((duration) => duration >= threshold).length,
      unit: 'tasks',
      better: 'lower',
    };
  }
  metrics.longestTaskMs = {
    label: 'Longest task',
    value: round(Math.max(...taskDurations), 0),
    unit: 'ms',
    better: 'lower',
  };

  const topBy = (counts, exclude) =>
    [...counts.entries()]
      .filter(([name]) => !exclude.has(name))
      .sort((a, b) => b[1] - a[1])
      .slice(0, top)
      .map(([name]) => frameRow(name));

  return {
    schema: SCHEMA,
    file: path.basename(file),
    app: fileFacts(file),
    capture: {
      samples: totalSamples,
      idleSamples,
      busySamples,
      intervalMs: round(intervalUs / 1000, 1),
      sampledSeconds: round(sampledSeconds, 1),
      spanSeconds: round(spanSeconds, 1),
      busySeconds: round((busySamples * intervalUs) / 1e6, 1),
      unresolvedSamples: unresolved,
      window: window
        ? { fromSeconds: window.fromSeconds, toSeconds: window.toSeconds === Infinity ? null : window.toSeconds }
        : null,
    },
    tasks: {
      gapFactor: TASK_GAP_FACTOR,
      thresholdsMs: TASK_THRESHOLDS_MS,
      longest: [...tasks]
        .sort((a, b) => b.durationMs - a.durationMs)
        .slice(0, top)
        .map((task) => ({
          startSeconds: round(task.startSeconds, 2),
          durationMs: round(task.durationMs, 0),
        })),
    },
    notes,
    metrics,
    frames: [...new Set([...frameList, ...extraFrames])].map(frameRow),
    topSelf: topBy(selfCounts, new Set([ROOT_FRAME])),
    topInclusive: topBy(inclusiveCounts, new Set([ROOT_FRAME])),
  };
}

function loadBaseline(file, frameList, window) {
  const raw = readJson(file);
  if (raw && raw.schema === SCHEMA && raw.metrics) {
    return { file: path.basename(file), metrics: raw.metrics, capture: raw.capture };
  }
  const result = analyzeProfile(raw, file, { frameList, extraFrames: [], top: 0, window });
  return { file: result.file, metrics: result.metrics, capture: result.capture };
}

function compareToBaselines(result, baselines) {
  const comparisons = {};
  for (const [key, metric] of Object.entries(result.metrics)) {
    const values = baselines
      .map((baseline) => baseline.metrics[key] && baseline.metrics[key].value)
      .filter((value) => typeof value === 'number' && Number.isFinite(value));
    if (values.length === 0) {
      comparisons[key] = { status: 'no-baseline' };
      continue;
    }
    const baselineMedian = median(values);
    const min = Math.min(...values);
    const max = Math.max(...values);
    let status;
    if (values.length < 2) {
      status = 'no-band';
    } else if (metric.value >= min && metric.value <= max) {
      status = 'within-noise';
    } else {
      status = metric.value > max === (metric.better === 'lower') ? 'worse' : 'better';
    }
    comparisons[key] = {
      status,
      baselineMedian: round(baselineMedian, 2),
      bandMin: round(min, 2),
      bandMax: round(max, 2),
      runs: values.length,
      deltaPct:
        baselineMedian === 0
          ? null
          : round(((metric.value - baselineMedian) / baselineMedian) * 100, 1),
    };
  }
  return comparisons;
}

function baselineWarnings(result, baselines) {
  const warnings = [];
  const current = result.capture.sampledSeconds;
  const currentWindow = JSON.stringify(result.capture.window);
  for (const baseline of baselines) {
    if (baseline.capture && JSON.stringify(baseline.capture.window || null) !== currentWindow) {
      warnings.push(
        `${baseline.file} was saved with a different --window than this run, so its numbers cover a different slice of the capture.`,
      );
    }
    const length = baseline.capture && baseline.capture.sampledSeconds;
    if (typeof length === 'number' && current > 0) {
      const differs = (Math.abs(length - current) / current) * 100;
      if (differs > 20) {
        warnings.push(
          `${baseline.file} is ${length} s against ${current} s here. Task counts scale with capture length, so recapture with the same plan before trusting those rows.`,
        );
      }
    }
  }
  return warnings;
}

function runChecks(result, opts) {
  const checks = [];
  const add = (id, status, detail) => checks.push({ id, status, detail });
  const { capture, app } = result;

  add(
    'capture-length',
    capture.sampledSeconds >= opts.minSeconds ? 'pass' : 'fail',
    `${capture.sampledSeconds} s sampled, minimum ${opts.minSeconds} s`,
  );

  const idle = result.metrics.idlePct.value;
  add(
    'idle-share',
    idle <= opts.maxIdle ? 'pass' : 'warn',
    idle <= opts.maxIdle
      ? `${idle}% idle`
      : `${idle}% idle, above ${opts.maxIdle}%. The interaction may not be in this capture, or the slowness is not JS work.`,
  );

  const gapPct =
    capture.spanSeconds > 0
      ? ((capture.spanSeconds - capture.sampledSeconds) / capture.spanSeconds) * 100
      : 0;
  add(
    'sampling-gaps',
    gapPct <= SAMPLING_GAP_WARN_PCT ? 'pass' : 'warn',
    gapPct <= SAMPLING_GAP_WARN_PCT
      ? 'samples cover the whole capture'
      : `${round(capture.spanSeconds - capture.sampledSeconds, 1)} s of the ${capture.spanSeconds} s span has no samples. The profiler may have paused or the app went to the background.`,
  );

  if (opts.expectVersion) {
    if (app.version === null) {
      add('app-version', 'warn', `cannot read the version from the file name, expected ${opts.expectVersion}`);
    } else {
      add(
        'app-version',
        app.version === opts.expectVersion ? 'pass' : 'fail',
        `file name says ${app.version}, expected ${opts.expectVersion}`,
      );
    }
  } else {
    add(
      'app-version',
      'skip',
      app.version
        ? `file name says ${app.version}. Pass --expect-version to enforce it. The file name has no build number or RC/exp flag, so note those yourself.`
        : 'no version in the file name. Note the build yourself.',
    );
  }

  if (opts.expect.length === 0) {
    add('expected-screens', 'skip', 'no --expect frames given, so the planned screens are not confirmed');
  } else {
    for (const name of opts.expect) {
      const row = result.frames.find((entry) => entry.name === name);
      add(
        `expect:${name}`,
        row.inclusiveSamples > 0 ? 'pass' : 'fail',
        row.inclusiveSamples > 0
          ? `${row.inclusiveSamples} samples (${row.inclusiveMs} ms)`
          : 'not in any sample. The screen was not exercised, or the build strips this name.',
      );
    }
  }
  return checks;
}

function fmtValue(metric) {
  if (metric.unit === '%' || metric.unit === '% busy') {
    return `${metric.value.toFixed(1)}%`;
  }
  if (metric.unit === 'ms') {
    return `${metric.value} ms`;
  }
  return String(metric.value);
}

function renderTable(rows) {
  const widths = rows[0].map((_, col) => Math.max(...rows.map((row) => String(row[col]).length)));
  return rows
    .map((row, index) => {
      const line = row
        .map((cell, col) => (col === 0 ? String(cell).padEnd(widths[col]) : String(cell).padStart(widths[col])))
        .join('  ');
      return index === 0 ? `${line}\n${widths.map((w) => '-'.repeat(w)).join('  ')}` : line;
    })
    .join('\n');
}

function renderText(result, opts) {
  const { capture, app, comparisons } = result;
  const lines = [];
  lines.push(`Profile: ${result.file}`);
  lines.push(
    `App version (from file name): ${app.version || 'unknown'}${app.capturedAt ? `   Captured: ${app.capturedAt}` : ''}`,
  );
  lines.push(
    `Samples: ${capture.samples} at ${capture.intervalMs} ms   Sampled: ${capture.sampledSeconds} s   Busy JS: ${capture.busySeconds} s`,
  );
  for (const note of result.notes) {
    lines.push(`Note: ${note}`);
  }
  lines.push('');

  const withBaseline = Boolean(comparisons);
  const header = ['Metric', 'Value'];
  if (withBaseline) {
    header.push('Baseline range', 'Change', 'Status');
  }
  const rows = [header];
  for (const [key, metric] of Object.entries(result.metrics)) {
    const row = [metric.label, fmtValue(metric)];
    if (withBaseline) {
      const cmp = comparisons[key];
      if (cmp.status === 'no-baseline') {
        row.push('-', '-', 'no baseline');
      } else {
        const range =
          cmp.runs > 1 ? `${cmp.bandMin} - ${cmp.bandMax}` : String(cmp.baselineMedian);
        const change = cmp.deltaPct === null ? '-' : `${cmp.deltaPct > 0 ? '+' : ''}${cmp.deltaPct}%`;
        row.push(range, change, cmp.status);
      }
    }
    rows.push(row);
  }
  lines.push('Fixed metrics (frames are inclusive, as % of busy JS)');
  lines.push(renderTable(rows));

  const frameRows = [['Frame', 'Inclusive ms', '% busy', 'Self ms']];
  const listFrames = (list) =>
    list.map((f) => [f.name, f.inclusiveMs, `${f.inclusivePctBusy.toFixed(1)}%`, f.selfMs]);
  if (opts.top > 0) {
    lines.push('', `Longest tasks (seconds after the first sample)`);
    lines.push(
      renderTable([
        ['Starts at', 'Duration'],
        ...result.tasks.longest.map((task) => [`${task.startSeconds} s`, `${task.durationMs} ms`]),
      ]),
    );
    lines.push('', `Top ${opts.top} by self time`);
    lines.push(renderTable([...frameRows, ...listFrames(result.topSelf)]));
    lines.push('', `Top ${opts.top} by inclusive time (root excluded)`);
    lines.push(renderTable([...frameRows, ...listFrames(result.topInclusive)]));
  }

  if (result.baselineWarnings && result.baselineWarnings.length > 0) {
    lines.push('');
    for (const warning of result.baselineWarnings) {
      lines.push(`Warning: ${warning}`);
    }
  }
  if (result.checks) {
    lines.push('', 'Capture check');
    for (const check of result.checks) {
      lines.push(`  ${check.status.toUpperCase().padEnd(4)}  ${check.id}: ${check.detail}`);
    }
  }
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(HELP);
    return 0;
  }
  if (!opts.profile) {
    throw new UsageError('Pass a .cpuprofile file. Run with --help.');
  }

  const frameList = [...new Set([...DEFAULT_FRAMES, ...opts.frames])];
  const result = analyzeProfile(readJson(opts.profile), opts.profile, {
    frameList,
    extraFrames: opts.expect,
    top: opts.top,
    window: opts.window,
  });

  if (opts.baselines.length > 0) {
    const baselines = opts.baselines.map((file) => loadBaseline(file, frameList, opts.window));
    result.baseline = { files: baselines.map((baseline) => baseline.file) };
    result.comparisons = compareToBaselines(result, baselines);
    result.baselineWarnings = baselineWarnings(result, baselines);
  }
  if (opts.check) {
    result.checks = runChecks(result, opts);
  }

  console.log(opts.json ? JSON.stringify(result, null, 2) : renderText(result, opts));
  return result.checks && result.checks.some((check) => check.status === 'fail') ? 2 : 0;
}

try {
  process.exitCode = main();
} catch (error) {
  if (error instanceof UsageError) {
    console.error(`error: ${error.message}`);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
