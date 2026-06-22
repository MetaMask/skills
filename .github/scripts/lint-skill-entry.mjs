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

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectSkills, parseFrontmatter } from '../../bin/metamask-skills.mjs';
import {
  ALLOWED_SIBLING_DIRS,
  DESCRIPTION_MAX,
  INSTALLED_PREFIX,
  KNOWN_FRONTMATTER,
  KNOWN_REPOS,
  MATURITY_VALUES,
  NAME_PATTERN,
  RECOMMENDED_SECTIONS,
} from '../../tools/skill-schema.mjs';

const ROOT = process.env.SKILLS_LINT_ROOT
  ? path.resolve(process.env.SKILLS_LINT_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const allowedSiblings = new Set(ALLOWED_SIBLING_DIRS);
const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

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
    errors.push(`\`description\` is ${raw.description.length} chars, over the ${DESCRIPTION_MAX}-char operator ceiling`);
  }

  if (raw.maturity && !MATURITY_VALUES.includes(raw.maturity)) {
    errors.push(`\`maturity\` "${raw.maturity}" must be one of: ${MATURITY_VALUES.join(', ')}`);
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
    if (!new RegExp(`^#{1,4}\\s+${section}\\b`, 'imu').test(skill.body)) {
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

function main() {
  const paths = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
  const all = collectSkills([ROOT]);
  const skills = paths.length > 0 ? skillsForPaths(all, paths) : all;
  let errorCount = 0;
  let warningCount = 0;

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

  console.log(`\n${skills.length} skill(s) checked, ${errorCount} error(s), ${warningCount} warning(s).`);
  // Set exitCode rather than process.exit() so buffered stdout flushes when it
  // is a pipe (e.g. under CI or execFileSync), instead of being truncated.
  process.exitCode = errorCount > 0 ? 1 : 0;
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main();
}
