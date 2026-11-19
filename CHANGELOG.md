# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Extend the `testing/mobile-testing` component-view guidance with `When writing a new test`: mock every request the screen makes, wait for the settled screen, do not sleep or time off `Date.now()`, do not add per-test `{ timeout }` bumps, and run the test checking for `NetConnectNotAllowedError` before opening the PR.

## [0.4.0]

### Added

- Add recipe planning and cooking skills (`recipe-plan-and-dispatch`, `recipe-library-audit`, `recipe-performance`, `recipe-cook`, and setup), pinned to a single mm-harness version with an install-time version check, titled checklist steps, proof artifacts on proof steps, and a recommended mm-harness 0.96.33. ([#262](https://github.com/MetaMask/skills/pull/262), [#258](https://github.com/MetaMask/skills/pull/258), [#256](https://github.com/MetaMask/skills/pull/256), [#251](https://github.com/MetaMask/skills/pull/251), [#244](https://github.com/MetaMask/skills/pull/244), [#233](https://github.com/MetaMask/skills/pull/233), [#228](https://github.com/MetaMask/skills/pull/228), [#227](https://github.com/MetaMask/skills/pull/227), [#225](https://github.com/MetaMask/skills/pull/225), [#215](https://github.com/MetaMask/skills/pull/215), [#214](https://github.com/MetaMask/skills/pull/214), [#206](https://github.com/MetaMask/skills/pull/206))
- Add a shared, MCP-free `ui-development` baseline for looking up MetaMask Design System components, with thin Mobile and Extension overlays that do not pin a component inventory or require Storybook MCP. ([#242](https://github.com/MetaMask/skills/pull/242), [#213](https://github.com/MetaMask/skills/pull/213), [#212](https://github.com/MetaMask/skills/pull/212))
- Add mobile planning skills (`planning`, `planning-spec`, and `jira-brief`). ([#200](https://github.com/MetaMask/skills/pull/200))
- Add `notifications-category-sync` for syncing a client with the backend notifications category manifest, with a MetaMask Mobile overlay. ([#188](https://github.com/MetaMask/skills/pull/188))
- Add a PR review base skill. ([#184](https://github.com/MetaMask/skills/pull/184))
- Add generated Perps review checklists, composed from the Perps library and repository overlays rather than copied knowledge. ([#183](https://github.com/MetaMask/skills/pull/183), [#163](https://github.com/MetaMask/skills/pull/163), [#159](https://github.com/MetaMask/skills/pull/159))
- Generate `perps-review-pr/references/pack.json`, a machine-readable rule pack listing each criterion family with its areas, class, status and rules. Client-only families name their client, so a hosted review of one client never expects another client's rows. A direct invocation does not read the pack. ([#264](https://github.com/MetaMask/skills/pull/264))
- Add a profiling regression proposal skill that suggests follow-up actions after MetaMask Mobile CI has classified a Hermes CPU-profile regression. ([#179](https://github.com/MetaMask/skills/pull/179))
- Add activity mapper guidance, including cross-client advice. ([#187](https://github.com/MetaMask/skills/pull/187), [#177](https://github.com/MetaMask/skills/pull/177))
- Add check-nesting and component-view rules migrated from Consensys/skills. ([#175](https://github.com/MetaMask/skills/pull/175))
- Support explicit-only skill invocation, preserve repository overlays, and prune managed retired skill names during sync. ([#174](https://github.com/MetaMask/skills/pull/174))
- Extend the `performance` domain with measurement, anti-pattern scanning, and React Compiler error-triage and coverage antipattern skills. ([#170](https://github.com/MetaMask/skills/pull/170), [#169](https://github.com/MetaMask/skills/pull/169), [#165](https://github.com/MetaMask/skills/pull/165))
- Add a `typescript` domain with authoring and migration skills. ([#167](https://github.com/MetaMask/skills/pull/167))
- Add a `platform` domain covering Extension runtime architecture and failure modes. ([#166](https://github.com/MetaMask/skills/pull/166))
- Add a Mobile `selector-patterns` skill. ([#153](https://github.com/MetaMask/skills/pull/153))
- Add a `navigation` skill with a repo-agnostic base and a MetaMask Mobile overlay for `Routes` and `NavigationService`, marked `base: true` so it installs even when its domain is filtered out. ([#148](https://github.com/MetaMask/skills/pull/148))
- Add a `feature-flags` skill with a repo-agnostic base and a MetaMask Mobile overlay for version-gated remote flags, marked `base: true` so it installs even when its domain is filtered out. ([#147](https://github.com/MetaMask/skills/pull/147))
- Add an `analytics` skill (`platform/analytics`) with a repo-agnostic base and a MetaMask Mobile overlay for the canonical tracking API, marked `base: true` so it installs even when its domain is filtered out. ([#140](https://github.com/MetaMask/skills/pull/140))
- Add an `observability` domain with Sentry, Tempo, and telemetry cost-control skills. ([#76](https://github.com/MetaMask/skills/pull/76))
- Add skill rules that previously existed only in Farmslot fixtures. ([#238](https://github.com/MetaMask/skills/pull/238))

### Changed

- **BREAKING:** Install `planning`, `planning-spec`, and `jira-brief` by default as stable `base` skills for MetaMask Mobile and Extension (Core stays out of scope). They run when scope is ambiguous, the change is large, or the work is security-sensitive, performance-sensitive, or a contract or API change; `planning` calls `jira-brief` only when a Jira ticket is already identified; revert yes/no prompts and brief gates are tighter. Opt out with `yarn skills --exclude planning/planning,planning/planning-spec,planning/jira-brief --save`. An installed copy keeps its previous trigger until the next sync. ([#254](https://github.com/MetaMask/skills/pull/254), [#219](https://github.com/MetaMask/skills/pull/219), [#204](https://github.com/MetaMask/skills/pull/204))
- **BREAKING:** Update `testing/mobile-visual-testing` for `@metamask/client-mcp-core` 0.13.x and 0.14.0 and `@metamask/device-mcp` 0.7.0 and 0.8.0. The knowledge store commands, the knowledge-reuse step, and the `--goal` and `--flow-tags` launch flags are removed. Failures are now one-line JSON on stdout with `error.code`, `hint`, `retryable`, and per-class exit codes, and the Android guidance is corrected from a live emulator run. ([#249](https://github.com/MetaMask/skills/pull/249), [#211](https://github.com/MetaMask/skills/pull/211), [#164](https://github.com/MetaMask/skills/pull/164))
- **BREAKING:** Update `testing/visual-testing` for `@metamask/client-mcp-core` 0.13.1 and 0.14.0. The knowledge store commands, the mandatory knowledge-reuse step, and the `--preset` launch example are removed, and `yarn build:test` replaces the removed `yarn build:test:webpack` script. Failures are now one-line JSON on stdout with structured error codes, and the 0.14.0 commands (`mm inspect`, `mm hover`, `mm set-viewport`, `mm reload`, `mm stop`, and browser `mm scroll-to-element`) are documented. ([#248](https://github.com/MetaMask/skills/pull/248), [#210](https://github.com/MetaMask/skills/pull/210))
- Update `perps-review-pr` so shared checks are delegated, reports are shorter, checklist rows render as titles with detail lines, blocking checks are enforced, Core owns shared logic (advanced orders, Core root causes, Mobile parity), and formatters reuse Intl caching and client-utils; review requests can target a branch or a commit range, and the review rules were regenerated from the current Perps library. ([#261](https://github.com/MetaMask/skills/pull/261), [#260](https://github.com/MetaMask/skills/pull/260), [#253](https://github.com/MetaMask/skills/pull/253), [#239](https://github.com/MetaMask/skills/pull/239), [#235](https://github.com/MetaMask/skills/pull/235), [#229](https://github.com/MetaMask/skills/pull/229), [#224](https://github.com/MetaMask/skills/pull/224), [#222](https://github.com/MetaMask/skills/pull/222), [#201](https://github.com/MetaMask/skills/pull/201), [#192](https://github.com/MetaMask/skills/pull/192))
- Update `assets/react-compiler-migration` for running `react-compiler-marker` on offline checkouts, stopping on stale scans, and documenting shared-value writes. ([#246](https://github.com/MetaMask/skills/pull/246))
- Update the content guidelines skill with shared rules and Mobile and Extension overlays. ([#221](https://github.com/MetaMask/skills/pull/221))
- Update `testing/mobile-testing` with component-view flake rules (independent-load, `mockReset`, and Predict investigation findings) and reusable Appium interaction-stability patterns. ([#217](https://github.com/MetaMask/skills/pull/217), [#199](https://github.com/MetaMask/skills/pull/199), [#181](https://github.com/MetaMask/skills/pull/181))
- Add a `Rules (enforced by lint)` checklist to `testing/mobile-testing` component-view guidance: the flake anti-patterns ESLint rejects on `*.view.test.tsx` (arbitrary `jest.mock`, fake timers, `find*` nested in `waitFor`, awaiting a skeleton or sibling, pressing a node held across a remount, `clearAllMocks` without `mockReset`, fixed sleeps, and bare timeout bumps). Require `yarn eslint` on new CV tests before finishing. ([#231](https://github.com/MetaMask/skills/pull/231))
- Update the MetaMask Mobile performance overlay and animation references for React Native 0.86.x, Expo SDK 57, and Reanimated 4.x with `react-native-worklets` (use `scheduleOnRN` from a worklet). ([#203](https://github.com/MetaMask/skills/pull/203))
- Require the marketing section to stay last on mobile in `notifications-category-sync`. ([#196](https://github.com/MetaMask/skills/pull/196))

### Fixed

- Fix `recipe-cook` to record unreachable acceptance criteria at the plan step, keep the installed acceptance-cli path, and preserve the all-guard baseline exception. ([#252](https://github.com/MetaMask/skills/pull/252), [#234](https://github.com/MetaMask/skills/pull/234))
- Trigger the content guidelines skill on edits to existing strings as well as new ones. ([#250](https://github.com/MetaMask/skills/pull/250))
- Fix the `testing/visual-testing` CLI reference for screenshots, tabs, and duplicate matches, and fix the Redux state-manipulation guidance for React 18 and LavaMoat builds. ([#237](https://github.com/MetaMask/skills/pull/237), [#230](https://github.com/MetaMask/skills/pull/230))
- Finish `recipe-cook` tasks when criteria are still awaiting review. ([#208](https://github.com/MetaMask/skills/pull/208))
- Serialize updates of each shared skill source so concurrent syncs cannot race on Git's fetch state. ([#207](https://github.com/MetaMask/skills/pull/207))
- Shorten skill descriptions that exceeded the 1024-character catalog limit, including `typescript/tsc-blindspots`. ([#158](https://github.com/MetaMask/skills/pull/158), [#207](https://github.com/MetaMask/skills/pull/207))

## [0.3.1]

### Fixed

- Report a failed automatic sync instead of exiting 0 in silence. `postinstall` still never fails `yarn install`, but a non-zero sync (unknown saved domain, unreachable source, no Bash) now warns, so the caller's guard can react and a stale skill set is no longer mistaken for a fresh one. ([#154](https://github.com/MetaMask/skills/pull/154))
- Install base skills again when a private overlay is configured. `tools/sync` picked its installer with an `-x` test, which npm and Yarn make false by dropping the executable bit when unpacking, so it fell through to the overlay's copy of `tools/install` — and an overlay predating `base:` installed no base skills while still exiting 0. ([#154](https://github.com/MetaMask/skills/pull/154))

## [0.3.0]

### Added

- Add a `mobile-visual-testing` skill for MetaMask Mobile. ([#79](https://github.com/MetaMask/skills/pull/79))
- Add skill for Flashlight, a lighthouse tool for Android vitals ([#146](https://github.com/MetaMask/skills/pull/146))
- Add content-guidelines skill (MetaMask mobile) ([#137](https://github.com/MetaMask/skills/pull/137))
- Add assets domain skills ([#131](https://github.com/MetaMask/skills/pull/131))
- Add unified extension-testing skill (MMQA-2274) ([#130](https://github.com/MetaMask/skills/pull/130))
- Improve swaps cpu audit skill to include info for wider context ([#128](https://github.com/MetaMask/skills/pull/128))
- Update ui-development extension skill to include newly added DS components ([#124](https://github.com/MetaMask/skills/pull/124))
- Implement skill to add evm networks on extension repo ([#114](https://github.com/MetaMask/skills/pull/114))
- Unify Mobile testing skills (MMQA-2142) ([#86](https://github.com/MetaMask/skills/pull/86))
- Add Mobile test-layer-placement skill ([#80](https://github.com/MetaMask/skills/pull/80))
- Add mobile integration test skill ([#78](https://github.com/MetaMask/skills/pull/78))
- Install a **base skill set by default**. Skills marked `base: true` in frontmatter install on every automatic `postinstall` regardless of domain selection, so a fresh clone lands a useful set with no configuration. `yarn skills` is unchanged and still installs every domain. Opt out with `SKILLS_AUTO_UPDATE=0`. ([#135](https://github.com/MetaMask/skills/pull/135))
- Lint rules for base skills: a `base: true` skill cannot also be `experimental`, and its `description` must be long enough to self-trigger (`BASE_DESCRIPTION_MIN`). Both are errors, so CI fails rather than warning invisibly. ([#135](https://github.com/MetaMask/skills/pull/135))
- Validate `--domain` / `SKILLS_DOMAINS` against the domains that actually exist. A typo previously installed the base set and exited 0, which reads as success. ([#135](https://github.com/MetaMask/skills/pull/135))
- Add `swaps-cpu-profile-audit` skill for MetaMask Mobile: parse a recorded Hermes / React Native Release Profiler `.cpuprofile` and audit slow frames in swaps/bridge. ([#123](https://github.com/MetaMask/skills/pull/123))
- Add opt-in stale project skill pruning via `--prune-stale` and `SKILLS_PRUNE_STALE=1`.

### Changed

- Mobile testing guidance now defaults to the component-view layer, and the Appium local-run playbook moved into `mobile-testing`. ([#70](https://github.com/MetaMask/skills/pull/70), [#54](https://github.com/MetaMask/skills/pull/54))
- Component-view testing guidance gained flakiness and assertion patterns, now requires awaiting async-gated content, and bans nested `findBy` inside `waitFor`. ([#109](https://github.com/MetaMask/skills/pull/109), [#115](https://github.com/MetaMask/skills/pull/115), [#132](https://github.com/MetaMask/skills/pull/132))
- Extension testing guidance clarifies where integration tests belong. ([#134](https://github.com/MetaMask/skills/pull/134))
- The Extension UI skill is now an MMDS gateway. ([#138](https://github.com/MetaMask/skills/pull/138))
- **Breaking:** frontmatter key `mandatory` renamed to `base`. Update any skill still using `mandatory:`. ([#135](https://github.com/MetaMask/skills/pull/135))
- **Breaking:** `postinstall` now syncs by default. It previously required `SKILLS_AUTO_UPDATE=1`; the opt-out is now `SKILLS_AUTO_UPDATE=0`. An explicitly empty `SKILLS_AUTO_UPDATE=` keeps its old meaning (off) rather than being read as unset. ([#135](https://github.com/MetaMask/skills/pull/135))
- `base:` truthiness is consistent across all four implementations. The linter alone accepted `on`/`off`, so `base: on` linted clean while the installer skipped the skill. ([#135](https://github.com/MetaMask/skills/pull/135))
- Rewrite `CONTRIBUTING.md` and skill template for MetaMask/skills layout.
- `swaps-cpu-profile-audit` now audits the whole capture instead of swaps-owned files only: non-swaps frames that ran while the user was on a swaps screen are classified by their relation to the swaps call stacks (called by swaps, hosts the swaps screen, or concurrent with it), bucketed into named context areas, and reported alongside swaps rows. Every reported row carries an `Owned by swaps` column, and fix depth is gated on it. New `--context-min-pct` and `--swaps-only` analyzer flags.
- `swaps-cpu-profile-audit` reports swaps-owned areas, non-swaps areas on the swaps path, and non-swaps areas running concurrently as separate tables, so the per-area swaps detail is no longer diluted by context rows. The swaps table gained an inclusive-time column, and the report explains that self time on a leaf means a screen can trigger heavy work while showing ~0 ms of its own. Non-swaps rows in the fix table are now capped to the few that matter.

### Fixed

- Preserve configured skill sources ([#121](https://github.com/MetaMask/skills/pull/121))
- Harden validate script and review-pr skill security ([#64](https://github.com/MetaMask/skills/pull/64))
- `tools/sync` now execs the `tools/install` that shipped beside it in the pinned package, instead of preferring `$METAMASK_SKILLS_DIR/tools/install`. That path defaults to the `.skills-cache` clone tracking `origin/main` with no tag or commit pin, so an automatic `postinstall` could execute unreviewed shell from whatever was on `main` at that moment — bypassing lockfile pinning and release gating. The cache still supplies `domains/` content; it no longer supplies executable code. ([#135](https://github.com/MetaMask/skills/pull/135))
- Cap the delegated sync subprocess so a stalled child cannot hang `yarn install` indefinitely, and report an `ETIMEDOUT` explicitly rather than returning a bare exit 1. ([#135](https://github.com/MetaMask/skills/pull/135))
- Append `-oBatchMode=yes` to any existing `GIT_SSH_COMMAND` instead of replacing it. `GIT_TERMINAL_PROMPT`/`GIT_ASKPASS` cover HTTPS only — `ssh` reads `/dev/tty` directly — but overwriting the variable would break a custom key, an agent, or a `ProxyCommand` on the private overlay clone these guards exist to protect. ([#135](https://github.com/MetaMask/skills/pull/135))
- A saved `SKILLS_DOMAINS=` (written by the old picker for the "all" choice) is no longer read as "no saved selection". Those engineers were silently dropped to base-only, and because pruning is off by default their other skills stayed on disk and went stale rather than visibly disappearing. ([#135](https://github.com/MetaMask/skills/pull/135))
- `.skills.local` readers strip inline comments consistently. The Bash side kept the ` # comment` tail while the JS side stripped it, so a documented `SKILLS_DOMAINS=perps # my choice` resolved to the domain `perps#mychoice`. ([#135](https://github.com/MetaMask/skills/pull/135))
- `--select` with no valid entries now installs the base set instead of every domain. An empty result resolved to `all`, so mistyping the numbers did the opposite of narrowing the selection. ([#135](https://github.com/MetaMask/skills/pull/135))
- Preserve `METAMASK_SKILLS_DIR` and `CONSENSYS_SKILLS_DIR` entries when `sync --save` rewrites `.skills.local`.

## [0.2.0]

### Added

- Add controller-integration skill for mobile and extension ([#62](https://github.com/MetaMask/skills/pull/62))
- Add multiproject validation skill ([#48](https://github.com/MetaMask/skills/pull/48))
- Add write-perps-ticket product-authoring skill ([#58](https://github.com/MetaMask/skills/pull/58))
- Add breakdown-perps-tickets skill ([#57](https://github.com/MetaMask/skills/pull/57))
- Add component-scaffold skill for MetaMask Mobile ([#52](https://github.com/MetaMask/skills/pull/52))

### Changed

- Update docs for React Dev Tools Performance and Network tabs ([#71](https://github.com/MetaMask/skills/pull/71))
- Prefix all perps skill names with perps- ([#60](https://github.com/MetaMask/skills/pull/60))
- Add social-ai team to MetaMask Mobile codeowners overlay ([#53](https://github.com/MetaMask/skills/pull/53))
- Update design system UI skills ([#45](https://github.com/MetaMask/skills/pull/45))
- Recommend the Release Profiler → AI-agent .cpuprofile workflow ([#40](https://github.com/MetaMask/skills/pull/40))
- add: anti-pattern helper functions in spec files ([#67](https://github.com/MetaMask/skills/pull/67))
- Add EVM network integration skills ([#66](https://github.com/MetaMask/skills/pull/66))
- Add flaky-test-detection skill ([#61](https://github.com/MetaMask/skills/pull/61))

### Fixed

- Broken links in the PR template ([#68](https://github.com/MetaMask/skills/pull/68))

## [0.1.0]

### Added

- Add CLI discovery commands: `list`, `search`, and `describe`
- Add `metamask-skills` CLI with `sync`, `postinstall`, and `install` commands
- Add repo inference, repo-local skills cache support, bundled package fallback, and `SKILLS_AUTO_UPDATE=1` handling for consumer repos

[Unreleased]: https://github.com/MetaMask/skills/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/MetaMask/skills/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/MetaMask/skills/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/MetaMask/skills/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/MetaMask/skills/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/MetaMask/skills/releases/tag/v0.1.0
