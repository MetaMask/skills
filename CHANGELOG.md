# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Add `metamask-connect` skill to the `web3-tools` domain for building dApps with the MetaMask Connect SDK (`@metamask/connect-evm`, `@metamask/connect-multichain`, `@metamask/connect-solana`) and the wagmi `metaMask()` connector. A single progressive-disclosure skill (mirroring `smart-accounts-kit`): the routing `skill.md` points into `references/` (always-on `conventions`, `troubleshooting`) and `workflows/` (per-stack setup, sign/send for EVM + Solana, multichain `invokeMethod`, and migration from `@metamask/sdk`)

## [0.1.0]

### Added

- Add CLI discovery commands: `list`, `search`, and `describe`
- Add `metamask-skills` CLI with `sync`, `postinstall`, and `install` commands
- Add repo inference, repo-local skills cache support, bundled package fallback, and `SKILLS_AUTO_UPDATE=1` handling for consumer repos

[Unreleased]: https://github.com/MetaMask/skills/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/MetaMask/skills/releases/tag/v0.1.0
