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
  metamask-skills hooks [options]
  metamask-skills install [options]

Options:
  --target <path>   Consumer repo path (default: cwd)
  --repo <name>     Consumer repo name (default: infer from git/repository URL)

Discover skills:
  list              Show installable skills for the target repo
  search <query>    Search skill names and descriptions
  describe <skill>  Show one skill; accepts skill, mms-skill, or domain/skill

Common selection options:
  --domain <list> --maturity <level> --include <list> --exclude <list> --save --prune-stale --dry-run

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

// Append BatchMode to whatever ssh configuration the engineer already has, rather
// than replacing it. Overwriting would break a custom key, a 1Password/Secretive
// agent or a ProxyCommand — on the `git@github.com:Consensys/skills.git` clone that
// these guards exist to protect, and on the explicit `yarn skills` path too, since
// buildDelegatedEnv() is shared.
function sshCommandWithBatchMode(env = process.env) {
  const base = env.GIT_SSH_COMMAND?.trim();
  if (!base) {
    return 'ssh -oBatchMode=yes';
  }
  return /(^|\s)-o\s*BatchMode=/u.test(base) ? base : `${base} -oBatchMode=yes`;
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

// Git operations here run during `postinstall`, on the critical path of
// `yarn install`. Two things must not happen there:
//
//   - A credential prompt. A fetch against a private source (the Consensys
//     overlay) can block on stdin forever, hanging the install with no output.
//     GIT_TERMINAL_PROMPT=0 and an empty GIT_ASKPASS turn that into an
//     immediate, reportable failure. Those two cover HTTPS only — ssh reads
//     /dev/tty directly for passphrase and host-key prompts and ignores both, so
//     GIT_SSH_COMMAND adds BatchMode. The private Consensys overlay is documented
//     as an ssh clone and gets `git pull --ff-only` on every automatic sync, so
//     this is the path most likely to block. (The delegate() timeout bounds such a
//     hang; BatchMode prevents it.)
//   - An unbounded wait. A stalled connection would hang just as long, so every
//     spawn is capped. Callers can override with an explicit `timeout`.
//
// Both belong here rather than in a consumer's package.json: this is where the
// risky call is made, and an env prefix on the npm script would leak the setting
// to the whole process tree.
//
// The cap is generous on purpose. It exists to stop an indefinite hang, not to
// enforce a performance budget — the slowest call is a shallow clone of the
// skills repo, which is quick on a good connection but can take minutes on a
// poor one or through a VPN. Cutting a legitimately slow clone short would drop
// the engineer to the stale bundled snapshot, which is worse than waiting.
// Override per call with an explicit `timeout`.
const SPAWN_TIMEOUT_MS = 300_000;

// `delegate()` wraps a Bash script that itself makes several capped calls, so its
// budget has to exceed a single spawn's. If both used SPAWN_TIMEOUT_MS the outer
// timer would fire first — after the wrapper's own startup cost — and kill a
// legitimately slow clone from the outside, dropping the engineer to the stale
// bundled snapshot. That is the exact outcome the cap above is written to avoid.
const DELEGATE_TIMEOUT_MS = SPAWN_TIMEOUT_MS * 2;

function run(cmd, args, options = {}) {
  return spawnSync(cmd, args, {
    stdio: options.stdio ?? 'pipe',
    encoding: 'utf8',
    timeout: SPAWN_TIMEOUT_MS,
    ...options,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GIT_ASKPASS: '',
      GIT_SSH_COMMAND: sshCommandWithBatchMode(),
      ...options.env,
    },
  });
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
    // Local, and probed up to four times per delegate call — the network cap
    // would be absurd here. An interpreter that can't print its version in
    // seconds is not one to hand a script to.
    const result = run(candidate, ['--version'], { timeout: 10_000 });
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
  // tools/sync runs `git pull` against each configured source, and one of them is
  // a private repo. Without this, an engineer whose credentials aren't cached gets
  // a git prompt blocking on stdin during `yarn install`, with no indication why.
  // Fail fast instead; the caller reports it and continues.
  const env = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GIT_ASKPASS: '',
    GIT_SSH_COMMAND: sshCommandWithBatchMode(),
  };
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

  // Capped for the same reason as run(): this runs from postinstall, so a stalled
  // child would hang `yarn install` indefinitely.
  //
  // Deliberately SIGTERM (the default), not SIGKILL. spawnSync's timeout signals
  // only the direct child, so neither signal reaches an in-flight `git` grandchild
  // — killing the whole tree would need `spawn` with `detached: true` and
  // `process.kill(-pid)`. Given that, SIGTERM is strictly better: it at least lets
  // Bash run a trap and clean up, where SIGKILL guarantees it cannot. A `git` child
  // can still outlive the timeout and hold .git/index.lock; that is a known gap,
  // not something the signal choice fixes.
  const result = spawnSync(bash, delegatedArgs, {
    stdio: options.stdio ?? 'inherit',
    timeout: DELEGATE_TIMEOUT_MS,
    ...options,
    env: { ...env, ...options.env },
  });

  // On timeout spawnSync reports status === null, which would otherwise be
  // indistinguishable from an ordinary failure. Say so explicitly: the whole point
  // of the cap is a reportable failure rather than a silent hang.
  if (result.error?.code === 'ETIMEDOUT') {
    const seconds = Math.round((options.timeout ?? DELEGATE_TIMEOUT_MS) / 1000);
    process.stderr.write(
      `metamask-skills: ${script} exceeded ${seconds}s and was terminated. ` +
        'Skills were not updated; the bundled snapshot is still in place.\n',
    );
    return 1;
  }
  if (result.error) {
    process.stderr.write(`metamask-skills: failed to run ${script}: ${result.error.message}\n`);
    return 1;
  }
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
          base: isTruthy(metadata.base),
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

  // Auto-update is on by default so a fresh clone lands the base set from a
  // plain `yarn install`, with no flags and nothing to read first. Engineers who
  // want to manage skills by hand set SKILLS_AUTO_UPDATE=0 (or
  // SKILLS_SKIP_POSTINSTALL=1 to skip this entirely).
  //
  // Only a genuinely absent key defaults to on. An explicitly empty
  // `SKILLS_AUTO_UPDATE=` is a choice, not an absence: under 0.2.0 `isTruthy('')`
  // was false, so engineers wrote exactly that to turn syncing off. Treating it as
  // unset would silently re-enable it for them — and it would contradict the rule
  // load_saved() applies to an empty SKILLS_DOMAINS, where presence of the key
  // preserves its previous meaning.
  const configured = getConfigValue(process.env, localConfig, 'SKILLS_AUTO_UPDATE');
  const autoUpdate = configured === undefined ? true : isTruthy(configured);
  if (!autoUpdate) {
    return 0;
  }

  const cacheReady = ensurePublicSkillsCache(target);

  try {
    const { env } = buildDelegatedEnv(target);
    if (!cacheReady && !env.METAMASK_SKILLS_DIR && !env.CONSENSYS_SKILLS_DIR) {
      warn('auto-update skipped because no skills source is available');
      return 0;
    }
    const repo = resolveRepo(target, repoOverride);
    // An automatic install nobody asked for should be the minimum that works:
    // the base set. An explicit `yarn skills` still defaults to every domain,
    // because the engineer asked for skills and expects to get them.
    //
    // This only changes sync's *fallback*. A saved SKILLS_DOMAINS, an env var,
    // or a --domain flag all still win, so an engineer who opted into a domain
    // does not silently lose it on their next install.
    const result = delegate('sync', target, repo, passthrough, {
      env: { SKILLS_DEFAULT_SCOPE: 'base' },
    });
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


/**
 * Print the Claude Code registration for every hook an installed skill ships.
 *
 * The installer copies `hooks/` like any other bundle directory, but a hook does nothing
 * until it is registered in settings.json — and the path to register is absolute, so it
 * differs per machine and per consumer repo and cannot be documented as a constant. This
 * resolves it against the actual install.
 */
function printHookRegistration(args) {
  const { target } = parseGlobalArgs(args);
  const skillsDir = path.join(target, '.claude', 'skills');

  let entries = [];
  try {
    for (const skill of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!skill.isDirectory()) continue;
      const hooks = path.join(skillsDir, skill.name, 'hooks');
      if (!dirExists(hooks)) continue;
      for (const file of readdirSync(hooks)) {
        if (file.endsWith('.py')) entries.push(path.join(hooks, file));
      }
    }
  } catch {
    warn(`no installed skills found under ${skillsDir}`);
    return 1;
  }

  if (entries.length === 0) {
    process.stdout.write('No installed skill ships a hook.\n');
    return 0;
  }

  const commands = entries
    .map((f) => `            { "type": "command", "command": "python3 ${f}" }`)
    .join(',\n');

  process.stdout.write(
    `${entries.length} hook(s) installed. Copying a hook does not activate it — Claude Code\n` +
      `runs one only once it is registered. Add this to ~/.claude/settings.json, or to\n` +
      `${path.join(target, '.claude', 'settings.json')} to scope it to this repo:\n\n` +
      '  {\n    "hooks": {\n      "PreToolUse": [\n        {\n          "matcher": "Bash",\n          "hooks": [\n' +
      `${commands}\n` +
      '          ]\n        }\n      ]\n    }\n  }\n',
  );
  return 0;
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
    } else if (command === 'hooks') {
      exitCode = printHookRegistration(args);
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
