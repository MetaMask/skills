#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  REPOS,
  countLine,
  defaultOutDir,
  fail,
  gitHead,
  parseFlags,
  readSummary,
  resolveRepo,
  runTrace,
  traceFailure,
} from './run-trace.mjs';

const usage =
  'usage: node baseline.mjs [--repo extension|mobile] [--save <baseline.json>] [--out-dir <dir>]';

const options = parseFlags(process.argv.slice(2), {
  '--repo': 'value',
  '--save': 'value',
  '--out-dir': 'value',
}, usage);

const { repoId, repoRoot } = resolveRepo({ repoArg: options['--repo'] });
const outDir = options['--out-dir'] || defaultOutDir(repoId, repoRoot);
const run = runTrace({ repoId, repoRoot, outDir });
const failure = traceFailure(run);
if (failure) fail(failure, 2);

const summary = readSummary(run.summaryPath);
if (summary.status !== 'ok') {
  fail(
    `Trace status is "${summary.status}": ${summary.issues.join(' ')}\nNo baseline was saved.`,
    1,
  );
}

const savePath = options['--save'] || path.join(outDir, 'baseline.json');
fs.copyFileSync(run.summaryPath, savePath);

const trackedExports = summary.layers[0]?.importedSymbolSlots ?? 0;
process.stdout.write(
  [
    'asset-selector-cleanup baseline',
    `repo: ${REPOS[repoId].label} @ ${gitHead(repoRoot) ?? 'unknown commit'}`,
    `root: ${summary.roots.map((root) => root.file).join(', ')} (${trackedExports} tracked exports)`,
    countLine(summary),
    `baseline: ${savePath}`,
    `outputs: ${outDir}`,
    '',
  ].join('\n'),
);
