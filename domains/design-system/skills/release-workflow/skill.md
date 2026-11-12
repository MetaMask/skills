---
name: release-workflow
description: >-
  Release process for the MetaMask Design System (MMDS) monorepo: create a
  release branch with the repo script, choose semver bumps, regenerate
  dependencies, rewrite package changelogs into consumer-facing entries,
  and document every breaking change in MIGRATION.md for both platforms.
  Use when cutting or reviewing an MMDS release, editing package
  changelogs on a release branch, or writing MIGRATION.md entries.
maturity: stable
---

# MMDS releases

Package `CHANGELOG.md` files are edited only on `release/*` branches. Feature
and fix PRs put consumer notes in the PR description and breaking-change
guidance in `MIGRATION.md`.

Lookup order: `knowledge/mmds-sources.md` (source:
[`../../knowledge/mmds-sources.md`](../../knowledge/mmds-sources.md)).

## When to use

- Cutting a release, or reviewing a release PR.
- Writing a `MIGRATION.md` entry for a breaking change in any PR.

## Workflow

1. **Create the release branch** with the repo script (overlay). It creates
   `release/<version>` and a release spec.
2. **Edit the release spec.** Bumps follow semver. Before 1.0, a minor bump
   may contain breaking changes; a patch is fixes and internal changes only.
   Release often for non-breaking changes; isolate large breaking changes
   (tokens, major component API changes) in their own release.
3. **Regenerate dependencies** with the constraints, install, and dedupe
   commands (overlay). Never edit peer dependencies by hand; the workspace
   tooling owns them and manual edits break the build.
4. **Rewrite changelogs** for consumers (below), then validate their format.
5. **Update `MIGRATION.md`** for every breaking change (below).
6. **Open the PR** with the release PR template, then build, test, lint, and
   validate changelogs.

## Changelog entries

- Consumer-facing only: props, methods, exports, behavior, runtime
  dependencies, breaking changes.
- Remove dev dependencies, internal tooling, and contributor-only docs.
- No commit-message regurgitation.
- Include the PR reference, and link breaking changes to their
  `MIGRATION.md` section.

```markdown
### Changed

- **BREAKING:** `ComponentName` uses a `variant` prop instead of the
  `isOldFlag` prop ([#<PR>](<url>))
  - See [Migration guide](./MIGRATION.md#from-version-0x0-to-0y0)
```

## `MIGRATION.md`

Update it for any prop rename, removal, or type change; a new required prop;
a removed or renamed export; narrowed types; or surprising behavior changes.
Update both platforms when both are affected, and the table of contents.

```markdown
## From version 0.X.0 to 0.Y.0

### ComponentName breaking change

**What changed:** old API vs new API, and why.

**Migration:** before and after code with the exact imports.

**Impact:** who is affected and what breaks.
```

Use realistic values in examples, never placeholders such as `0x123` or
"foo".

## Checklist

- [ ] Bumps follow semver.
- [ ] Changelogs are consumer-facing, with PR references; no dev
      dependencies.
- [ ] Every breaking change is in `MIGRATION.md` on each affected platform,
      with the table of contents updated.
- [ ] Changelog validation, build, tests, and lint pass.
