#!/usr/bin/env node
//
// Structural validator for skill contributions.
//
// Reuses the installer's own parser (bin/metamask-skills.mjs collectSkills /
// parseFrontmatter) so that it validates exactly what ships, rather than a
// parallel model. Errors block; warnings advise. Exits non-zero on any error.
//
// Run against the repo:        node .github/scripts/lint-skill-entry.mjs
// Run against another tree:     SKILLS_LINT_ROOT=/path node .github/scripts/lint-skill-entry.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectSkills, parseFrontmatter } from '../../bin/metamask-skills.mjs';
import {
  ALLOWED_SIBLING_DIRS,
  DESCRIPTION_MAX,
  INSTALLED_PREFIX,
  KNOWN_FRONTMATTER,
  KNOWN_KNOWLEDGE_FRONTMATTER,
  KNOWN_REPOS,
  MATURITY_VALUES,
  NAME_PATTERN,
  SCOPE_VALUES,
  RECOMMENDED_SECTIONS,
} from '../../tools/skill-schema.mjs';

const ROOT = process.env.SKILLS_LINT_ROOT
  ? path.resolve(process.env.SKILLS_LINT_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const allowedSiblings = new Set(ALLOWED_SIBLING_DIRS);
const TRUTHY = new Set(['1', 'true', 'yes', 'on']);
const FALSY = new Set(['0', 'false', 'no', 'off']);

export function lintSkill(skill) {
  const errors = [];
  const warnings = [];
  const dirName = skill.id.slice(skill.domain.length + 1);

  let raw;
  try {
    raw = parseFrontmatter(readFileSync(path.join(skill.path, 'skill.md'), 'utf8'));
  } catch (error) {
    return { errors: [`could not read skill.md: ${error.message}`], warnings };
  }

  if (!raw.name) {
    errors.push('missing required `name` in frontmatter');
  } else {
    if (raw.name !== dirName) {
      errors.push(`\`name\` "${raw.name}" must match the directory "${dirName}"`);
    }
    if (!NAME_PATTERN.test(raw.name)) {
      errors.push(`\`name\` "${raw.name}" must be kebab-case`);
    }
    if (raw.name.startsWith(INSTALLED_PREFIX)) {
      errors.push(`source \`name\` must not carry the \`${INSTALLED_PREFIX}\` prefix; the installer adds it`);
    }
  }

  if (!raw.description) {
    errors.push('missing required `description` in frontmatter');
  } else if (raw.description.length > DESCRIPTION_MAX) {
    errors.push(`\`description\` is ${raw.description.length} chars, over the ${DESCRIPTION_MAX}-char budget`);
  }

  if (raw.maturity && !MATURITY_VALUES.includes(raw.maturity)) {
    errors.push(`\`maturity\` "${raw.maturity}" must be one of: ${MATURITY_VALUES.join(', ')}`);
  }

  // `scope` and `mandatory` change installer behaviour, and a typo in either is a silent
  // no-op today: the key is accepted, no enum runs, and the skill installs in a way the
  // author did not intend. `scope: users` falls back to project scope; `mandatory: ture`
  // is falsy. Warnings rather than errors — the blocking surface stays small.
  if (raw.scope !== undefined && !SCOPE_VALUES.includes(raw.scope)) {
    warnings.push(`\`scope\` "${raw.scope}" is not one of: ${SCOPE_VALUES.join(', ')} (installs as project scope)`);
  }
  if (raw.mandatory !== undefined && !TRUTHY.has(String(raw.mandatory).toLowerCase()) && !FALSY.has(String(raw.mandatory).toLowerCase())) {
    warnings.push(`\`mandatory\` "${raw.mandatory}" is neither truthy nor falsy (treated as false)`);
  }

  // On-demand-only contract: a source skill must not force persistent loading.
  if (raw.alwaysApply !== undefined && TRUTHY.has(String(raw.alwaysApply).toLowerCase())) {
    errors.push('skills are on-demand only; remove `alwaysApply: true` (always-on guidance belongs in AGENTS.md)');
  }

  // Sibling directories: bundle dirs and repos/ only. knowledge/ is rejected.
  let entries = [];
  try {
    entries = readdirSync(skill.path, { withFileTypes: true });
  } catch {
    // skill dir vanished mid-run; nothing to check
  }
  for (const entry of entries) {
    if (entry.isDirectory() && !allowedSiblings.has(entry.name)) {
      errors.push(`unexpected directory "${entry.name}/" beside skill.md (allowed: ${[...allowedSiblings].join(', ')}); domain knowledge belongs in references/`);
    }
  }

  for (const repo of skill.repos) {
    if (!KNOWN_REPOS.includes(repo)) {
      warnings.push(`repos/${repo}.md targets an unknown consumer (known: ${KNOWN_REPOS.join(', ')})`);
    }
  }

  for (const key of Object.keys(raw)) {
    if (!KNOWN_FRONTMATTER.includes(key) && key !== 'alwaysApply') {
      warnings.push(`unknown frontmatter key "${key}"; operators silently ignore unrecognised keys (typo?)`);
    }
  }

  for (const section of RECOMMENDED_SECTIONS) {
    // A trailing `\b` let `## When To Use Cases` satisfy `When To Use` — a different
    // section. Anchoring to end-of-line fixes that but rejects `## Workflows` and
    // `## Workflow (interactive)`, both of which are the section, and both of which exist
    // in this corpus. So: optional plural, optional parenthetical qualifier, nothing else.
    if (!new RegExp(`^#{1,4}\\s+${section}s?(?:\\s*\\([^)]*\\))?\\s*$`, 'imu').test(skill.body)) {
      warnings.push(`missing recommended section "## ${section}"`);
    }
  }

  return { errors, warnings };
}

// Restrict to skills touched by the given file paths (the CI gate passes the
// PR's changed files, so pre-existing drift in untouched skills never blocks an
// unrelated change). With no paths, every skill is linted (a full audit).
function skillsForPaths(skills, paths) {
  const resolved = paths.map((file) => path.resolve(ROOT, file));
  return skills.filter((skill) =>
    resolved.some((file) => file === skill.path || file.startsWith(`${skill.path}${path.sep}`)),
  );
}

// A changed path under domains/ must live at domains/<domain>/skills/<name>/… and that
// skill root must have a readable skill.md — or be domain knowledge at
// domains/<domain>/knowledge/<file>.md.
//
// This has to run BEFORE the collectSkills filter, not inside the per-skill loop.
// collectSkills only returns directories that already match the expected layout and parse,
// so anything malformed is invisible to it — a misplaced file, a SKILL.md casing error, or
// a skill.md deleted in the same PR all produced "0 skill(s) checked, 0 error(s)" and a
// green run. The shape has to be checked from the path side, where the malformed cases
// actually exist.
export const SKILL_PATH = /^domains\/([^/]+)\/skills\/([^/]+)\/(?:[^/]+\/)*[^/]+$/u;
export const KNOWLEDGE_PATH = /^domains\/([^/]+)\/knowledge\/([^/]+)$/u;

export function validatePathShape(file, root = ROOT) {
  const normalized = file.split(path.sep).join('/');
  if (!normalized.startsWith('domains/')) {
    return null;
  }
  if (KNOWLEDGE_PATH.test(normalized)) {
    return null;
  }
  const match = SKILL_PATH.exec(normalized);
  if (!match) {
    return `path "${normalized}" is not under domains/<domain>/skills/<name>/`;
  }
  const [, domain, name] = match;
  const skillRoot = path.join(root, 'domains', domain, 'skills', name);
  try {
    statSync(path.join(skillRoot, 'skill.md'));
  } catch {
    return `skill root "domains/${domain}/skills/${name}/" has no readable skill.md`;
  }
  return null;
}

export function lintKnowledgeFile(file, root = ROOT) {
  const errors = [];
  const warnings = [];
  const normalized = file.split(path.sep).join('/');
  const match = KNOWLEDGE_PATH.exec(normalized);
  if (!match) {
    return { errors, warnings };
  }
  const [, domain, basename] = match;
  if (!basename.endsWith('.md')) {
    errors.push(`knowledge file "${normalized}" must be a .md file`);
    return { errors, warnings };
  }
  const stem = basename.slice(0, -3);
  let raw;
  try {
    raw = parseFrontmatter(readFileSync(path.join(root, file), 'utf8'));
  } catch (error) {
    return { errors: [`could not read ${normalized}: ${error.message}`], warnings };
  }

  if (!raw.name) {
    errors.push('missing required `name` in frontmatter');
  } else {
    if (raw.name !== stem) {
      errors.push(`\`name\` "${raw.name}" must match the filename stem "${stem}"`);
    }
    if (!NAME_PATTERN.test(raw.name)) {
      errors.push(`\`name\` "${raw.name}" must be kebab-case`);
    }
  }

  if (!raw.domain) {
    errors.push('missing required `domain` in frontmatter');
  } else if (raw.domain !== domain) {
    errors.push(`\`domain\` "${raw.domain}" must match the parent domain "${domain}"`);
  }

  if (!raw.description) {
    errors.push('missing required `description` in frontmatter');
  } else if (raw.description.length > DESCRIPTION_MAX) {
    errors.push(`\`description\` is ${raw.description.length} chars, over the ${DESCRIPTION_MAX}-char budget`);
  }

  for (const key of Object.keys(raw)) {
    if (!KNOWN_KNOWLEDGE_FRONTMATTER.includes(key)) {
      warnings.push(`unknown knowledge frontmatter key "${key}" (allowed: ${KNOWN_KNOWLEDGE_FRONTMATTER.join(', ')})`);
    }
  }

  return { errors, warnings };
}

function main() {
  const paths = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
  let errorCount = 0;
  let warningCount = 0;
  let knowledgeChecked = 0;

  for (const file of paths) {
    const problem = validatePathShape(file);
    if (problem) {
      console.log(`\nerror:   ${problem}`);
      errorCount += 1;
      continue;
    }
    const normalized = file.split(path.sep).join('/');
    if (!KNOWLEDGE_PATH.test(normalized)) {
      continue;
    }
    knowledgeChecked += 1;
    const { errors, warnings } = lintKnowledgeFile(file);
    if (errors.length > 0 || warnings.length > 0) {
      console.log(`\n${normalized}`);
      for (const message of errors) {
        console.log(`  error:   ${message}`);
      }
      for (const message of warnings) {
        console.log(`  warning: ${message}`);
      }
    }
    errorCount += errors.length;
    warningCount += warnings.length;
  }

  // '*' rather than undefined: the linter never reads repoApplicable, but relying on that
  // would break silently if `repo` became required.
  const all = collectSkills([ROOT], '*');
  const skills = paths.length > 0 ? skillsForPaths(all, paths) : all;

  for (const skill of skills) {
    const { errors, warnings } = lintSkill(skill);
    if (errors.length > 0 || warnings.length > 0) {
      console.log(`\n${skill.id}`);
      for (const message of errors) {
        console.log(`  error:   ${message}`);
      }
      for (const message of warnings) {
        console.log(`  warning: ${message}`);
      }
    }
    errorCount += errors.length;
    warningCount += warnings.length;
  }

  const checkedBits = [`${skills.length} skill(s) checked`];
  if (paths.length > 0 || knowledgeChecked > 0) {
    checkedBits.push(`${knowledgeChecked} knowledge file(s) checked`);
  }
  console.log(`\n${checkedBits.join(', ')}, ${errorCount} error(s), ${warningCount} warning(s).`);
  // Set exitCode rather than process.exit() so buffered stdout flushes when it
  // is a pipe (e.g. under CI or execFileSync), instead of being truncated.
  process.exitCode = errorCount > 0 ? 1 : 0;
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main();
}
