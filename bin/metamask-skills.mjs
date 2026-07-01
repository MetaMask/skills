#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const PUBLIC_REPO = 'https://github.com/MetaMask/skills.git';
const CACHE_RELATIVE_DIR = path.join('.skills-cache', 'metamask-skills');
const SOURCE_ENV_KEYS = ['METAMASK_SKILLS_DIR', 'CONSENSYS_SKILLS_DIR'];
const TARGET_REPO_ENV_KEY = 'METAMASK_SKILLS_TARGET_REPO';

function usage(exitCode = 0) {
  const out = exitCode === 0 ? process.stdout : process.stderr;
  out.write(`MetaMask skills CLI

Usage:
  metamask-skills list [options]
  metamask-skills search <query> [options]
  metamask-skills describe <skill|domain/skill> [options]
  metamask-skills sync [options]
  metamask-skills postinstall [options]
  metamask-skills install [options]

Options:
  --target <path>   Consumer repo path (default: cwd)
  --repo <name>     Consumer repo name (default: infer from git/repository URL)

Discover skills:
  list              Show installable skills for the target repo
  search <query>    Search skill names and descriptions
  describe <skill>  Show one skill; accepts skill, mms-skill, or domain/skill

Common selection options:
  --domain <list> --maturity <level> --include <list> --exclude <list> --save --dry-run

Repo inference:
  1. --repo <name>
  2. METAMASK_SKILLS_TARGET_REPO from env or .skills.local
  3. git remote origin / package.json repository URL

Source order:
  1. METAMASK_SKILLS_DIR / CONSENSYS_SKILLS_DIR when configured
  2. <target>/.skills-cache/metamask-skills
  3. bundled @metamask/skills package snapshot
`);
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

function parseDiscoveryArgs(args) {
  const options = {
    target: process.cwd(),
    repo: undefined,
    domain: undefined,
    maturity: 'stable',
    includeInapplicable: false,
    json: false,
    terms: [],
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--target') {
      options.target = path.resolve(args[i + 1] ?? '');
      i += 1;
    } else if (arg === '--repo') {
      options.repo = args[i + 1] ?? '';
      i += 1;
    } else if (arg === '--domain') {
      options.domain = args[i + 1] ?? '';
      i += 1;
    } else if (arg === '--maturity') {
      options.maturity = args[i + 1] ?? 'stable';
      i += 1;
    } else if (arg === '--all') {
      options.maturity = 'experimental';
      options.includeInapplicable = true;
    } else if (arg === '--all-repos') {
      options.includeInapplicable = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '-h' || arg === '--help') {
      discoveryUsage(0);
    } else {
      options.terms.push(arg);
    }
  }

  if (!['experimental', 'stable', 'deprecated'].includes(options.maturity)) {
    throw new Error('--maturity must be experimental|stable|deprecated');
  }

  return options;
}

function discoveryUsage(exitCode = 0) {
  const out = exitCode === 0 ? process.stdout : process.stderr;
  out.write(`MetaMask skills discovery

Usage:
  metamask-skills list [options]
  metamask-skills search <query> [options]
  metamask-skills describe <skill|domain/skill> [options]

Options:
  --target <path>     Consumer repo path (default: cwd)
  --repo <name>       Consumer repo name (default: infer from git/repository URL)
  --domain <list>     Comma-separated domain filter
  --maturity <level>  Minimum maturity: experimental, stable, deprecated (default: stable)
  --all               Include experimental skills and skills for other repos
  --all-repos         Include skills that have overlays for other repos only
  --json              Print JSON
`);
  process.exit(exitCode);
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

function repoNameFromGitHubUrl(url) {
  const match = /(?:github\.com(?:-[^/:]+)?[:/])(?:[^/]+)\/([^/#]+?)(?:\.git)?(?:[#/].*)?$/u.exec(url);
  return match?.[1];
}

function inferRepoFromBasename(target) {
  const base = path.basename(target);
  if (/^metamask-mobile(?:-\d+)?$/u.test(base)) {
    return 'metamask-mobile';
  }
  if (/^metamask-extension(?:-\d+)?$/u.test(base)) {
    return 'metamask-extension';
  }
  if (/^core(?:-\d+)?$/u.test(base)) {
    return 'metamask-core';
  }
  return undefined;
}

function inferRepoFromRemote(target) {
  const result = run('git', ['-C', target, 'remote', 'get-url', 'origin']);
  if (result.status !== 0) {
    return undefined;
  }
  return repoNameFromGitHubUrl(`${result.stdout ?? ''}`.trim());
}

function inferRepoFromPackage(target) {
  try {
    const pkg = JSON.parse(readFileSync(path.join(target, 'package.json'), 'utf8'));
    const repository = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
    return repoNameFromGitHubUrl(repository ?? '');
  } catch {
    return undefined;
  }
}

function resolveRepo(target, repoOverride) {
  if (repoOverride) {
    return repoOverride;
  }
  const localConfig = readSkillsLocal(target);
  return (
    getConfigValue(process.env, localConfig, TARGET_REPO_ENV_KEY) ||
    inferRepoFromRemote(target) ||
    inferRepoFromPackage(target) ||
    inferRepoFromBasename(target) ||
    path.basename(target)
  );
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
    const match = `${result.stdout ?? ''}${result.stderr ?? ''}`.match(/version\s+(\d+)\.(\d+)/iu);
    // macOS ships Bash 3.2; the tools/ scripts are deliberately 3.2-compatible,
    // so accept Bash 3.2+ rather than forcing `brew install bash`.
    if (match) {
      const major = Number(match[1]);
      const minor = Number(match[2]);
      if (major > 3 || (major === 3 && minor >= 2)) {
        return candidate;
      }
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
    process.stderr.write('metamask-skills requires Bash 3.2+ (macOS /bin/bash works). Install Bash, then retry.\n');
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

function sourceDirsForDiscovery(target) {
  const { env } = buildDelegatedEnv(target);
  const dirs = [];
  for (const key of SOURCE_ENV_KEYS) {
    const dir = env[key];
    if (hasSkillsSource(dir) && !dirs.includes(dir)) {
      dirs.push(dir);
    }
  }
  return dirs;
}

function safeReadDir(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function readTextIfExists(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

function parseFrontmatter(contents) {
  const lines = contents.split(/\r?\n/u);
  if (lines[0] !== '---') {
    return {};
  }
  const metadata = {};
  let activeKey;
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === '---') {
      break;
    }
    const continuation = /^\s+(.+)$/u.exec(line);
    if (continuation && activeKey) {
      metadata[activeKey] = `${metadata[activeKey]} ${continuation[1].trim()}`.trim();
      continue;
    }
    const match = /^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/u.exec(line);
    if (!match) {
      activeKey = undefined;
      continue;
    }
    const [, key, value] = match;
    activeKey = key;
    const trimmedValue = value.trim();
    if (/^[>|][+-]?$/u.test(trimmedValue)) {
      metadata[key] = '';
      continue;
    }
    metadata[key] = unquote(trimmedValue);
  }
  return metadata;
}

function bodyAfterFrontmatter(contents) {
  const lines = contents.split(/\r?\n/u);
  if (lines[0] !== '---') {
    return contents;
  }
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === '---') {
      return lines.slice(i + 1).join('\n').trim();
    }
  }
  return '';
}

function maturityMatches(skillMaturity, minimumMaturity) {
  if (minimumMaturity === 'experimental') {
    return true;
  }
  if (minimumMaturity === 'stable') {
    return skillMaturity === 'stable' || skillMaturity === 'deprecated' || !skillMaturity;
  }
  return skillMaturity === 'deprecated';
}

function splitList(value) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function domainMatches(domain, filter) {
  const domains = splitList(filter);
  return domains.length === 0 || domains.includes(domain);
}

function repoOverlays(skillDir) {
  const reposDir = path.join(skillDir, 'repos');
  return safeReadDir(reposDir)
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name.replace(/\.md$/u, ''))
    .sort();
}

function collectSkills(sources, repo) {
  const byKey = new Map();
  for (const source of sources) {
    const domainsDir = path.join(source, 'domains');
    for (const domainEntry of safeReadDir(domainsDir)) {
      if (!domainEntry.isDirectory()) {
        continue;
      }
      const domain = domainEntry.name;
      const skillsDir = path.join(domainsDir, domain, 'skills');
      for (const skillEntry of safeReadDir(skillsDir)) {
        if (!skillEntry.isDirectory()) {
          continue;
        }
        const skillDir = path.join(skillsDir, skillEntry.name);
        const skillFile = path.join(skillDir, 'skill.md');
        const contents = readTextIfExists(skillFile);
        if (!contents) {
          continue;
        }
        const metadata = parseFrontmatter(contents);
        const overlays = repoOverlays(skillDir);
        const repoApplicable = overlays.length === 0 || overlays.includes(repo);
        const name = metadata.name || skillEntry.name;
        byKey.set(`${domain}/${skillEntry.name}`, {
          domain,
          id: `${domain}/${skillEntry.name}`,
          name,
          installedName: `mms-${name}`,
          description: metadata.description || '',
          maturity: metadata.maturity || 'stable',
          mandatory: isTruthy(metadata.mandatory),
          scope: metadata.scope || 'project',
          source,
          path: skillDir,
          repos: overlays,
          repoApplicable,
          body: bodyAfterFrontmatter(contents),
        });
      }
    }
  }
  return [...byKey.values()].sort((a, b) => {
    const domainCompare = a.domain.localeCompare(b.domain);
    if (domainCompare !== 0) {
      return domainCompare;
    }
    return a.name.localeCompare(b.name);
  });
}

function filterSkills(skills, options) {
  return skills.filter((skill) => {
    if (!domainMatches(skill.domain, options.domain)) {
      return false;
    }
    if (!maturityMatches(skill.maturity, options.maturity)) {
      return false;
    }
    if (!options.includeInapplicable && !skill.repoApplicable) {
      return false;
    }
    return true;
  });
}

function formatSkillTable(skills) {
  if (skills.length === 0) {
    return 'No skills matched. Try --all or --maturity experimental.\n';
  }
  const rows = skills.map((skill) => [
    skill.id,
    skill.maturity,
    skill.scope,
    skill.description,
  ]);
  const widths = [
    Math.max('skill'.length, ...rows.map((row) => row[0].length)),
    Math.max('maturity'.length, ...rows.map((row) => row[1].length)),
    Math.max('scope'.length, ...rows.map((row) => row[2].length)),
  ];
  const header = `${'skill'.padEnd(widths[0])}  ${'maturity'.padEnd(widths[1])}  ${'scope'.padEnd(widths[2])}  description`;
  const sep = `${'-'.repeat(widths[0])}  ${'-'.repeat(widths[1])}  ${'-'.repeat(widths[2])}  -----------`;
  const body = rows
    .map((row) => `${row[0].padEnd(widths[0])}  ${row[1].padEnd(widths[1])}  ${row[2].padEnd(widths[2])}  ${row[3]}`)
    .join('\n');
  return `${header}\n${sep}\n${body}\n`;
}

function discoveryContext(args) {
  const options = parseDiscoveryArgs(args);
  const repo = resolveRepo(options.target, options.repo);
  const sources = sourceDirsForDiscovery(options.target);
  const skills = collectSkills(sources, repo);
  return { options, repo, sources, skills };
}

function listSkills(args) {
  const { options, repo, sources, skills } = discoveryContext(args);
  const filtered = filterSkills(skills, options);
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ repo, sources, skills: filtered }, null, 2)}\n`);
    return 0;
  }
  process.stdout.write(`MetaMask skills\n  repo:     ${repo}\n  target:   ${options.target}\n  sources:  ${sources.join(', ')}\n  maturity: ${options.maturity}\n  domain:   ${options.domain || '<all>'}\n\n`);
  process.stdout.write(formatSkillTable(filtered));
  process.stdout.write('\nTip: install one skill with `metamask-skills sync --include domain/skill --save`.\n');
  return 0;
}

function searchSkills(args) {
  const { options, repo, sources, skills } = discoveryContext(args);
  const query = options.terms.join(' ').trim().toLowerCase();
  if (!query) {
    discoveryUsage(1);
  }
  const filtered = filterSkills(skills, options).filter((skill) => (
    skill.id.toLowerCase().includes(query) ||
    skill.name.toLowerCase().includes(query) ||
    skill.description.toLowerCase().includes(query)
  ));
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ query, repo, sources, skills: filtered }, null, 2)}\n`);
    return 0;
  }
  process.stdout.write(`MetaMask skills search: ${query}\n  repo: ${repo}\n\n`);
  process.stdout.write(formatSkillTable(filtered));
  return 0;
}

function findSkill(skills, selector) {
  const normalized = selector.trim();
  return skills.filter((skill) => (
    skill.id === normalized ||
    skill.name === normalized ||
    skill.installedName === normalized ||
    `mms-${skill.name}` === normalized
  ));
}

function describeSkill(args) {
  const { options, repo, sources, skills } = discoveryContext(args);
  const selector = options.terms[0];
  if (!selector) {
    discoveryUsage(1);
  }
  const matches = findSkill(skills, selector);
  if (matches.length === 0) {
    process.stderr.write(`No skill matched: ${selector}\n`);
    return 1;
  }
  if (matches.length > 1) {
    process.stderr.write(`Multiple skills matched ${selector}; use domain/skill:\n`);
    for (const skill of matches) {
      process.stderr.write(`  - ${skill.id}\n`);
    }
    return 1;
  }
  const [skill] = matches;
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ repo, sources, skill }, null, 2)}\n`);
    return 0;
  }
  process.stdout.write(`${skill.id}\n`);
  process.stdout.write(`  name:        ${skill.name}\n`);
  process.stdout.write(`  install as:  ${skill.installedName}\n`);
  process.stdout.write(`  maturity:    ${skill.maturity}\n`);
  process.stdout.write(`  scope:       ${skill.scope}\n`);
  process.stdout.write(`  repo match:  ${skill.repoApplicable ? 'yes' : `no (${skill.repos.join(', ')})`}\n`);
  process.stdout.write(`  source:      ${skill.source}\n`);
  process.stdout.write(`  path:        ${skill.path}\n`);
  process.stdout.write(`  description: ${skill.description}\n\n`);
  process.stdout.write(`Install this skill:\n  metamask-skills sync --include ${skill.id} --save\n`);
  if (skill.body) {
    const preview = skill.body.split(/\r?\n/u).slice(0, 24).join('\n');
    process.stdout.write(`\nPreview:\n${preview}\n`);
  }
  return 0;
}

function sync(args) {
  const { target, repo: repoOverride, passthrough } = parseGlobalArgs(args);
  const localConfig = readSkillsLocal(target);
  if (!getConfigValue(process.env, localConfig, 'METAMASK_SKILLS_DIR')) {
    ensurePublicSkillsCache(target);
  }
  const repo = resolveRepo(target, repoOverride);
  return delegate('sync', target, repo, passthrough);
}

function install(args) {
  const { target, repo: repoOverride, passthrough } = parseGlobalArgs(args);
  const repo = resolveRepo(target, repoOverride);
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
    const repo = resolveRepo(target, repoOverride);
    const result = delegate('sync', target, repo, passthrough);
    return result === 0 ? 0 : 0;
  } catch (error) {
    warn(`auto-update failed: ${error instanceof Error ? error.message : String(error)}`);
    return 0;
  }
}

export {
  bodyAfterFrontmatter,
  collectSkills,
  domainMatches,
  expandHome,
  filterSkills,
  findSkill,
  formatSkillTable,
  getConfigValue,
  hasArg,
  isTruthy,
  maturityMatches,
  parseDiscoveryArgs,
  parseFrontmatter,
  parseGlobalArgs,
  parseSkillsLocal,
  inferRepoFromBasename,
  repoNameFromGitHubUrl,
  repoOverlays,
  hasSkillsSource,
  shouldSkipPostinstall,
  splitList,
  stripInlineComment,
  unquote,
};

// Compare resolved real paths: npm installs the bin as a symlink in
// node_modules/.bin, so process.argv[1] (the symlink) won't match import.meta.url
// (the realpath) directly. realpathSync resolves both to the same file.
function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === '-h' || command === '--help') {
    usage(0);
  }

  let exitCode;
  try {
    if (command === 'list') {
      exitCode = listSkills(args);
    } else if (command === 'search') {
      exitCode = searchSkills(args);
    } else if (command === 'describe') {
      exitCode = describeSkill(args);
    } else if (command === 'sync') {
      exitCode = sync(args);
    } else if (command === 'postinstall') {
      exitCode = postinstall(args);
    } else if (command === 'install') {
      exitCode = install(args);
    } else {
      process.stderr.write(`Unknown command: ${command}\n\n`);
      usage(1);
    }
  } catch (error) {
    process.stderr.write(`metamask-skills: ${error instanceof Error ? error.message : String(error)}\n`);
    exitCode = 1;
  }
  process.exit(exitCode);
}
