# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Add `typescript` domain (experimental) — TypeScript authoring and JS→TS migration guidance.

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
