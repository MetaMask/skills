# Skill Template

Use this template when creating a new skill under `domains/<area>/skills/<skill-name>/skill.md`.

Copy the block below into `skill.md` and replace the placeholders.

---

```markdown
---
name: example-skill
description: >-
  One or two sentences: what the skill does, plus when_to_use cues
  (e.g. "Use when asked to …, or for …"). Keep the full description
  within 1,536 characters.
maturity: stable
---

# Example Skill

Brief overview of purpose and who it is for (dApp builders vs MetaMask product eng).

## When to use

- Trigger phrases / tasks this skill owns
- Out of scope (what it should not do)

## Prerequisites

- Required tools (Node, `gh`, device/browser, etc.)
- Required env vars or access
- Required knowledge or related skills

## Instructions

Step-by-step guidance the agent should follow.

### Step 1: …

```bash
# Example command if applicable
example-command --flag value
```

### Step 2: …

## Examples

### Example 1: …

```
User: "…"
Agent: …
```

## Troubleshooting

### Common issue

**Problem:** …

**Solution:** …

## Security considerations

- Permissions required
- Risks or data accessed
```

## Optional repo overlay

If the skill only applies to specific consumer repos, add overlays:

```
domains/<area>/skills/<skill-name>/repos/metamask-mobile.md
```

```yaml
---
repo: metamask-mobile
parent: example-skill
---

# Mobile-specific guidance

Content here merges into the base skill body at install time for that repo.
```

Skills with a `repos/` directory but no overlay matching `--repo` are skipped
for that target. Skills with no `repos/` directory install for any target.

## Optional supporting dirs

- `references/` — deeper docs, API notes, images
- `scripts/` — helper scripts invoked by the skill
- `adapters/` — runtime payloads used by scripts

## Notes

- Source filename is **`skill.md`** (lowercase). Consumer install output uses
  the `mms-` prefix and operator-specific names (`SKILL.md`, `RULE.md`).
- `maturity`: `experimental` | `stable` | `deprecated` (default `stable`).
- See [Authoring a skill](../README.md#authoring-a-skill) in the README for full details.
