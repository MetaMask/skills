---
repo: metamask-extension
parent: ui-development
---

# MetaMask Extension UI Development Guidelines

Extension is the web consumer and platform; it is not synonymous with
`@metamask/design-system-react`. Use `@metamask/design-system-react` as much as
possible for Extension UI. Mobile uses the separate
`@metamask/design-system-react-native` package. Use Tailwind class names instead of
SCSS. Use the current MMDS Storybook documentation as the source of truth for the
API and approved patterns.

The working order is:

1. Use `@metamask/design-system-react` when the design system supports the need.
2. Search the Extension codebase for existing UI and reuse it when appropriate,
   including UI that has not moved to MMDS or is intentionally feature-specific.
3. Use Tailwind class names for styling and layout that are not provided by the
   design system.
4. Use Storybook MCP to verify the current design-system documentation and API.
5. If Storybook MCP is unavailable, use the installed package and its local types.
6. Build new feature UI only when no suitable MMDS or existing Extension UI can be
   reused.

For this Extension skill, use the React/web Storybook documentation and Extension
patterns. Do not substitute React Native APIs or Mobile patterns. The corresponding
Mobile skill uses `@metamask/design-system-react-native` and the React Native
Storybook documentation.

## Required Storybook MCP Workflow

Before answering a UI question or changing UI code:

1. Query `storybook-broker-mcp` with `list-all-documentation`.
2. Find the relevant Extension pattern documentation in the React/web Storybook first.
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
- Search the Extension codebase and reuse suitable existing UI before creating new
  feature UI. Existing UI does not need to be in MMDS to be reusable.
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
