---
repo: metamask-extension
parent: ui-development
---

# MetaMask Extension UI Development Guidelines

## Purpose

Use `@metamask/design-system-react` as much as possible for Extension UI, use
Tailwind class names instead of SCSS, and use current MMDS Storybook documentation
as the source of truth for the API and approved patterns. This skill defines the
workflow and a small set of consumer-repository constraints; it does not duplicate
MMDS APIs, examples, or pattern rules.

The working order is:

1. Use `@metamask/design-system-react` when the design system supports the need.
2. Use Tailwind class names for styling and layout that are not provided by the
   design system.
3. Use Storybook MCP to verify the current design-system documentation and API.
4. If Storybook MCP is unavailable, use the installed package and its local types.
5. Build custom UI only when the preceding sources do not provide a suitable option.

## Required Storybook MCP Workflow

Before answering a UI question or changing UI code:

1. Query `storybook-broker-mcp` with `list-all-documentation`.
2. Find the relevant Extension pattern documentation first.
3. Query `get-documentation` for the selected pattern and each UI building block.
4. Query `get-documentation-for-story` when documentation does not answer the question.
5. Use only props, variants, tokens, composition, and behavior explicitly documented
   or demonstrated by a story.

Never infer an API from a name, a previous implementation, another platform, or
another UI library. If the required guidance is absent, record the documentation gap
and use the fallback process below rather than guessing.

When Mobile-only guidance is encountered, do not apply it to Extension. Use the
Extension mapping documented in Storybook; if no mapping exists, treat that as a
documentation gap.

When creating or updating stories, use the UI scaffolding skill for Storybook story
instructions, previews, and story tests. This skill supplies the design-system API
and pattern knowledge that the scaffolding workflow consumes.

## Fallback When Storybook MCP Is Unavailable

Use these sources in order:

1. The installed `@metamask/design-system-react` package and its type definitions
   under `node_modules`.
2. Existing Extension usage in `ui/pages/design-system/design-system.stories.tsx`.
3. A generated MMDS release manifest or repository-provided release guidance.
4. The MMDS source repository as a last resort.

The installed package version is the source of truth for the code being changed.
Read the matching type definitions before writing usage. Do not restore a static
inventory or copy undocumented APIs into this skill to compensate for missing MCP.

## Durable Extension Constraints

- Use `@metamask/design-system-react` components as much as possible.
- Use Tailwind class names instead of SCSS for styling and layout.
- Do not create or modify SASS or SCSS files.
- Reuse an existing feature-level solution when the documented pattern calls for one;
  otherwise compose the smallest solution supported by current Storybook guidance.
- Keep styling aligned with the repository's design-token Tailwind configuration.
- Preserve accessibility, localization, and keyboard interaction requirements shown
  in the relevant Storybook documentation and stories.

## Before Committing

- [ ] Relevant Storybook pattern and UI documentation was queried.
- [ ] Only documented or story-proven APIs are used.
- [ ] No undocumented cross-platform substitutions were made.
- [ ] No SASS files were created or modified.
- [ ] Accessibility and localization behavior was preserved.

## Review Signals

Flag or reject changes that:

- introduce undocumented props, variants, tokens, or composition;
- use Mobile-only guidance without an Extension mapping;
- bypass an approved Storybook pattern;
- create a second local source of truth for MMDS behavior;
- add SASS or custom styling where the documented guidance provides a supported
  alternative.

## Benchmarking the Skill

Track these measures against a baseline before and after this rewrite:

1. **Staleness:** count API names, prop names, enum names, import paths, and code
   snippets embedded in the skill. The target is zero except for package paths and
   MCP tool names required by the workflow.
2. **MCP compliance:** sample UI tasks and measure whether the agent queried
   documentation before proposing an API. Measure Storybook story-authoring behavior
   separately in the UI scaffolding benchmark.
3. **Groundedness:** have reviewers label each proposed API as documented, supported
   by a story, or invented. Track the invented rate and target zero.
4. **Pattern alignment:** use fixed Extension tasks and score whether the agent chose
   the approved Storybook pattern and followed its documented composition.
5. **Fallback safety:** disable MCP in a test run and verify that the agent checks
   the installed package and type definitions rather than guessing.
6. **Drift detection:** in CI, compare the skill against the Storybook manifest and
   fail when new API inventories or undocumented examples are added.
7. **Efficiency:** measure time-to-first-correct implementation and unnecessary
   clarification or rework caused by missing documentation.

Keep a small, versioned benchmark set of representative tasks covering page chrome,
forms, overlays, lists, empty states, and an intentionally unsupported request.
Evaluate the same prompts at each MMDS release so improvements are comparable.
