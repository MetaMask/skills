# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Install a **base skill set by default**. Skills marked `base: true` in frontmatter install on every automatic `postinstall` regardless of domain selection, so a fresh clone lands a useful set with no configuration. `yarn skills` is unchanged and still installs every domain. Opt out with `SKILLS_AUTO_UPDATE=0`. ([#135](https://github.com/MetaMask/skills/pull/135))
- Lint rules for base skills: a `base: true` skill cannot also be `experimental`, and its `description` must be long enough to self-trigger (`BASE_DESCRIPTION_MIN`). Both are errors, so CI fails rather than warning invisibly. ([#135](https://github.com/MetaMask/skills/pull/135))
- Validate `--domain` / `SKILLS_DOMAINS` against the domains that actually exist. A typo previously installed the base set and exited 0, which reads as success. ([#135](https://github.com/MetaMask/skills/pull/135))
- Add `swaps-cpu-profile-audit` skill for MetaMask Mobile: parse a recorded Hermes / React Native Release Profiler `.cpuprofile` and audit slow frames in swaps/bridge. ([#123](https://github.com/MetaMask/skills/pull/123))
- Add opt-in stale project skill pruning via `--prune-stale` and `SKILLS_PRUNE_STALE=1`.
- docs(testing): document CV stale-press flakiness plus high-leverage assert patterns (migration parity, filter both-sides example, loading/skeleton honesty, RefreshControl + flag overrides) in `mobile-testing` component-view and placement refs.

### Changed

- **Breaking:** frontmatter key `mandatory` renamed to `base`. Update any skill still using `mandatory:`. ([#135](https://github.com/MetaMask/skills/pull/135))
- **Breaking:** `postinstall` now syncs by default. It previously required `SKILLS_AUTO_UPDATE=1`; the opt-out is now `SKILLS_AUTO_UPDATE=0`. An explicitly empty `SKILLS_AUTO_UPDATE=` keeps its old meaning (off) rather than being read as unset. ([#135](https://github.com/MetaMask/skills/pull/135))
- `base:` truthiness is consistent across all four implementations. The linter alone accepted `on`/`off`, so `base: on` linted clean while the installer skipped the skill. ([#135](https://github.com/MetaMask/skills/pull/135))
- Rewrite `CONTRIBUTING.md` and skill template for MetaMask/skills layout.
- `swaps-cpu-profile-audit` now audits the whole capture instead of swaps-owned files only: non-swaps frames that ran while the user was on a swaps screen are classified by their relation to the swaps call stacks (called by swaps, hosts the swaps screen, or concurrent with it), bucketed into named context areas, and reported alongside swaps rows. Every reported row carries an `Owned by swaps` column, and fix depth is gated on it. New `--context-min-pct` and `--swaps-only` analyzer flags.
- `swaps-cpu-profile-audit` reports swaps-owned areas, non-swaps areas on the swaps path, and non-swaps areas running concurrently as separate tables, so the per-area swaps detail is no longer diluted by context rows. The swaps table gained an inclusive-time column, and the report explains that self time on a leaf means a screen can trigger heavy work while showing ~0 ms of its own. Non-swaps rows in the fix table are now capped to the few that matter.

### Fixed

- `tools/sync` now execs the `tools/install` that shipped beside it in the pinned package, instead of preferring `$METAMASK_SKILLS_DIR/tools/install`. That path defaults to the `.skills-cache` clone tracking `origin/main` with no tag or commit pin, so an automatic `postinstall` could execute unreviewed shell from whatever was on `main` at that moment — bypassing lockfile pinning and release gating. The cache still supplies `domains/` content; it no longer supplies executable code. ([#135](https://github.com/MetaMask/skills/pull/135))
- Cap the delegated sync subprocess so a stalled child cannot hang `yarn install` indefinitely, and report an `ETIMEDOUT` explicitly rather than returning a bare exit 1. ([#135](https://github.com/MetaMask/skills/pull/135))
- Append `-oBatchMode=yes` to any existing `GIT_SSH_COMMAND` instead of replacing it. `GIT_TERMINAL_PROMPT`/`GIT_ASKPASS` cover HTTPS only — `ssh` reads `/dev/tty` directly — but overwriting the variable would break a custom key, an agent, or a `ProxyCommand` on the private overlay clone these guards exist to protect. ([#135](https://github.com/MetaMask/skills/pull/135))
- A saved `SKILLS_DOMAINS=` (written by the old picker for the "all" choice) is no longer read as "no saved selection". Those engineers were silently dropped to base-only, and because pruning is off by default their other skills stayed on disk and went stale rather than visibly disappearing. ([#135](https://github.com/MetaMask/skills/pull/135))
- `.skills.local` readers strip inline comments consistently. The Bash side kept the ` # comment` tail while the JS side stripped it, so a documented `SKILLS_DOMAINS=perps # my choice` resolved to the domain `perps#mychoice`. ([#135](https://github.com/MetaMask/skills/pull/135))
- `--select` with no valid entries now installs the base set instead of every domain. An empty result resolved to `all`, so mistyping the numbers did the opposite of narrowing the selection. ([#135](https://github.com/MetaMask/skills/pull/135))
- Preserve `METAMASK_SKILLS_DIR` and `CONSENSYS_SKILLS_DIR` entries when `sync --save` rewrites `.skills.local`.

## [0.2.0]

### Added

- feat(skills): add controller-integration skill for mobile and extension ([#62](https://github.com/MetaMask/skills/pull/62))
- feat(perps): add multiproject validation skill ([#48](https://github.com/MetaMask/skills/pull/48))
- feat(perps): add write-perps-ticket product-authoring skill ([#58](https://github.com/MetaMask/skills/pull/58))
- feat(perps): add breakdown-perps-tickets skill ([#57](https://github.com/MetaMask/skills/pull/57))
- feat(ui): add component-scaffold skill for MetaMask Mobile ([#52](https://github.com/MetaMask/skills/pull/52))

### Changed

- chore: Update docs for React Dev Tools Performance and Network tabs ([#71](https://github.com/MetaMask/skills/pull/71))
- chore(perps): prefix all perps skill names with perps- ([#60](https://github.com/MetaMask/skills/pull/60))
- chore(pr-workflow): add social-ai team to MetaMask Mobile codeowners overlay ([#53](https://github.com/MetaMask/skills/pull/53))
- chore: Update design system UI skills ([#45](https://github.com/MetaMask/skills/pull/45))
- docs(performance): recommend the Release Profiler → AI-agent .cpuprofile workflow ([#40](https://github.com/MetaMask/skills/pull/40))
- add: anti-pattern helper functions in spec files ([#67](https://github.com/MetaMask/skills/pull/67))
- docs(swaps): add EVM network integration skills ([#66](https://github.com/MetaMask/skills/pull/66))
- Add flaky-test-detection skill ([#61](https://github.com/MetaMask/skills/pull/61))

### Fixed

- fix: broken links in the PR template ([#68](https://github.com/MetaMask/skills/pull/68))

## [0.1.0]

### Added

- Add CLI discovery commands: `list`, `search`, and `describe`
- Add `metamask-skills` CLI with `sync`, `postinstall`, and `install` commands
- Add repo inference, repo-local skills cache support, bundled package fallback, and `SKILLS_AUTO_UPDATE=1` handling for consumer repos

[Unreleased]: https://github.com/MetaMask/skills/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/MetaMask/skills/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/MetaMask/skills/releases/tag/v0.1.0
