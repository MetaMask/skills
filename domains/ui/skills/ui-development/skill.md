---
name: ui-development
description: >-
  UI component development standards for MetaMask clients: the strict
  design-system-first component hierarchy, availability checks before
  building custom components, styling with design tokens, and required
  imports. Use when building, restyling, or reviewing any UI component, or
  when choosing between a design-system, component-library, or custom
  component.
base: true
---

# MetaMask UI Development — MMDS Guidance

Strategy context: [Agentic Design System Strategy](../../knowledge/agentic-design-system-strategy.md)

The MetaMask Design System (MMDS) is the default for MetaMask product UI. This
base holds the rules shared by every client. The repository overlay below it
adds platform paths, the styling surface, and platform-only rules.

## When to use

Use this skill when you create, change, restyle, or review UI in a MetaMask
client: components, screens, sheets, modals, stories, styles, tokens, themes,
and UI behavior. Use it to decide between an MMDS component, a legacy
component-library component, a feature component, and custom UI.

Copy and wording rules live in `content-guidelines`. File layout and test
setup live in `component-scaffold` where the repository has it.

## Sources, in order

None of these needs an MCP server. Work from them in this order:

1. **Installed package types (`node_modules`).** The installed version is the
   contract for the code you are changing. Read the export index and the
   component's `.types` file (with its JSDoc) under
   `node_modules/@metamask/<platform package>/dist/`. Shared props and enums
   come from `node_modules/@metamask/design-system-shared/dist/types/`. When the
   types disagree with anything else on this list, the types win.
2. **Hosted Storybook components manifest**, for discovery, deprecation tags,
   and story snippets:
   - React (Extension): <https://metamask.github.io/metamask-design-system/manifests/components.json>
   - React Native (Mobile): <https://metamask.github.io/metamask-design-system/react-native/manifests/components.json>

   The manifests are built from MMDS `main`, so they can list components or
   props that are newer than the version the consumer repo installs. Confirm
   anything you find there against the installed types before you use it.
   Story `import` snippets sometimes pull enums from
   `@metamask/design-system-shared`; in product code, import components and
   enums from the platform package (`@metamask/design-system-react` or
   `@metamask/design-system-react-native`). How to read a manifest:
   [references/reading-mmds-manifests.md](references/reading-mmds-manifests.md).
3. **Component README at the installed version's tag.** READMEs are not in the
   npm tarball. Read the installed version from
   `node_modules/@metamask/<package>/package.json` (or the lockfile), then open
   the README on GitHub at the per-package tag
   `@metamask/<package>@<version>`. The package `CHANGELOG.md` compare links
   use the same tag names. Never hard-code a release in code comments or
   skills.
4. **Existing repository usage and stories.** Search the consumer repo for the
   component or token. Treat examples as usage evidence, not as the contract.
5. **Figma MCP and Code Connect, when connected.** Use them to read the design
   and its component mapping. If they are not connected, carry on without them.

Storybook MCP or Context Forge may add pattern docs when one is already
configured and responds. It is optional: never block on it, do not install,
configure, or authenticate it, and do not mention its absence unless a
question can only be answered there.

## Workflow

**Create:** read the installed types (and README when behavior is unclear)
for each building block, choose the component as below, style with preset
classes and tokens, then run the review checklist on your own diff.

**Review:** list the changed UI, check each MMDS usage against the installed
types, then report component choice, deprecated usage, tokens, typography,
and accessibility findings with file, line, evidence, and a recommended fix.
Custom UI without a recorded reason is a finding, not an automatic failure.

## Choosing a component

- Before building anything, check the manifest and the installed exports for
  an existing component. Never invent a component, a prop, or a variant, and
  never port an API from the other platform or another UI library.
- Choose in this order, and record the reason whenever you go past step 1:
  1. An MMDS component exported by the installed platform package.
  2. A non-deprecated legacy component-library component, only when MMDS does
     not cover the need.
  3. An existing feature component that already solves it.
  4. Custom UI composed from MMDS primitives and tokens, with the reason
     recorded in the PR or the repository's exception format.
- A component, prop, or enum value is deprecated when its installed type
  carries `@deprecated` or its manifest entry has `jsDocTags.deprecated`. Do
  not add new usage. Use the replacement the JSDoc names; if none is named,
  keep existing usage and record the gap.
- Do not invent button or control chrome that MMDS does not have. Keep
  single-select (checkmark) and multi-select (checkbox) patterns distinct.
- If an MMDS layout makes a primary data point read as secondary, compose a
  stronger treatment instead of forcing the wrong primitive.

## Foundations

- Color, typography, shadows, and motion come from MMDS design tokens. Use
  semantic tokens (`background-*`, `text-*`, `border-*`, `icon-*`, status
  tokens), never hex values or raw palette names.
- Tailwind comes from the MMDS presets configured in the consumer repo. Use
  only class names those presets generate. Do not use default Tailwind colors
  or arbitrary values (`bg-[#...]`, `p-[15px]`, `rounded-[16px]`,
  `text-[14px]`).
- Spacing and radius use the Tailwind scale through the presets: the 4px
  spacing scale (`p-4`, `gap-2`) and the default radii (`rounded-lg`,
  `rounded-xl`, `rounded-2xl`, `rounded-full`). MMDS has no separate spacing
  or radius tokens. Never hard-code numbers such as `borderRadius: 16`.
- Meet WCAG AA contrast with semantic tokens (normal text 4.5:1, large text and
  UI graphics 3:1) and check dark mode.
- Layouts must survive longer translated strings and future RTL without
  clipping or overlap. Avoid fixed-width text boxes.

## Typography

- `FontFamily.Default` is the default for all UI text.
- Set type with `Text` and a `TextVariant`. Never hand-set font sizes, line
  heights, or arbitrary text classes.
- Use `FontFamily.Hero` only for approved hero cases: the single primary
  display amount of a view and marketing-moment headlines through the
  platform's `MarketingMomentTitle`. Never pair Hero with a font weight, and
  never use it for body text, labels, buttons, titles, or small numbers.
- Do not use `FontFamily.Accent`; it has been removed from MMDS.
- Amount inputs are not settled. See the Proposed Typography rule in the
  [Design Brain](https://www.notion.so/b71f86d67d68827395a001f7ee7a8a86) and the
  [MMDS reference](https://www.notion.so/40ef86d67d68811c9b31cf9992a076cd)
  before choosing a face for one.

## Incremental migration: `Legacy*` aliases

When a file still imports a legacy component-library export whose name is also
exported by the MMDS platform package, alias the legacy import with a `Legacy`
prefix and keep the MMDS import on the plain name. Do the same for clashing
enums. Do not alias legacy names that MMDS does not export, and never put the
prefix on the MMDS import. Finishing the migration is deleting the `Legacy*`
import and its usages. The overlay gives the platform's import paths and an
example.

## Accessibility, trust, and sheets

These are Active rules from the Design Brain, inlined because agents in code
repositories cannot read Notion. Proposed rules are guidance only: link to
them, do not enforce them.

- Every text field has a persistent accessible label tied to the input. A
  placeholder alone is not a label.
- Meaningful icons have an accessible name. Decorative icons next to visible
  text are hidden from assistive tech, so the control is not read twice.
- Icon-only buttons need an accessible name and a real action. Do not ship an
  info button whose press does nothing.
- Keep the visible text in a control's accessible name (WCAG 2.5.3). Put extra
  context in a hint instead of replacing visible words.
- When visible text is abbreviated, put the full term in the accessible name.
- Do not show selected, active, or unread state through color alone. Add a
  non-color cue and expose the state (selected, checked, expanded) to
  assistive tech. Tabs expose the tab role and the selected state.
- Do not nest interactive controls inside another link or button. Make one
  primary target, or split the actions.
- Announce async errors and status changes (save, load, retry, failures) to
  screen readers. The overlay gives the platform mechanism.
- Autocomplete and suggestion lists use combobox/listbox semantics and stay
  reachable by keyboard.
- Full-screen overlays on top of another flow use the MMDS modal or dialog
  pattern: an accessible name, dialog semantics, and focus moved into the
  overlay until it is confirmed or cancelled.
- Sheets and modals must not trap keyboard or assistive-tech focus, keep
  close or back available, and follow visual reading order.
- Respect reduced motion. Never rely on animation alone to show state.
- Protect trust in wallet UI: use semantic color only for real meaning;
  reconcile displayed totals and units exactly; keep sensitive details off
  overviews; give irreversible send, approve, and connect actions a clear
  preview (asset, amount, network, recipient or permission) with proportionate
  confirmation; keep back, cancel, and recovery available; never imply
  certainty the system does not have. Keep available, pending, claimed, paid,
  estimated, and lifetime values distinct. Never expose the Secret Recovery
  Phrase or other secrets in labels.

Full rule set, including Proposed rules:
[Design Brain — Lessons & Rules](https://www.notion.so/b71f86d67d68827395a001f7ee7a8a86).

## MMDS agent docs

Read these in the MMDS repository instead of copying them into skills:

- [`AGENTS.md`](https://github.com/MetaMask/metamask-design-system/blob/main/AGENTS.md)
- [`docs/ai-agents.md`](https://github.com/MetaMask/metamask-design-system/blob/main/docs/ai-agents.md)
- [`.cursor/rules/styling.md`](https://github.com/MetaMask/metamask-design-system/blob/main/.cursor/rules/styling.md)
- [`.cursor/rules/figma-integration.md`](https://github.com/MetaMask/metamask-design-system/blob/main/.cursor/rules/figma-integration.md)
- [`.cursor/rules/component-migration.md`](https://github.com/MetaMask/metamask-design-system/blob/main/.cursor/rules/component-migration.md)

These track MMDS `main`. Where they disagree with the installed types, the
installed types win.

## Review checklist

- [ ] Installed types were read for every MMDS building block; the manifest
      and README were used only as supporting sources.
- [ ] MMDS was used wherever it covers the need; any step past MMDS has a
      recorded reason.
- [ ] No invented components, props, or variants, and no cross-platform ports.
- [ ] No new usage of anything tagged `@deprecated`.
- [ ] Only preset-generated classes and semantic tokens; no arbitrary values.
- [ ] Typography uses `Text` + `TextVariant`; Hero only for approved cases.
- [ ] Clashing legacy imports are aliased `Legacy*`; MMDS keeps plain names.
- [ ] The accessibility and trust rules above hold for the changed UI.
