import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TRACE_BASENAME = 'selector-usage-trace-assets-migration';

export const REPOS = {
  extension: {
    id: 'extension',
    label: 'metamask-extension',
    config: 'config.metamask-extension.json',
  },
  mobile: {
    id: 'mobile',
    label: 'metamask-mobile',
    config: 'config.metamask-mobile.json',
  },
};

export function fail(message, code = 2) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

export function normalizeRepoId(value) {
  if (value === 'extension' || value === 'metamask-extension') return 'extension';
  if (value === 'mobile' || value === 'metamask-mobile') return 'mobile';
  return null;
}

export function findRepoRoot(startDir = process.cwd()) {
  let current = path.resolve(startDir);
  for (;;) {
    if (fs.existsSync(path.join(current, '.git'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export function detectRepoId(repoRoot) {
  const remote = spawnSync('git', ['-C', repoRoot, 'remote', 'get-url', 'origin'], {
    encoding: 'utf8',
  });
  const url = remote.status === 0 ? remote.stdout.trim() : '';
  if (/metamask-extension/i.test(url)) return 'extension';
  if (/metamask-mobile/i.test(url)) return 'mobile';
  const base = path.basename(repoRoot).toLowerCase();
  if (base.startsWith('metamask-extension')) return 'extension';
  if (base.startsWith('metamask-mobile')) return 'mobile';
  return null;
}

export function resolveRepo({ repoArg, cwd = process.cwd() }) {
  const repoRoot = findRepoRoot(cwd);
  if (!repoRoot) {
    fail(
      'No git repository at or above the working directory. Run from inside a metamask-extension or metamask-mobile checkout.',
    );
  }
  let repoId;
  if (repoArg) {
    repoId = normalizeRepoId(repoArg);
    if (!repoId) fail(`--repo must be extension or mobile (got "${repoArg}")`);
  } else {
    repoId = detectRepoId(repoRoot);
    if (!repoId) {
      fail(
        `Could not tell whether ${repoRoot} is metamask-extension or metamask-mobile. Pass --repo extension or --repo mobile.`,
      );
    }
  }
  return { repoId, repoRoot };
}

export function scriptsDir() {
  return path.dirname(fileURLToPath(import.meta.url));
}

export function loadConfig(repoId) {
  const configPath = path.join(scriptsDir(), REPOS[repoId].config);
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    fail(`Could not read ${REPOS[repoId].config}: ${error.message}`);
  }
  if (!Array.isArray(config.roots) || config.roots.length === 0) {
    fail(`${REPOS[repoId].config} has no roots array`);
  }
  return config;
}

export function defaultOutDir(repoId, repoRoot) {
  const digest = createHash('sha256').update(repoRoot).digest('hex').slice(0, 8);
  const cacheBase =
    process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  return path.join(cacheBase, 'asset-selector-cleanup', `${repoId}-${digest}`);
}

export function normalizeRepoPath(value, repoRoot, cwd = process.cwd()) {
  let normalized = String(value).trim().replace(/\\/g, '/');
  if (path.isAbsolute(normalized)) {
    normalized = path.relative(repoRoot, normalized).split(path.sep).join('/');
  } else {
    normalized = path
      .relative(repoRoot, path.resolve(cwd, normalized))
      .split(path.sep)
      .join('/');
  }
  return normalized.replace(/^\.\//, '');
}

export function gitHead(repoRoot) {
  const result = spawnSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

export function runTrace({ repoId, repoRoot, outDir }) {
  const config = loadConfig(repoId);
  for (const root of config.roots) {
    if (!fs.existsSync(path.join(repoRoot, root.file))) {
      fail(`Root file ${root.file} not found under ${repoRoot}. Wrong repo or --repo value?`);
    }
  }
  fs.mkdirSync(outDir, { recursive: true });
  const docPath = path.join(outDir, `${TRACE_BASENAME}.md`);
  const generatedConfig = path.join(outDir, 'trace.config.json');
  fs.writeFileSync(
    generatedConfig,
    `${JSON.stringify({ ...config, output: docPath }, null, 2)}\n`,
  );
  const result = spawnSync(
    process.execPath,
    [path.join(scriptsDir(), 'trace-usage.js'), '--config', generatedConfig],
    { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  return {
    exitCode: result.status,
    error: result.error || null,
    stderr: result.stderr || '',
    stdout: result.stdout || '',
    summaryPath: docPath.replace(/\.md$/, '.json'),
    docPath,
    outDir,
    config,
  };
}

export function traceFailure(run) {
  if (run.error) return `Could not run trace-usage.js: ${run.error.message}`;
  if (run.exitCode === 2) {
    return `ripgrep (rg) failed or is missing on PATH: ${(run.stderr || '').trim()}`;
  }
  if (run.exitCode !== 0 && run.exitCode !== 3) {
    return `trace-usage.js exited with ${run.exitCode == null ? 'no status (killed?)' : run.exitCode}:\n${(run.stderr || run.stdout || '').trim()}`;
  }
  return null;
}

export function readSummary(summaryPath) {
  let summary;
  try {
    summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  } catch (error) {
    fail(`Could not read trace summary ${summaryPath}: ${error.message}`);
  }
  if (summary.schemaVersion !== 3) {
    fail(
      `Trace summary ${summaryPath} has schemaVersion ${summary.schemaVersion}; expected 3.`,
    );
  }
  return summary;
}

export function countLine(summary) {
  const { remaining } = summary;
  return `remaining: ${remaining.files} files (terminal ${remaining.terminalFiles}, non-terminal ${remaining.nonTerminalFiles}, importedSymbolSlots ${remaining.importedSymbolSlots})`;
}

export function readFlagValue(argv, index, flag, usage) {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) {
    fail(`${flag} needs a value\n${usage}`);
  }
  return value;
}

export function parseFlags(argv, spec, usage) {
  const parsed = {};
  for (const [flag, kind] of Object.entries(spec)) {
    parsed[flag] = kind === 'repeat' ? [] : kind === 'boolean' ? false : null;
  }
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const kind = spec[flag];
    if (kind === undefined) fail(`Unknown argument ${flag}\n${usage}`);
    if (kind === 'boolean') {
      parsed[flag] = true;
      continue;
    }
    const value = readFlagValue(argv, i, flag, usage);
    if (kind === 'repeat') parsed[flag].push(value);
    else parsed[flag] = value;
    i += 1;
  }
  return parsed;
}
