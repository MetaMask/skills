---
name: mmds-sources
domain: design-system
description: Where MMDS maintainer skills look things up, in order, and which skill owns which rule
---

# Sources for MMDS maintainer work

The `design-system` skills are for work inside the MetaMask Design System
(MMDS) monorepo: authoring, migrating, documenting, testing, connecting, and
releasing components. Product UI in Extension and Mobile is covered by
[`ui-development`](https://github.com/MetaMask/skills/blob/main/domains/ui/skills/ui-development/skill.md).
That skill owns the shared foundations (component choice, tokens, typography,
deprecation, accessibility floor). These skills add only what is specific to
building the library, and link back instead of repeating it.

## Lookup order

None of these needs an MCP server. Use the first source that answers the
question, and confirm anything from a hosted source against the code on your
branch, because the code on your branch is what you are changing.

1. **Hosted components manifest and Storybook docs.** React:
   <https://metamask.github.io/metamask-design-system/manifests/components.json>
   and <https://metamask.github.io/metamask-design-system/manifests/docs.json>.
   React Native:
   <https://metamask.github.io/metamask-design-system/react-native/manifests/components.json>.
   These are built from `main`. The `component-documentation` overlay says
   how to build the same manifests locally for your branch. How to read them:
   [reading-mmds-manifests.md](https://github.com/MetaMask/skills/blob/main/domains/ui/skills/ui-development/references/reading-mmds-manifests.md).
2. **Design Brain, when a Notion connector can reach the MetaMask workspace.**
   Query [Design Brain — Lessons & Rules](https://www.notion.so/b71f86d67d68827395a001f7ee7a8a86)
   for the area you are changing. Active rules apply (P0 must, P1 should);
   Proposed rules are guidance only. Cite the rule you applied in the PR. Do
   not copy Brain rules into skills, READMEs, or code comments. If you have no
   Notion access, write "Design Brain not checked" in the PR.
3. **Component README.** READMEs are not in the npm tarball. The README in the
   component folder on your branch is the one you are editing. To see what a
   consumer has, open it on GitHub at the per-package tag
   `@metamask/<package>@<version>`, not `main`: React uses `README.mdx`,
   React Native uses `README.md`.
4. **Existing repository usage.** Search the monorepo for a component that
   already follows the pattern you need (shared types, stories, tests, Code
   Connect, README) and mirror it. Treat it as evidence, not as the contract:
   the ADRs and these skills define the contract, and a component that does
   not follow them is not a template.

Never invent a component, prop, variant, or token. Never declare that
something is missing until you have worked through this list.

## Decisions that bind every skill

- [ADR-0003: Enum to string union migration](https://github.com/MetaMask/decisions/blob/main/decisions/design-system/0003-enum-to-string-union-migration.md)
- [ADR-0004: Centralized types architecture](https://github.com/MetaMask/decisions/blob/main/decisions/design-system/0004-centralized-types-architecture.md)

## Tokens

Use preset (Tailwind) classes first. When Tailwind does not fit, use a
semantic token from the `@metamask/design-tokens` package, in JS or CSS.
Never use raw palette values or hex. The full rule is in the `ui-development`
Foundations section; library-only styling mechanics are in its
`metamask-design-system` overlay.

## Which skill owns what

| Topic | Skill |
| --- | --- |
| Shared types, const objects, layered props, exports | `component-architecture` |
| New component from scratch | `component-creation` |
| Bringing a component in from Extension or Mobile, or moving an existing one to shared types | `component-migration` |
| Stories and READMEs | `component-documentation` |
| Jest and Testing Library | `component-testing` |
| Figma Code Connect | `figma-code-connect` |
| Release branches, changelogs, `MIGRATION.md` | `release-workflow` |
| Storybook before/after screenshots for PRs | `visual-regression-collect` |
| Styling mechanics inside the library | `ui-development` (`metamask-design-system` overlay) |
| User-facing sample copy | `content-guidelines` (`metamask-design-system` overlay) |
| Opening a PR | `create-pr` (`metamask-design-system` overlay) |
