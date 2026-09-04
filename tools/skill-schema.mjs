// Single source of truth for the skill contribution schema.
//
// Imported by the lint-skill-entry validator so that the documented schema and
// the enforced schema cannot drift apart. The installer's bundle-directory list
// in tools/install (Bash) mirrors BUNDLE_DIRS; keep the two in sync.

export const REQUIRED_FRONTMATTER = ['name', 'description'];
export const OPTIONAL_FRONTMATTER = ['maturity', 'base', 'scope', 'metadata'];

// Pre-rename spelling of `base`, still READ by tools/install so that content from a
// source on a different release cadence (the origin/main cache, a private overlay)
// keeps working while it migrates. Recognised, but the linter warns — it should not
// be used in new skills, and this list goes away once every source has renamed.
export const DEPRECATED_FRONTMATTER = ['mandatory'];

export const KNOWN_FRONTMATTER = [
  ...REQUIRED_FRONTMATTER,
  ...OPTIONAL_FRONTMATTER,
  ...DEPRECATED_FRONTMATTER,
];

export const MATURITY_VALUES = ['experimental', 'stable', 'deprecated'];

// `scope: user` installs to $HOME instead of the target repo; anything else is project scope.
export const SCOPE_VALUES = ['user', 'project'];

// `base: true` marks a skill as part of the required base set for every consumer
// repo it applies to: it installs regardless of the engineer's domain selection,
// so a fresh clone lands it with no flags. Reserve it for the small set that every
// engineer needs — each base skill is a permanent always-on cost in the operator's
// skill listing, and an oversized listing gets truncated, which silently strips the
// trigger cues from the skills nobody has invoked yet. Everything else stays
// domain-gated and opt-in.

// Directories the installer copies alongside skill.md (see tools/install).
export const BUNDLE_DIRS = ['references', 'scripts', 'assets', 'adapters', 'workflows', 'hooks'];

// Directories allowed beside skill.md: the bundle dirs plus the repo-overlay
// dir. Anything else is rejected, because the installer does not ship it and any
// reference to it would dangle post-install. `knowledge/` is not listed here
// because it is a per-DOMAIN directory, never a skill sibling; the installer
// delivers it via copy_domain_knowledge.
export const ALLOWED_SIBLING_DIRS = [...BUNDLE_DIRS, 'repos'];

export const KNOWN_REPOS = ['metamask-extension', 'metamask-mobile', 'core'];

// The description is always loaded into the operator's discovery surface, so it is the
// per-skill always-on cost, and the only part of a skill that carries its own trigger
// cues — cutting it makes the skill less likely to be selected when it is relevant.
//
// This is a REPO BUDGET, not an operator limit. No operator observed here rejects or
// truncates a longer one: `tools/install` emits the value verbatim, and descriptions
// well over 1024 characters install and load in Claude Code today. Treat a lower number
// as a deliberate budget decision, and cite the operator and version before claiming any
// figure is externally imposed.
export const DESCRIPTION_MAX = 1536;

// A base skill installs for every engineer, so its description is always-on
// context — and a description too thin to match anything is the failure mode
// that matters. The description is a skill's ENTIRE trigger surface — the model
// selects on it alone — so "General coding guidelines" will not fire on the work
// it governs. A base skill that never triggers is worse than one not installed,
// because it looks covered. State what it does AND when to use it.
export const BASE_DESCRIPTION_MIN = 120;

export const RECOMMENDED_SECTIONS = ['When To Use', 'Workflow'];

// kebab-case, matching the name regex Claude Code and OpenCode require.
export const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/u;

// The installer prepends this to generated output names; source names must not
// carry it.
export const INSTALLED_PREFIX = 'mms-';

// Frontmatter permitted on a domain knowledge file. Knowledge files are a distinct
// artifact from skills and take a different set — `domain` instead of `maturity`,
// and none of the installer-behaviour keys.
export const KNOWN_KNOWLEDGE_FRONTMATTER = ['name', 'domain', 'description'];
