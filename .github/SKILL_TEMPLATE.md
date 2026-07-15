# Skill Template

Copy the block below into `domains/<domain>/skills/<skill-name>/skill.md` and replace the placeholders. See [Authoring a skill](../README.md#authoring-a-skill) for the canonical layout and the full frontmatter schema.

---

```markdown
---
name: <skill-name>
description: <one or two sentences, including when-to-use cues so agents can match this skill; keep it well under the operator limits, around 1,000 characters>
maturity: experimental
---

# <Skill Title>

## When To Use

- <the concrete condition that should trigger this skill>
- <another triggering condition>

## Workflow

1. **<First step>.** State what the agent should do and how to tell it is done.
2. **<Second step>.** Keep steps imperative and verifiable.
3. **<Continue as needed>.** Reference supporting material in `references/` rather than inlining long content.

## Common Pitfalls

| Pitfall | Rule |
|---|---|
| <a tempting wrong move> | <the rule that avoids it> |
| <another common mistake> | <its rule> |
```

## Notes for authors

- Keep `name` unprefixed and matching the skill's directory name. The installer adds the `mms-` prefix to the generated outputs.
- `maturity` is optional and defaults to `stable`. Use `experimental` for new skills and `deprecated` on the way out.
- Put supporting docs in `references/`, which the skill reads on demand, rather than expanding the description. The description is always loaded into the agent's discovery surface, while the body and references are not.
- Add a `repos/<repo>.md` overlay only when a consuming repo needs repo-specific guidance. It is merged into the skill body at install time.
