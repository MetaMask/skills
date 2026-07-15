# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Add `coding` TypeScript knowledge: `derive-dont-define-types` (derive from authoritative types; ad-hoc types duplicate, run too wide, and drift) and `avoid-any` (`any` disables type checking — substitute by position: assignee -> `unknown`, assigned -> `never`)

- Add `pr-workflow` skills (commit-discipline, diff-audit, pr-review-discipline + knowledge), `coding` skills (ts2589-workaround + TypeScript knowledge), and `general` skills (scope-lock, specifications-as-guardrails, diagnose-blockers)

## [0.1.0]

### Added

- Add CLI discovery commands: `list`, `search`, and `describe`
- Add `metamask-skills` CLI with `sync`, `postinstall`, and `install` commands
- Add repo inference, repo-local skills cache support, bundled package fallback, and `SKILLS_AUTO_UPDATE=1` handling for consumer repos

[Unreleased]: https://github.com/MetaMask/skills/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/MetaMask/skills/releases/tag/v0.1.0
