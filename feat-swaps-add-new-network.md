## Description

<!-- Describe your changes in detail -->

Adds a generalized `add-network` Swaps/Bridge skill that replaces the narrower `add-non-evm-network` skill.

The new skill points agents to repo-specific SSOT docs for adding EVM or non-EVM network support across Core, Extension, and Mobile:

- Core controller guidance in `domains/swaps/knowledge/add-network-core.md`
- Extension client guidance in `domains/swaps/knowledge/add-network-extension.md`
- Mobile client guidance in `domains/swaps/knowledge/add-network-mobile.md`

The docs incorporate existing non-EVM references and new EVM Robinhood Chain examples for Core, Extension, and Mobile.

## Type of Change

<!-- Mark the relevant option with an "x" -->

- [x] New skill
- [x] Skill improvement/update
- [ ] Bug fix
- [x] Documentation update
- [ ] Other (please describe):

## Skill Details (if adding a new skill)

**Provider Name:** MetaMask Swaps
**Skill Name:** `add-network`
**Brief Description:** Guides agents through adding EVM or non-EVM Swaps/Bridge network support in Core, Extension, or Mobile.

## Checklist

<!-- Mark completed items with an "x" -->

- [x] I have read the [CONTRIBUTING.md](../CONTRIBUTING.md) guidelines
- [ ] My skill follows the [SKILL_TEMPLATE.md](.github/SKILL_TEMPLATE.md) format
- [ ] I have tested this skill with an AI agent
- [x] My skill does not contain any secrets, private keys, or sensitive data
- [x] I have added appropriate documentation
- [ ] My changes don't break existing skills

## Testing

<!-- Describe how you tested this skill -->

- Ran `git diff --check` for the updated swaps docs.
- Checked IDE diagnostics for the updated markdown files.
- Did not run agent-install or AI-agent execution testing.

## Additional Context

<!-- Add any other context or screenshots about the PR here -->

Reference examples used:

- Core EVM Robinhood Chain: https://github.com/MetaMask/core/pull/9459
- Extension EVM Robinhood Chain: https://github.com/MetaMask/metamask-extension/pull/44347
- Mobile EVM Robinhood Chain: https://github.com/MetaMask/metamask-mobile/pull/33110
- Core non-EVM Tron: https://github.com/MetaMask/core/pull/6862
- Extension non-EVM Tron: https://github.com/MetaMask/metamask-extension/pull/37683
- Extension non-EVM Bitcoin: https://github.com/MetaMask/metamask-extension/pull/35597
