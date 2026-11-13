#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  REPOS,
  countLine,
  defaultOutDir,
  fail,
  gitHead,
  isBroadImportSymbol,
  normalizeRepoPath,
  parseFlags,
  readSummary,
  resolveRepo,
  runTrace,
  traceFailure,
} from './run-trace.mjs';

const usage = [
  'usage: node verify.mjs [--baseline <baseline.json>]',
  '       [--expect-file <repo-relative-path>]...',
  '       [--expect-selector <path>:<migration-selector>]...',
  '       [--repo extension|mobile] [--out-dir <dir>]',
].join('\n');

const options = parseFlags(process.argv.slice(2), {
  '--baseline': 'value',
  '--expect-file': 'repeat',
  '--expect-selector': 'repeat',
  '--repo': 'value',
  '--out-dir': 'value',
}, usage);

const { repoId, repoRoot } = resolveRepo({ repoArg: options['--repo'] });
const outDir = options['--out-dir'] || defaultOutDir(repoId, repoRoot);
const baselinePath = options['--baseline'] || path.join(outDir, 'baseline.json');
if (!fs.existsSync(baselinePath)) {
  fail(`Baseline not found: ${baselinePath}. Run baseline.mjs first, or pass --baseline.`);
}
const baseline = readSummary(baselinePath);
if (baseline.status !== 'ok') {
  fail(`Baseline status is "${baseline.status}": ${baseline.issues.join(' ')}`, 2);
}

const baselineWarnings = [];
const metaPath = `${baselinePath}.meta.json`;
if (fs.existsSync(metaPath)) {
  let meta;
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch {
    baselineWarnings.push(`unreadable baseline sidecar ${metaPath}; its identity is unknown`);
  }
  if (meta && meta.repoRoot && meta.repoRoot !== repoRoot) {
    baselineWarnings.push(
      `baseline was taken in ${meta.repoRoot}, not this checkout; take a fresh baseline`,
    );
  }
  if (meta && meta.head && meta.head !== gitHead(repoRoot)) {
    baselineWarnings.push(
      `baseline HEAD ${meta.head.slice(0, 12)} differs from current HEAD; if you committed or pulled since the baseline, take a fresh one before trusting the verdict`,
    );
  }
}

const run = runTrace({ repoId, repoRoot, outDir });
const failure = traceFailure(run);
if (failure) fail(failure, 2);
const current = readSummary(run.summaryPath);

if (JSON.stringify(baseline.roots) !== JSON.stringify(current.roots)) {
  fail('Baseline roots do not match the config for this repo. Take a fresh baseline.');
}

const before = new Map(baseline.files.map((file) => [file.path, file]));
const after = new Map(current.files.map((file) => [file.path, file]));
const removed = [...before.keys()].filter((p) => !after.has(p)).sort();
const added = [...after.keys()].filter((p) => !before.has(p)).sort();

const violations = [];
if (current.status !== 'ok') {
  violations.push(`trace status is "${current.status}": ${current.issues.join(' ')}`);
}

const expectedFiles = options['--expect-file'].map((value) =>
  normalizeRepoPath(value, repoRoot),
);
for (const target of expectedFiles) {
  if (after.has(target)) {
    const file = after.get(target);
    violations.push(
      `${target} is still remaining (selectors: ${file.selectors.join(', ') || 'none'}; migration selectors: ${file.migrationSelectors.join(', ') || 'none'})`,
    );
  } else if (!before.has(target)) {
    violations.push(`${target} was not in the baseline, so nothing was removed from it`);
  }
}

for (const value of options['--expect-selector']) {
  const separator = value.lastIndexOf(':');
  if (separator === -1) {
    fail(`--expect-selector must be <path>:<migration-selector> (got "${value}")\n${usage}`);
  }
  const target = normalizeRepoPath(value.slice(0, separator), repoRoot);
  const selector = value.slice(separator + 1);
  const prior = before.get(target);
  if (prior && !prior.migrationSelectors.includes(selector)) {
    violations.push(
      `${target} did not carry migration selector ${selector} in the baseline`,
    );
  } else if (after.has(target)) {
    if (after.get(target).migrationSelectors.includes(selector)) {
      violations.push(`${target} still carries migration selector ${selector}`);
    }
  } else if (!prior) {
    violations.push(`${target} was not in the baseline, so no selector was removed from it`);
  }
}

for (const addedPath of added) {
  const file = after.get(addedPath);
  violations.push(
    `new dependent: ${addedPath} (imports ${file.selectors.join(', ') || 'the module'})`,
  );
}

const changed = [];
for (const [filePath, file] of after) {
  const prior = before.get(filePath);
  if (!prior) continue;
  for (const flow of file.migrationSelectors) {
    if (!prior.migrationSelectors.includes(flow)) {
      violations.push(`new legacy flow: ${filePath} now also carries ${flow}`);
    }
  }
  for (const symbol of file.selectors) {
    if (isBroadImportSymbol(symbol) && !prior.selectors.includes(symbol)) {
      violations.push(`new broad import: ${filePath} now imports the module via "${symbol}"`);
    }
  }
  const bits = [];
  if (file.layer !== prior.layer) bits.push(`layer ${prior.layer}->${file.layer}`);
  const dropped = [
    ...new Set([
      ...prior.selectors.filter((s) => !file.selectors.includes(s)),
      ...prior.migrationSelectors.filter((s) => !file.migrationSelectors.includes(s)),
    ]),
  ];
  if (dropped.length > 0) bits.push(`-${dropped.join(',')}`);
  if (bits.length > 0) changed.push(`${filePath} (${bits.join(' ')})`);
}

function section(label, items, cap) {
  if (items.length === 0) return [`${label}: none`];
  const shown = items.slice(0, cap).map((item) => `  ${item}`);
  const overflow = items.length > cap ? [`  (+${items.length - cap} more)`] : [];
  return [`${label} (${items.length}):`, ...shown, ...overflow];
}

const expectedSet = new Set(expectedFiles);
const removedLines = removed.map((p) =>
  expectedSet.has(p) ? `${p} (expected)` : `${p} (cascade)`,
);

const verdict = violations.length === 0 ? 'PASS' : 'FAIL';
const report = [
  'asset-selector-cleanup verify',
  `repo: ${REPOS[repoId].label} @ ${gitHead(repoRoot) ?? 'unknown commit'}`,
  `root: ${current.roots.map((root) => root.file).join(', ')}`,
  `baseline: ${baselinePath} (${baseline.remaining.files} files before)`,
  countLine(current),
  ...section('warnings', baselineWarnings, 10),
  ...section('removed', removedLines, 20),
  ...section('violations', violations, 20),
  ...section('changed imports', changed, 10),
  `verdict: ${verdict}`,
  '',
];
process.stdout.write(report.join('\n'));
process.exit(verdict === 'PASS' ? 0 : 1);
