#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const PUBLIC_REPO = 'https://github.com/MetaMask/skills.git';
const CACHE_RELATIVE_DIR = path.join('.skills-cache', 'metamask-skills');
const SOURCE_ENV_KEYS = ['METAMASK_SKILLS_DIR', 'CONSENSYS_SKILLS_DIR'];
const PACKAGE_NAME_TO_REPO = new Map([
  ['metamask', 'metamask-mobile'],
  ['metamask-crx', 'metamask-extension'],
  ['@metamask/core-monorepo', 'core'],
]);

function usage(exitCode = 0) {
  const out = exitCode === 0 ? process.stdout : process.stderr;
  out.write(`MetaMask skills CLI\n\nUsage:\n  metamask-skills sync [options]\n  metamask-skills postinstall [options]\n  metamask-skills install [options]\n\nOptions:\n  --target <path>   Consumer repo path (default: cwd)\n  --repo <name>     Consumer repo name (default: infer from git remote/package.json)\n\nCommon sync options are passed through to the shared installer:\n  --domain <list> --maturity <level> --include <list> --exclude <list> --save --dry-run\n\nSource order:\n  1. METAMASK_SKILLS_DIR / CONSENSYS_SKILLS_DIR when configured\n  2. <target>/.skills-cache/metamask-skills\n  3. bundled @metamask/skills package snapshot\n`);
  process.exit(exitCode);
}

function parseGlobalArgs(args) {
  const passthrough = [];
  let target = process.cwd();
  let repo;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--target') {
      target = path.resolve(args[i + 1] ?? '');
      passthrough.push(arg, args[i + 1] ?? '');
      i += 1;
    } else if (arg === '--repo') {
      repo = args[i + 1] ?? '';
      passthrough.push(arg, repo);
      i += 1;
    } else {
      passthrough.push(arg);
    }
  }

  return { target, repo, passthrough };
}

function hasArg(args, flag) {
  return args.includes(flag);
}

function isTruthy(value) {
  return /^(1|true|yes)$/iu.test(value ?? '');
}

function stripInlineComment(value) {
  let output = '';
  let quote = null;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if ((ch === '"' || ch === "'") && (i === 0 || value[i - 1] !== '\\')) {
      if (quote === ch) {
        quote = null;
      } else if (!quote) {
        quote = ch;
      }
      output += ch;
      continue;
    }
    if (ch === '#' && !quote && (i === 0 || /\s/u.test(value[i - 1]))) {
      break;
    }
    output += ch;
  }
  return output.trim();
}

function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseSkillsLocal(contents) {
  const parsed = {};
  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(line);
    if (!match) {
      continue;
    }
    const [, key, rawValue] = match;
    parsed[key] = unquote(stripInlineComment(rawValue));
  }
  return parsed;
}

function readSkillsLocal(target) {
  try {
    return parseSkillsLocal(readFileSync(path.join(target, '.skills.local'), 'utf8'));
  } catch {
    return {};
  }
}

function getConfigValue(env, localConfig, key) {
  if (Object.prototype.hasOwnProperty.call(env, key)) {
    return env[key];
  }
  return localConfig[key];
}

function expandHome(value) {
  if (!value) {
    return value;
  }
  if (value === '~') {
    return os.homedir();
  }
  if (value.startsWith('~/')) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

function dirExists(dir) {
  try {
    return statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

function hasSkillsSource(dir) {
  return Boolean(dir) && dirExists(path.join(dir, 'domains')) && dirExists(path.join(dir, 'tools'));
}

function isGitDir(dir) {
  return dirExists(path.join(dir, '.git'));
}

function run(cmd, args, options = {}) {
  return spawnSync(cmd, args, { stdio: options.stdio ?? 'pipe', encoding: 'utf8', ...options });
}

function inferRepoFromRemote(target) {
  const result = run('git', ['-C', target, 'remote', 'get-url', 'origin']);
  if (result.status !== 0) {
    return undefined;
  }
  const remote = `${result.stdout ?? ''}`.trim();
  const match = /(?:github\.com[:/])(?:[^/]+)\/([^/#]+?)(?:\.git)?(?:[#/].*)?$/u.exec(remote);
  return match?.[1];
}

function inferRepoFromPackage(target) {
  try {
    const pkg = JSON.parse(readFileSync(path.join(target, 'package.json'), 'utf8'));
    return PACKAGE_NAME_TO_REPO.get(pkg.name) ?? pkg.name;
  } catch {
    return undefined;
  }
}

function inferRepo(target) {
  return inferRepoFromRemote(target) ?? inferRepoFromPackage(target) ?? path.basename(target);
}

function cacheDir(target) {
  return path.join(target, CACHE_RELATIVE_DIR);
}

function warn(message) {
  process.stderr.write(`metamask-skills: ${message}\n`);
}

function ensurePublicSkillsCache(target) {
  const cache = cacheDir(target);
  try {
    if (isGitDir(cache)) {
      const fetchResult = run('git', ['-C', cache, 'fetch', '--depth', '1', 'origin', 'main']);
      if (fetchResult.status !== 0) {
        warn('cache fetch failed (offline?)');
        return false;
      }
      const resetResult = run('git', ['-C', cache, 'reset', '--hard', 'origin/main']);
      if (resetResult.status !== 0) {
        warn('cache reset failed');
        return false;
      }
      return true;
    }

    mkdirSync(path.dirname(cache), { recursive: true });
    const cloneResult = run('git', ['clone', '--depth', '1', '--branch', 'main', PUBLIC_REPO, cache]);
    if (cloneResult.status !== 0) {
      warn('cache clone failed (offline?)');
      return false;
    }
    return true;
  } catch (error) {
    warn(`cache refresh failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

function pickBash() {
  const candidates = [
    process.env.BASH,
    '/opt/homebrew/bin/bash',
    '/usr/local/bin/bash',
    '/bin/bash',
  ].filter(Boolean);

  for (const candidate of new Set(candidates)) {
    const result = run(candidate, ['--version']);
    if (result.status !== 0) {
      continue;
    }
    const match = `${result.stdout ?? ''}${result.stderr ?? ''}`.match(/version\s+(\d+)\./iu);
    if (match && Number(match[1]) >= 4) {
      return candidate;
    }
  }
  return undefined;
}

function validateConfiguredSource(name, dir) {
  if (!dir) {
    return undefined;
  }
  const resolved = path.resolve(expandHome(dir));
  if (!hasSkillsSource(resolved)) {
    throw new Error(`${name} points to ${dir}, but it is not a MetaMask skills source (missing domains/ or tools/).`);
  }
  return resolved;
}

function buildDelegatedEnv(target) {
  const env = { ...process.env };
  const localConfig = readSkillsLocal(target);

  for (const key of SOURCE_ENV_KEYS) {
    const value = getConfigValue(env, localConfig, key);
    const resolved = validateConfiguredSource(key, value);
    if (resolved) {
      env[key] = resolved;
    }
  }

  if (!env.METAMASK_SKILLS_DIR) {
    const cache = cacheDir(target);
    env.METAMASK_SKILLS_DIR = hasSkillsSource(cache) ? cache : PACKAGE_ROOT;
  }

  return { env, localConfig };
}

function delegate(script, target, repo, args, options = {}) {
  const bash = pickBash();
  if (!bash) {
    process.stderr.write('metamask-skills requires Bash 4+. Install current Bash, then retry.\n');
    return 1;
  }

  const { env } = buildDelegatedEnv(target);
  env.PATH = `${path.dirname(bash)}${path.delimiter}${env.PATH ?? ''}`;

  const delegatedArgs = [path.join(PACKAGE_ROOT, 'tools', script)];
  if (!hasArg(args, '--repo')) {
    delegatedArgs.push('--repo', repo);
  }
  if (!hasArg(args, '--target')) {
    delegatedArgs.push('--target', target);
  }
  delegatedArgs.push(...args);

  const result = spawnSync(bash, delegatedArgs, {
    stdio: options.stdio ?? 'inherit',
    env,
  });
  return result.status ?? 1;
}

function sync(args) {
  const { target, repo: repoOverride, passthrough } = parseGlobalArgs(args);
  const localConfig = readSkillsLocal(target);
  if (!getConfigValue(process.env, localConfig, 'METAMASK_SKILLS_DIR')) {
    ensurePublicSkillsCache(target);
  }
  const repo = repoOverride || inferRepo(target);
  return delegate('sync', target, repo, passthrough);
}

function install(args) {
  const { target, repo: repoOverride, passthrough } = parseGlobalArgs(args);
  const repo = repoOverride || inferRepo(target);
  return delegate('install', target, repo, passthrough);
}

function shouldSkipPostinstall(env) {
  return isTruthy(env.SKILLS_SKIP_POSTINSTALL) || (isTruthy(env.CI) && !isTruthy(env.SKILLS_FORCE_POSTINSTALL));
}

function postinstall(args) {
  const { target, repo: repoOverride, passthrough } = parseGlobalArgs(args);
  const localConfig = readSkillsLocal(target);

  if (shouldSkipPostinstall(process.env)) {
    return 0;
  }

  const cacheReady = ensurePublicSkillsCache(target);
  const autoUpdate = isTruthy(getConfigValue(process.env, localConfig, 'SKILLS_AUTO_UPDATE'));
  if (!autoUpdate) {
    return 0;
  }

  try {
    const { env } = buildDelegatedEnv(target);
    if (!cacheReady && !env.METAMASK_SKILLS_DIR && !env.CONSENSYS_SKILLS_DIR) {
      warn('auto-update skipped because no skills source is available');
      return 0;
    }
    const repo = repoOverride || inferRepo(target);
    const result = delegate('sync', target, repo, passthrough);
    return result === 0 ? 0 : 0;
  } catch (error) {
    warn(`auto-update failed: ${error instanceof Error ? error.message : String(error)}`);
    return 0;
  }
}

const [command, ...args] = process.argv.slice(2);
if (!command || command === '-h' || command === '--help') {
  usage(0);
}

let exitCode;
if (command === 'sync') {
  exitCode = sync(args);
} else if (command === 'postinstall') {
  exitCode = postinstall(args);
} else if (command === 'install') {
  exitCode = install(args);
} else {
  process.stderr.write(`Unknown command: ${command}\n\n`);
  usage(1);
}
process.exit(exitCode);
