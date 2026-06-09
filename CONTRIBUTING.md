# Contributing to MetaMask OpenClaw Skills

Thank you for your interest in contributing to the MetaMask OpenClaw Skills repository! This document provides guidelines for contributing new skills and improving existing ones.

## Code of Conduct

This project follows the [MetaMask Code of Conduct](https://github.com/MetaMask/.github/blob/main/CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

## What Makes a Good Skill?

A well-crafted skill should:

- **Solve a real problem** — Address a genuine need for MetaMask users or Ethereum developers
- **Be self-contained** — Include all necessary context for an AI agent to execute the skill
- **Follow best practices** — Implement security considerations and proper error handling
- **Be well-documented** — Include clear instructions, examples, and expected outcomes

## How to Contribute

### Adding a New Skill

1. **Fork and clone** the repository:
   ```bash
   git clone https://github.com/MetaMask/skills.git
   cd skills
   ```

2. **Create a branch** for your skill:
   ```bash
   git checkout -b add-skill/your-skill-name
   ```

3. **Create the skill directory** under the relevant domain:
   ```bash
   mkdir -p domains/<domain>/skills/<skill-name>
   ```

4. **Add your `skill.md`** — This is the only required file. See [Authoring a skill](README.md#authoring-a-skill) for the canonical layout and frontmatter, and the [skill template](.github/SKILL_TEMPLATE.md) for a starting point.

5. **Add optional supporting files** alongside `skill.md`:
   - `references/` — supporting docs the skill reads on demand
   - `scripts/` — helper scripts the skill can run
   - `repos/<repo>.md` — a per-repo overlay merged into the skill body at install time

6. **Test your skill** — Ensure the skill works as expected with an AI agent before submitting.

7. **Submit a Pull Request** with:
   - A clear title describing the skill
   - A description of what the skill does
   - Any relevant context or use cases

### Improving Existing Skills

- Fix typos, improve clarity, or add examples
- Update outdated information
- Add missing edge cases or error handling
- Improve security considerations

### Reporting Issues

If you find a bug or have a suggestion:

1. Check if an issue already exists
2. If not, open a new issue with:
   - A clear, descriptive title
   - Steps to reproduce (if applicable)
   - Expected vs actual behavior
   - Any relevant context

## Skill Structure

Each skill lives under a domain and follows this structure:

```
domains/<domain>/
└── skills/<skill-name>/
    ├── skill.md           # Required: the skill definition
    ├── references/        # Optional: supporting docs read on demand
    │   ├── api.md
    │   └── examples.md
    ├── scripts/           # Optional: helper scripts
    │   └── helper.sh
    └── repos/             # Optional: per-repo overlays
        └── metamask-extension.md
```

See [Authoring a skill](README.md#authoring-a-skill) for the canonical layout and the frontmatter schema.

### `skill.md` format

Each `skill.md` begins with YAML frontmatter (`name`, `description`, and optional `maturity`), documented in full under [Authoring a skill](README.md#authoring-a-skill). The body should give the agent everything it needs to act:

1. **When To Use** — the conditions that should trigger the skill
2. **Workflow** — the step-by-step procedure for the agent to follow
3. **Common Pitfalls** — known failure modes, each paired with the rule that avoids it

Keep `name` unprefixed in the source file. The installer adds the `mms-` prefix to generated outputs.

## Review Process

1. A maintainer will review your PR
2. They may request changes or clarifications
3. Once approved, your skill will be merged
4. Skills may be tested by the community before full approval

## Security Considerations

- **Never include private keys, seeds, or secrets** in skill files
- **Validate all user inputs** in any scripts
- **Use secure defaults** for any configurations
- **Document security implications** of the skill's actions

If you discover a security issue in an existing skill, please report it privately following MetaMask's [security policy](https://github.com/MetaMask/metamask-extension/security/policy).

## Questions?

Feel free to open an issue for any questions about contributing. We're here to help!
