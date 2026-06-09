// Single source of truth for the skill contribution schema.
//
// Imported by the lint-skill-entry validator so that the documented schema and
// the enforced schema cannot drift apart. The installer's bundle-directory list
// in tools/install (Bash) mirrors BUNDLE_DIRS; keep the two in sync.

export const REQUIRED_FRONTMATTER = ['name', 'description'];
export const OPTIONAL_FRONTMATTER = ['maturity', 'mandatory', 'scope'];
export const KNOWN_FRONTMATTER = [...REQUIRED_FRONTMATTER, ...OPTIONAL_FRONTMATTER];

export const MATURITY_VALUES = ['experimental', 'stable', 'deprecated'];

// Directories the installer copies alongside skill.md (see tools/install).
export const BUNDLE_DIRS = ['references', 'scripts', 'assets', 'adapters'];

// Directories allowed beside skill.md: the bundle dirs plus the repo-overlay
// dir. Anything else (notably knowledge/) is rejected, because the installer
// does not ship it and the reference would dangle post-install.
export const ALLOWED_SIBLING_DIRS = [...BUNDLE_DIRS, 'repos'];

export const KNOWN_REPOS = ['metamask-extension', 'metamask-mobile', 'core'];

// The description is always loaded into the operator's discovery surface, so it
// is the per-skill always-on cost. The ceiling is the per-operator minimum
// (OpenCode caps description at 1024), so a description that passes here is
// accepted by every target.
export const DESCRIPTION_MAX = 1024;

export const RECOMMENDED_SECTIONS = ['When To Use', 'Workflow'];

// kebab-case, matching the name regex Claude Code and OpenCode require.
export const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/u;

// The installer prepends this to generated output names; source names must not
// carry it.
export const INSTALLED_PREFIX = 'mms-';
