# Contributing to MetaMask Skills

Thank you for your interest in contributing to [MetaMask/skills](https://github.com/MetaMask/skills)!
This repository is the shared source of agent skills, domain knowledge, and the
`@metamask/skills` installer CLI for the MetaMask ecosystem.

## Code of Conduct

This project follows the [MetaMask Code of Conduct](https://github.com/MetaMask/.github/blob/main/CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

## What Makes a Good Skill?

A well-crafted skill should:

- **Solve a real problem** — Address a genuine need for MetaMask engineers or Web3 developers
- **Be self-contained** — Include the context an AI agent needs to execute the skill
- **Target the right audience** — Place it under the correct domain (`web3-tools`, `perps`, `testing`, etc.)
- **Declare maturity** — Use `experimental`, `stable`, or `deprecated` in frontmatter
- **Be well-documented** — Clear instructions, examples, and expected outcomes

### Is it a skill, or does it belong in an enforcement layer?

Skills shape generation. Linters, fitness functions, and hooks enforce. The two do
different work, and any pattern load-bearing enough to encode probably wants both.

| Layer | Mechanism | Can an agent bypass it? | Timing |
|-------|-----------|-------------------------|--------|
| Skills (`domains/<area>/skills/<name>/skill.md`) | Generation-time guidance | Yes — suggestive only | Before output |
| AI rules (`AGENTS.md`, `.cursor/rules/*.mdc`, `CLAUDE.md`) | Context injection | Yes — suggestive only | Before output |
| Hooks (Claude Code `PreToolUse`, Cursor hooks) | Runtime interception | No | At tool call |
| Linters, fitness functions, CI | Validation | No | After output |

Three ways a proposed skill fails this test:

- **A skill that substitutes for enforcement is unsafe.** An agent can ignore any context
  it is given, so anything that must not be bypassed belongs in a hook or a lint rule.
- **A skill that restates what a deterministic check already verifies is wasteful.** It
  spends context on every invocation to duplicate ground truth that CI produces for free.
- **A skill that teaches the upstream pattern, so the enforcement layer rarely has to fire,
  is the right shape.** An existing lint rule is evidence the pattern matters enough to
  encode at both layers — name the layer the skill pairs with.

The question to answer in review is not *"is this redundant with the linter?"* but *"is this
doing generation-time work the linter cannot?"*

### Does it earn its context budget?

Frontmatter for every installed skill is loaded at agent startup, as fixed overhead that
grows linearly with the catalogue. A skill that is never selected still costs its
`description` on every run.

- Not a duplicate of a skill that already exists — check `metamask-skills list` first.
- Actionable rather than aspirational: steps an agent can follow, not principles to admire.
- Scoped so a reader can tell when it applies — neither one repo's quirk nor "good code".
- `description` within the ceiling in [`tools/skill-schema.mjs`](tools/skill-schema.mjs). It is
  the lowest limit across operators, so a description that passes is accepted by all of them.

`yarn audit:skills` checks the deterministic properties — directory layout, name pattern,
frontmatter keys, maturity values, description length — so review time goes to the two
questions above, which no check can answer.

## How to Contribute

### Adding a New Skill

1. **Fork and clone** the repository:

   ```bash
   git clone https://github.com/YOUR_USERNAME/skills.git
   cd skills
   ```

2. **Create a branch** for your skill:

   ```bash
   git checkout -b add-skill/your-skill-name
   ```

3. **Create the skill under a domain**:

   ```bash
   mkdir -p domains/<area>/skills/<skill-name>
   ```

   Examples: `domains/testing/skills/…`, `domains/perps/skills/…`,
   `domains/web3-tools/skills/…`.

4. **Add `skill.md`** — This is the only required file. See the
   [skill template](.github/SKILL_TEMPLATE.md) and [Authoring a skill](README.md#authoring-a-skill)
   in the README for frontmatter and layout.

5. **Add optional supporting files**:

   - `references/` — Additional documentation, API references, examples
   - `scripts/` — Helper scripts (bash, Python, etc.)
   - `adapters/` — Optional runtime payloads used by scripts
   - `repos/<consuming-repo>.md` — Repo-specific overlays (`metamask-extension.md`,
     `metamask-mobile.md`, `core.md`)

6. **Test your skill** — Install locally against a consumer repo before submitting.
   `--repo` must match the repo you are installing into:

   ```bash
   # Mobile:
   ./tools/install --repo metamask-mobile --target /path/to/metamask-mobile --domain <area>

   # Core:
   ./tools/install --repo core --target /path/to/core --domain <area>

   # dApp / Web3:
   ./tools/install --repo my-dapp --target /path/to/my-dapp --domain web3-tools

   # Or exercise the CLI package:
   yarn smoke
   yarn test
   node bin/metamask-skills.mjs list --target /path/to/consumer-repo
   ```

7. **Submit a Pull Request** with:

   - A clear title describing the skill
   - What the skill does and who it is for
   - Any relevant context or use cases

### Improving Existing Skills

- Fix typos, improve clarity, or add examples
- Update outdated information
- Add missing edge cases or error handling
- Improve security considerations
- Add or refresh repo overlays under `repos/`

### CLI / tooling changes

Changes under `bin/`, `tools/`, or install behavior ship via the published
`@metamask/skills` package. Add a consumer-facing entry under
`## [Unreleased]` in `CHANGELOG.md`, and follow
[docs/processes/releasing.md](docs/processes/releasing.md) when cutting a release.

### Reporting Issues

If you find a bug or have a suggestion:

1. Check if an issue already exists
2. If not, open a new issue with:
   - A clear, descriptive title
   - Steps to reproduce (if applicable)
   - Expected vs actual behavior
   - Any relevant context

## Skill Structure

Each skill lives under a domain:

```
domains/<area>/
  skills/<skill-name>/
    skill.md                    # Required: base skill definition
    references/                 # Optional: supporting docs
    scripts/                    # Optional: helper scripts
    adapters/                   # Optional: runtime payloads
    repos/<consuming-repo>.md   # Optional: repo-specific overlay
  knowledge/                    # Optional: shared domain reference
```

### `skill.md` Format

Your `skill.md` should include YAML frontmatter plus body content:

```yaml
---
name: <slash-command-name>
description: <≤1,536 chars including when_to_use cues>
maturity: stable          # experimental | stable | deprecated
---
```

Body guidance:

1. **Title and purpose** — What the skill does
2. **When to use** — Triggers and scope (also reflected in `description`)
3. **Instructions** — Step-by-step guidance for the AI agent
4. **Examples** — Concrete usage examples
5. **Troubleshooting** — Common issues and solutions

Source files use lowercase `skill.md`. The installer writes multi-operator
output as `mms-<name>` (`SKILL.md` / `RULE.md` under consumer skill dirs).
See the README for full frontmatter, overlay, and install details.

## Review Process

1. A maintainer will review your PR
2. They may request changes or clarifications
3. Once approved, your skill will be merged
4. CLI-facing changes should include changelog entries and ship in a package release

## Security Considerations

- **Never include private keys, seeds, or secrets** in skill files
- **Validate all user inputs** in any scripts
- **Use secure defaults** for any configurations
- **Document security implications** of the skill's actions

If you discover a security issue in an existing skill or the installer, please
report it privately following MetaMask's
[security policy](https://github.com/MetaMask/metamask-extension/security/policy)
or this repo's [SECURITY.md](SECURITY.md).

## Questions?

Feel free to open an issue for any questions about contributing. We're here to help!
