# UI development skills reshape eval — 2026-11-05

PRs: [#212](https://github.com/MetaMask/skills/pull/212) (Mobile), [#213](https://github.com/MetaMask/skills/pull/213) (Extension)
Agent: Cursor cloud agent, eval branch `cursor/ui-development-reshape-eval-682b`

Skill heads under test:

- #212 `cursor/mmds-mobile-skills-refresh-7309` @ `2d1ba46`
- #213 `cursor/mmds-extension-skills-no-storybook-mcp-7309` @ `9c57432`
- A/B baseline: `main` @ `c40ef31`

Consumers (shallow clones of `main`, 2026-11-05):

| Consumer | MMDS package (lockfile) | Shared | Preset |
| --- | --- | --- | --- |
| metamask-mobile | `@metamask/design-system-react-native` 0.55.0 (npm latest 0.56.0) | `design-system-shared` 0.44.0 | `design-system-twrnc-preset` 0.14.0 |
| metamask-extension | `@metamask/design-system-react` 0.47.0 (npm latest 0.51.0) | `design-system-shared` 0.41.0 | `design-system-tailwind-preset` 0.15.0 |

Storybook MCP and Context Forge were treated as unavailable and were never configured.

## Summary

| Scenario | Mobile (#212) | Extension (#213) |
| --- | --- | --- |
| 1. Types win over manifest | Pass | Pass |
| 2. Restyle with foundations | Pass | Partial (ISS-006, ISS-008) |
| 3. Legacy* migration | Pass | Partial (ISS-009) |
| 4. Review checklist | Pass | Pass |
| Install smoke | Pass (ISS-002 pre-existing) | Pass (ISS-002 pre-existing) |

Rubric: in all eight runs the agent did not block on Storybook MCP, read installed types before choosing anything, used the matching hosted manifest for discovery only, and followed no hard-coded MMDS version. The two Partials are overlay gaps, not wrong guidance about sources.

Issues: 13 total. 3 major (ISS-003, ISS-009, ISS-011), 7 minor, 3 notes, 0 blockers.

Merge verdict from an agent-eval perspective: **safe to merge together, not separately.**

- The shared base does what the reshape promises. "Installed types win" correctly refused `ButtonPrimary` (Mobile) and `inputAriaLabel` (Extension), which exist on MMDS `main` and in the manifests but not at the pinned 0.55.0 / 0.47.0.
- Merge #212 and #213 back to back (ISS-003). Either one alone ships a contradictory skill to the other client.
- Before or right after merge, fix ISS-009 in the #213 Extension overlay (enum alias path, about two lines).
- Reconcile ISS-011 in Notion: the Active Design Brain rule ranks MMDS `main` above the installed package. That is a Notion change, not a skill change.
- Everything else can follow up.

## Issues

### ISS-001 — No full `yarn install` of either consumer; types come from the published tarballs
- Platform: Install
- Scenario: Setup
- Severity: note
- Expected: `node_modules` from a real `yarn install` of each app.
- Actual: I did not run the full app installs (Mobile has native and postinstall steps, Extension has LavaMoat allow-scripts). Instead I extracted the npm tarballs at the exact lockfile versions into `<consumer>/node_modules/@metamask/` (`design-system-react-native@0.55.0`, `design-system-shared@0.44.0`, `design-system-twrnc-preset@0.14.0`, `design-tokens@13.0.0` for Mobile; `design-system-react@0.47.0`, `design-system-shared@0.41.0`, `design-system-tailwind-preset@0.15.0`, `design-tokens@12.0.0` for Extension).
- Evidence: `npm pack @metamask/<pkg>@<lockfile version>` then `tar xzf`. Every `node_modules` path the skills name resolved, for example `dist/components/index.d.cts` for both packages.
- Suggested fix: None for the skills. Type-checking the proposed snippets (`tsc`) was not possible without the full install; the snippets were checked by reading the `.d.cts` files.

### ISS-002 — Installed "Strategy" links are broken in every installed copy
- Platform: Shared (pre-existing on `main`)
- Scenario: Install smoke
- Severity: minor
- Expected: `[Agentic Design System Strategy](...)` in the installed `SKILL.md` / `RULE.md` resolves to the copied `knowledge/agentic-design-system-strategy.md`.
- Actual: The base links `../../knowledge/agentic-design-system-strategy.md` and the Extension overlay links `../../../knowledge/agentic-design-system-strategy.md`. Both are source-tree paths. After install the file lives at `./knowledge/agentic-design-system-strategy.md` next to `SKILL.md`, so both links point outside the skill folder. `references/reading-mmds-manifests.md` resolves correctly.
- Evidence: In `metamask-mobile/.claude/skills/mms-ui-development/` and `metamask-extension/.claude/skills/mms-ui-development/`, `test -e ../../knowledge/...` and `test -e ../../../knowledge/...` both fail, and `test -e knowledge/agentic-design-system-strategy.md` succeeds. The `main` install has the same two links.
- Suggested fix: Rewrite `../../knowledge/` and `../../../knowledge/` to `knowledge/` in `tools/install` when it merges base and overlay (the installer already copies `knowledge/`), or drop the duplicate Strategy link from the Extension overlay. Not caused by #212/#213.

### ISS-003 — #212 and #213 are coupled: merging either one alone ships a contradictory skill to the other platform
- Platform: Shared
- Scenario: Install smoke (cross-PR)
- Severity: major
- Expected: Each PR can merge on its own without degrading the other client.
- Actual: Both PRs add the same new base `skill.md`, `references/reading-mmds-manifests.md`, and knowledge edits (byte-identical, separate commits `b931b41` and `260dac1`), but each one reshapes only its own overlay.
  - With #212 alone, Extension gets the new base ("never block on it, do not install, configure, or authenticate it") followed by the old `main` overlay's "## Required Storybook MCP Workflow" ("Start by querying `storybook-broker-mcp` with `list-all-documentation`"). The installed file has 363 lines and two "When to use" sections and two checklists.
  - With #213 alone, Mobile gets the new base plus the old 430-line Mobile overlay, which still says "**LAST RESORT**: Custom components with StyleSheet". That contradicts the new base and the new overlay's "No `StyleSheet.create()`". The installed file has 639 lines.
- Evidence: `cd <#212 worktree> && ./tools/install --repo metamask-extension --target /tmp/x-ext --domain ui`, then `grep -n "Required Storybook MCP" /tmp/x-ext/.claude/skills/mms-ui-development/SKILL.md` matches line 278. With the #213 worktree and `--repo metamask-mobile`, line 25 of the overlay section contains "LAST RESORT: Custom components with StyleSheet".
- Suggested fix: Merge #212 and #213 together, back to back with no release in between, or move the base, reference, and knowledge changes into one PR that also carries both overlays. Positive: merging #212 and then #213 onto `main` is conflict-free (`git merge-tree` is clean), and the shared CHANGELOG bullet appears once.

### ISS-004 — Manifest `name` is not always a component name; "pattern" entries look like components
- Platform: Shared
- Scenario: 1 (Types win over manifest)
- Severity: minor
- Expected: `reading-mmds-manifests.md` lists every kind of non-component entry so an agent that "matches on `name`" does not mistake one for an exportable component.
- Actual: The reference warns that "Some entries are design-token or foundation pages rather than components". Both manifests also contain **pattern** stories whose `name` is either a component-looking identifier (`patterns-marketing-moments` → `"MarketingMoment"`, with an `import` of `Box, Button, Icon, Text`) or a code fragment (`patterns-backgrounds` / `patterns-wallet-home` → `"() => null"`, and `components-headerstandardanimated` → `"HeaderStandardAnimated as unknown as ComponentType<ScrollStoryArgs>"`). A name search for `MarketingMoment` finds an entry, but neither installed package exports it. Mobile has `app/components/UI/MarketingMomentTitle` and Extension has `ui/components/ui/marketing-moment` instead, which the Extension overlay does point to.
- Evidence: `jq -r '.components[] | select(.name|test("^[A-Z][A-Za-z]+$")|not) | "\(.id)\t\(.name)"' components.json` on both manifests; `jq '.components[] | select(.name=="MarketingMoment") | {id,path,import}'`.
- Suggested fix: In the reference's Shape section, add: "Entries whose `id` starts with `patterns-` are composition examples, not components. Check `path` (a `src/components/<Name>/` story is a component) and confirm the name in the installed export index." Optionally name the Mobile `MarketingMomentTitle` path in the Mobile overlay, the way the Extension overlay names `marketing-moment`.

### ISS-005 — Deprecation rule does not cover a named replacement that the installed package does not export
- Platform: Extension (rule is in the shared base)
- Scenario: 1 (Types win over manifest)
- Severity: minor
- Expected: The skill tells the agent what to do when `@deprecated` names a replacement that is missing from the installed version or exists only on the other platform.
- Actual: The base says "Use the replacement the JSDoc names; if none is named, keep existing usage and record the gap." In `@metamask/design-system-react@0.47.0` (Extension), `ButtonFilter` is tagged `@deprecated Use \`FilterButton\` instead`, and the React manifest says the same. `FilterButton` is not exported by React 0.47.0 or 0.51.0 (latest) and has no React manifest entry. It exists only in React Native. Read literally, the rule sends the agent to a component that does not exist on this platform, which the same base forbids ("never port an API from the other platform"). Extension uses `ButtonFilter` in `ui/components/app/perps/dropdown/dropdown.tsx` and `perps-market-category-pill.tsx`.
- Evidence: `node_modules/@metamask/design-system-react/dist/components/ButtonFilter/ButtonFilter.d.cts:4`; `grep -c FilterButton dist/components/index.d.cts` returns `0` at 0.47.0 and at 0.51.0; `jq '[.components[]|select(.name=="FilterButton")]|length' react-manifest.json` returns `0`.
- Suggested fix: Change the base sentence to "Use the replacement the JSDoc names **if the installed platform package exports it**; otherwise keep existing usage and record the gap." Report the dangling React deprecation to MMDS.

### ISS-006 — "Do not create or modify SASS or SCSS files" blocks deleting SCSS that a Tailwind restyle makes obsolete
- Platform: Extension
- Scenario: 2 (Restyle with foundations)
- Severity: minor
- Expected: The overlay lets the agent delete the SCSS rule, file, and `@import` that a restyle replaces. Leaving dead SCSS behind is worse.
- Actual: The styling surface says "Do not create or modify SASS or SCSS files", and the checklist says "No SASS or SCSS files created or modified." Restyling `ui/components/multichain/funding-method-modal/funding-method-item.tsx` to Tailwind replaces `.funding-method-item { cursor: pointer; &:hover { background-color: var(--color-background-hover) } }` in `funding-method-modal/index.scss`. Cleaning up means deleting that file and the `@import 'funding-method-modal';` line in `ui/components/multichain/multichain-components.scss:27`. Read literally, that edit fails the checklist, so an agent either leaves dead CSS or breaks the rule.
- Evidence: Extension overlay, "Styling surface" and "Extension checklist"; `grep -rn funding-method-modal ui --include=*.scss`.
- Suggested fix: Change the rule to "Do not add SASS or SCSS. Deleting rules, files, and `@import`s that your change makes unused is expected." Make the same change in the checklist.

### ISS-007 — Mobile overlay says "no new `.styles.ts`" but not how to retire an existing `useStyles` + `.styles.ts` pair
- Platform: Mobile
- Scenario: 2 (Restyle with foundations)
- Severity: note
- Expected: A short conversion rule for the very common existing pattern (`useStyles(styleSheet, {})` from `app/components/hooks/useStyles` plus a `*.styles.ts` that calls `StyleSheet.create`).
- Actual: The overlay forbids `StyleSheet.create()` and new `.styles.ts` files, but says nothing about converting an existing pair. The `main` overlay had a "Component Conversion Guide" table. I could still do the conversion from the base and overlay rules (map to typed `Box` props or `twClassName`, then delete the styles file and the hook call). Also, "Interactive list rows use MMDS `ListItem` with its interactive mode and the pressed background token" reads as if the agent should add `bg-pressed`. In 0.55.0, `ListItem` with `isInteractive` already applies `pressed && 'bg-pressed'` (`dist/components/ListItem/ListItem.mjs:34`), so adding it again is redundant.
- Evidence: `app/components/UI/Ramp/components/MenuItem/MenuItem.{tsx,styles.ts}`; Mobile overlay "Styling surface" and "Interactive list rows…" bullets.
- Suggested fix: Add one bullet: "When you touch a file that uses `useStyles` + `*.styles.ts`, move the styles to typed `Box` props or `twClassName` and delete the styles file and hook call." Reword the `ListItem` bullet to "…with `isInteractive`; it applies the pressed background itself."

### ISS-008 — Extension overlay has no guidance for clickable rows or for typed `Box` props versus `className`
- Platform: Extension
- Scenario: 2 (Restyle with foundations)
- Severity: minor
- Expected: Guidance on the common "clickable list row" case and on whether MMDS React `Box` typed props (`flexDirection`, `gap`, `padding`, `alignItems`) are preferred over raw `className` utilities, matching the guidance the Mobile overlay gives.
- Actual: The React package (0.47.0) has no `ListItem` (the React manifest has none either; it is React Native only). The overlay only says "Use Tailwind class names (`className`) for styling and layout." The real target is a legacy `Box` with `onClick` and no role or keyboard support. An agent has to decide on its own to use `Box asChild` around a native `<button type="button">` with `hover:bg-hover active:bg-pressed`, which are preset tokens verified in `design-system-tailwind-preset/dist/colors.mjs:16-17`. The base rule "Do not nest interactive controls…" and the web a11y bullets cover the semantics, but not the composition.
- Evidence: `ui/components/multichain/funding-method-modal/funding-method-item.tsx`; `dist/components/Box/Box.types.d.cts` (`asChild?: boolean`, `BoxPropsShared`).
- Suggested fix: Add two lines: (1) "Prefer MMDS `Box` typed props for layout and `className` for everything else" (or the reverse, but state one). (2) "A clickable row with no MMDS component is a native `<button type="button">` (via `Box asChild`) with `hover:bg-hover active:bg-pressed`, never a `div` with `onClick`."

### ISS-009 — Extension `Legacy*` guidance names only the component-library barrel; clashing legacy enums live in `ui/helpers/constants/design-system`
- Platform: Extension
- Scenario: 3 (Legacy* migration)
- Severity: major
- Expected: The Extension migration paths cover where clashing legacy enums actually come from.
- Actual: The overlay says to apply the `Legacy*` rule "to any export from that barrel [`ui/components/component-library`] … including enums such as `IconName`." In Extension, the legacy enums used with legacy `Box`/`Text` (`TextVariant`, `TextColor`, `IconColor`, `FontWeight`, `TextAlign`) are exported from `ui/helpers/constants/design-system.ts`, not from the barrel. MMDS React 0.47.0 exports all five names. 201 files under `ui/` already import from both `@metamask/design-system-react` and `helpers/constants/design-system`, and existing migrations alias from that path (`TextVariant as LegacyTextVariant` 5×, `TextColor as LegacyTextColor` 3×, for example `ui/pages/multichain-accounts/add-wallet-page/add-wallet-page.tsx:16`). An agent following the overlay literally aliases `Box` and `Text` but leaves `TextVariant` unaliased, which clashes with the MMDS `TextVariant` it then imports. `Display`, `FlexDirection`, `AlignItems`, `JustifyContent`, `BackgroundColor`, and `BorderColor` are legacy-only and must **not** be aliased, which the overlay also does not say.
- Evidence: `grep -cE "export (enum|const) TextVariant" ui/helpers/constants/design-system.ts` returns 1 and `ui/components/component-library/index.ts` has no `TextVariant`; `grep -rl "from '@metamask/design-system-react'" ui | xargs grep -l "helpers/constants/design-system'" | wc -l` returns 201; scenario 3 target `ui/components/multichain/funding-method-modal/funding-method-item.tsx`.
- Suggested fix: In the Extension "Incremental migration paths", add: "Legacy enums (`TextVariant`, `TextColor`, `IconColor`, `FontWeight`, `TextAlign`, …) come from `ui/helpers/constants/design-system`. Alias the ones MMDS also exports (`TextVariant as LegacyTextVariant`). Legacy-only enums such as `Display`, `FlexDirection`, `AlignItems` keep their names." Add the line to the Do example.

### ISS-010 — The base enforces two Design Brain rules that Notion still marks Proposed (`Legacy*` aliases, Hero typography)
- Platform: Shared
- Scenario: 3 (Legacy* migration); also affects 4 (Review)
- Severity: minor
- Expected: Rules the base enforces (sections plus review checklist) are Active in the Design Brain, or the base labels them as repository conventions that do not depend on Design Brain status. The base itself says: "Proposed rules are guidance only: link to them, do not enforce them."
- Actual: In Design Brain → Lessons & Rules (queried via Notion MCP on 2026-11-05):
  - "During an incremental migration to MMDS, alias legacy component-library imports whose names clash with MMDS with a Legacy prefix…": **Status: Proposed** (added 2026-11-04). The base has a normative "Incremental migration: `Legacy*` aliases" section and the checklist item "Clashing legacy imports are aliased `Legacy*`; MMDS keeps plain names."
  - "Typography: use Inter (FontFamily.Default) … Use Grotzec (FontFamily.Hero) only for …": **Status: Proposed**. The base's Typography section states these as hard rules, and the checklist has "Hero only for approved cases". Only the amount-input part is labelled as Proposed and linked.
  - The Notion Hero rule also allows Hero for "large amount inputs sized by the platform auto-shrink helper". The base deliberately says amount inputs "are not settled", so the base and Notion differ in content as well as status.
- Evidence: Notion data source `collection://ce2f86d6-7d68-82fe-8ad8-87d67ab38328`, query on `Rule LIKE '%Legacy%' OR '%Hero%'`; base `skill.md` "Accessibility, trust, and sheets" intro, "Typography", "Incremental migration", "Review checklist".
- Suggested fix: Either promote both rules to Active in the weekly review before #212/#213 merge, or reword the base intro to "These rules are MetaMask UI conventions. The Design Brain tracks their status." Then the Proposed-only rule applies to the Notion inline list only. Practical impact is low: both rules match existing repository practice (see ISS-009 evidence and the Mobile `PredictFeeSummary.tsx` aliases).

### ISS-011 — An Active Design Brain rule ranks MMDS `main` above the installed package, contradicting "installed types win"
- Platform: Mobile (rule is scoped "Platform: Mobile · All")
- Scenario: 1 (Types win over manifest)
- Severity: major
- Expected: The Design Brain and the skill agree on source precedence, because the base claims to inline the Active rules.
- Actual: The Active rule (added 2026-11-05) reads: "Resolve design-system conflicts in this evidence order: user requirements and supplied evidence; current product surface and adjacent Mobile flows; **current main of MetaMask/metamask-design-system (RN package)**; published RN Storybook then its story source; design tokens and established Mobile patterns; bundled skill maps last." It never mentions the installed `node_modules` version, and it ranks MMDS `main` and the published Storybook (which is what the manifest is built from) above it. The base's first and most important rule is "The installed version is the contract … When the types disagree with anything else on this list, the types win." In scenario 1 these two give opposite answers for `ButtonPrimary`, which exists on MMDS `main` but not in Mobile's installed 0.55.0. A design agent that reads Notion would use it; a code agent that reads the skill would refuse.
- Evidence: Notion Lessons & Rules row "Resolve design-system conflicts in this evidence order…" (Status Active, Category Design system); base `skill.md` "Sources, in order" item 1.
- Suggested fix: Update the Notion rule to put "the version installed in the consumer repo (types in `node_modules`)" above MMDS `main` for code changes, and keep `main` for design exploration only. Or have the base state the split explicitly: "for code, installed types win; for design proposals, MMDS `main` may be cited as upcoming."

### ISS-012 — `Legacy*` trigger is ambiguous: alias every clashing legacy name, or only those co-imported with MMDS?
- Platform: Shared
- Scenario: 3 (Legacy* migration)
- Severity: note
- Expected: A clear trigger for when to rename.
- Actual: The base says "When a file still imports a legacy component-library export whose name is also exported by the MMDS platform package, alias the legacy import." Read literally, this renames legacy `Icon`/`IconName`/`IconSize`/`IconColor` in `app/components/UI/Notification/SwitchLoadingModal/Loader.tsx` even when the step only migrates `Text` and MMDS `Icon` is not imported. Repository practice (Mobile `PredictFeeSummary.tsx`, Extension `add-wallet-page.tsx`) aliases only names that are also imported from MMDS in the same file. The difference changes the diff size of every incremental step.
- Evidence: base "Incremental migration" paragraph; `grep -rn "as Legacy" app ui`.
- Suggested fix: "…alias the legacy import **when the same file also imports that name from MMDS**." The Extension overlay's Do/Don't example already implies this.

### ISS-013 — Base points to `content-guidelines`, which is never installed in Extension
- Platform: Extension (pointer is in the shared base)
- Scenario: 4 (Review checklist)
- Severity: minor
- Expected: A cross-skill pointer in the shared base resolves on every platform, or is qualified the way the `component-scaffold` pointer is ("where the repository has it").
- Actual: The base says "Copy and wording rules live in `content-guidelines`." `domains/ui/skills/content-guidelines/` has only `repos/metamask-mobile.md` and is not `base: true`, so `./tools/install --repo metamask-extension --domain ui` installs no `mms-content-guidelines`. An Extension reviewer looking for string rules finds nothing to load.
- Evidence: `ls /tmp/mm-ext/.claude/skills | grep -c content` returns `0`; `ls domains/ui/skills/content-guidelines/repos/` lists `metamask-mobile.md` only.
- Suggested fix: Change the base sentence to "Copy and wording rules live in `content-guidelines` where the repository has it." Or add an Extension overlay for `content-guidelines` (out of scope for #213).

## Scenario results

Method: for each scenario I worked as an agent with only the installed `mms-ui-development` skill (`.claude/skills/mms-ui-development/SKILL.md` in each consumer), the installed types, the hosted manifests, and GitHub READMEs. I followed "Sources, in order" (types → manifest → README at tag → repository usage) and the Create or Review workflow. Storybook MCP and Context Forge were never used, configured, or mentioned by the skill path I took.

Rubric columns: **MCP** = did not block on Storybook MCP · **Types** = checked installed types before inventing · **Manifest** = used the correct hosted manifest for discovery only · **Overlay** = followed the platform overlay · **No pin** = no hard-coded MMDS version in the guidance followed.

### Scenario 1 — Types win over manifest

**Mobile (#212) — Pass**

| MCP | Types | Manifest | Overlay | No pin |
| --- | --- | --- | --- | --- |
| ✅ | ✅ | ✅ RN manifest | ✅ | ✅ |

- Candidate: `ButtonPrimary`, `ButtonSecondary`, `ButtonTertiary`. The RN manifest entry `components-button-variants-buttonprimary` has `import { ButtonPrimary } from '@metamask/design-system-react-native'` and full `reactDocgen.props`, with no deprecation tag.
- Installed check: `grep -c ButtonPrimary node_modules/@metamask/design-system-react-native/dist/components/index.d.cts` returns `0` at 0.55.0, and there is no `dist/components/ButtonPrimary/`. The npm tarball for 0.56.0 contains it (24 files), so it is genuinely newer than Mobile's pin.
- Decision: **refuse**. Use the installed `Button` with `variant={ButtonVariant.Primary}`, which is exported at 0.55.0 (`ButtonVariant.Primary` in `design-system-shared/dist/types/Button/Button.types.d.cts:9`). This matches the base wording "Confirm anything you find there against the installed types before you use it."
- Second candidate: the `MarketingMoment` manifest entry is a pattern story, not a component (ISS-004). Refused. The repository's `app/components/UI/MarketingMomentTitle` is the existing feature component (hierarchy step 3).
- Conflict noted: the Active Design Brain evidence-order rule would rank MMDS `main` first (ISS-011). The skill does not send code agents to Notion for source order, so I followed the skill.

**Extension (#213) — Pass**

| MCP | Types | Manifest | Overlay | No pin |
| --- | --- | --- | --- | --- |
| ✅ | ✅ | ✅ React manifest | ✅ | ✅ |

- Candidate (prop level): `TextFieldSearch.inputAriaLabel`. The React manifest marks it `required: true`: "Accessible name for the inner search input. Required. It renders no text. It takes precedence over `inputProps['aria-label']`." Installed `@metamask/design-system-react@0.47.0` `TextFieldSearch.types.d.cts` has no `inputAriaLabel`; it appears by 0.51.0.
- Decision: **do not use `inputAriaLabel`**. In 0.47.0 the label goes through the inherited `TextField` `inputProps` (`TextFieldInputProps = Omit<InputProps, …>`, which does not omit `aria-label`): `inputProps={{ 'aria-label': t('search') }}`. The overlay's hint ("check the installed `TextFieldSearch` types for the prop name") sent me to exactly the right place. The installed type does not name the prop directly; I had to follow `TextFieldProps` → `inputProps`.
- Also found: `ButtonFilter` is deprecated toward a React-nonexistent `FilterButton` (ISS-005).

### Scenario 2 — Restyle with foundations

**Mobile (#212) — Pass** (with note ISS-007)

| MCP | Types | Manifest | Overlay | No pin |
| --- | --- | --- | --- | --- |
| ✅ | ✅ | ✅ | ✅ | ✅ |

Target: `app/components/UI/Ramp/components/MenuItem/MenuItem.tsx` plus `MenuItem.styles.ts` (`StyleSheet.create({ listItem: { paddingVertical: 8 } })`), built on legacy `ListItemSelect` with `isSelected={false}` and `ListItemColumn`.

The proposal uses only the 0.55.0 exports `ListItem`, `Icon`, `IconName`, `IconSize`, and `IconColor`. `ListItem` takes `title`, `description`, and `startAccessory` via `ContentProps` and `ListItemPropsShared`, and `isInteractive: true` gives `PressableProps`:

```tsx
import React from 'react';
import {
  Icon,
  IconColor,
  IconName,
  IconSize,
  ListItem,
} from '@metamask/design-system-react-native';

export default function MenuItem({ iconName, title, description, onPress }: MenuItemProps) {
  return (
    <ListItem
      isInteractive
      onPress={onPress}
      twClassName="py-2"
      startAccessory={
        <Icon name={iconName} size={IconSize.Md} color={IconColor.IconDefault} />
      }
      title={title}
      description={description}
    />
  );
}
```

- Delete `MenuItem.styles.ts` and the `useStyles` call; `paddingVertical: 8` becomes `py-2` on the 4px scale, overriding ListItem's default `py-3`.
- Do not add `bg-pressed`: interactive `ListItem` applies it (`ListItem.mjs:34`). Accessibility role defaults to `button`.
- `ListItemSelect isSelected={false}` was a single-select pattern used for navigation. The base rule "Keep single-select (checkmark) and multi-select (checkbox) patterns distinct" supports switching to plain `ListItem`.
- No arbitrary values, no `StyleSheet`, `useTailwind` not needed (no custom style function). Title and description defaults match the old `BodyMd`/`Medium` and `BodySm`/`TextAlternative` (`Content.types.d.cts:12-20`).

**Extension (#213) — Partial** (ISS-006, ISS-008)

| MCP | Types | Manifest | Overlay | No pin |
| --- | --- | --- | --- | --- |
| ✅ | ✅ | ✅ | ⚠️ SCSS rule blocks cleanup | ✅ |

Target: `ui/components/multichain/funding-method-modal/funding-method-item.tsx` (legacy `Box`/`Text`, helper enums, a clickable `div`) plus `index.scss` (`.funding-method-item { cursor: pointer; &:hover { background-color: var(--color-background-hover) } }`).

```tsx
import React from 'react';
import {
  Box,
  BoxAlignItems,
  BoxFlexDirection,
  FontWeight,
  Icon,
  IconName,
  IconSize,
  Text,
  TextColor,
  TextVariant,
} from '@metamask/design-system-react';

const FundingMethodItem = ({ icon, iconSize = IconSize.Md, title, description, onClick }: FundingMethodItemProps) => (
  <Box
    asChild
    flexDirection={BoxFlexDirection.Row}
    alignItems={BoxAlignItems.Center}
    gap={3}
    padding={4}
    className="w-full text-left hover:bg-hover active:bg-pressed"
  >
    <button type="button" onClick={onClick}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center">
        <Icon name={icon} size={iconSize} />
      </span>
      <Box flexDirection={BoxFlexDirection.Column}>
        <Text variant={TextVariant.BodyMd} fontWeight={FontWeight.Medium}>{title}</Text>
        <Text variant={TextVariant.BodySm} color={TextColor.TextAlternative}>{description}</Text>
      </Box>
    </button>
  </Box>
);
```

- `hover:bg-hover` and `active:bg-pressed` are preset-generated (`design-system-tailwind-preset/dist/colors.mjs:16-17`). There are no arbitrary values, and Tailwind removes the default palette and font sizes (`tailwind.config.js:23-30`).
- The cleanup deletes `funding-method-modal/index.scss` and its `@import` in `multichain-components.scss:27`. This literally "modifies SCSS" (ISS-006).
- Semantics improved: a native `button` replaces the clickable `div`. The overlay has no clickable-row pattern (ISS-008).

### Scenario 3 — Legacy* migration

**Mobile (#212) — Pass** (with note ISS-012; Notion status ISS-010)

| MCP | Types | Manifest | Overlay | No pin |
| --- | --- | --- | --- | --- |
| ✅ | ✅ | ✅ | ✅ | ✅ |

Target: `app/components/UI/Notification/SwitchLoadingModal/Loader.tsx`, which imports legacy default `Text` + `TextVariant` from `component-library/components/Texts/Text`, legacy default `Icon` + `IconSize`/`IconName`/`IconColor`, and MMDS `Button`. The incremental step migrates `Text` only:

```tsx
import {
  Button,
  ButtonSize,
  ButtonVariant,
  Text,
  TextVariant,
} from '@metamask/design-system-react-native';
import LegacyIcon, {
  IconColor as LegacyIconColor,
  IconName as LegacyIconName,
  IconSize as LegacyIconSize,
} from '../../../../component-library/components/Icons/Icon';
// …
<Text variant={TextVariant.BodyMd} twClassName="px-6 my-3 self-center">
  {errorContent}
</Text>
```

- `TextVariant.BodyMD` becomes `TextVariant.BodyMd` (`design-system-shared/dist/types/Text/Text.types.d.cts:47`). The hand-set `lineHeight: 20` is dropped because the variant sets it (base: "Never hand-set … line heights").
- The overlay's default-export example (`import LegacyText, { TextVariant as LegacyTextVariant } …`) maps directly onto `Icon`. Aliasing `Icon` here follows the base wording literally. Repository practice would leave it alone until MMDS `Icon` is imported (ISS-012).
- Finishing the step later: swap `LegacyIcon` for MMDS `Icon` (`IconColor.Error` → `IconColor.ErrorDefault`) and remove the `Legacy*` import.
- Notion: the `Legacy*` rule is **Proposed** (2026-11-04) while the skill enforces it as Active (ISS-010).

**Extension (#213) — Partial** (ISS-009)

| MCP | Types | Manifest | Overlay | No pin |
| --- | --- | --- | --- | --- |
| ✅ | ✅ | ✅ | ⚠️ overlay misses the enum path | ✅ |

Target: `funding-method-item.tsx` (above), incremental step migrating `Text` only:

```tsx
import { Icon, IconName, IconSize, Text, TextColor, TextVariant } from '@metamask/design-system-react';
import { Box, Text as LegacyText } from '../../component-library';
import {
  AlignItems,
  Display,
  FlexDirection,
  TextColor as LegacyTextColor,
  TextVariant as LegacyTextVariant,
} from '../../../helpers/constants/design-system';
```

- Legacy `Box` keeps its plain name because MMDS `Box` is not imported in this step (ISS-012 reading). `LegacyText` is needed only if some `Text` usages stay legacy.
- The enum aliases (`TextVariant`, `TextColor`) are the real clash, and they come from `helpers/constants/design-system`, a path the overlay never mentions (ISS-009). `Display`/`FlexDirection`/`AlignItems` are legacy-only and keep their names.
- Notion: same Proposed status as Mobile (ISS-010).

### Scenario 4 — Review checklist

**Mobile (#212) — Pass**

| MCP | Types | Manifest | Overlay | No pin |
| --- | --- | --- | --- | --- |
| ✅ | ✅ | ✅ | ✅ | ✅ |

Invented patch, a new `app/components/UI/Ramp/components/FeeSheet/FeeSheet.tsx`:

```tsx
1  import React from 'react';
2  import { ScrollView, StyleSheet, View } from 'react-native';
3  import {
4    BottomSheet,
5    ButtonBase,
6    ButtonIcon,
7    ButtonPrimary,
8    IconName,
9    Text,
10   TextVariant,
11 } from '@metamask/design-system-react-native';
12
13 const styles = StyleSheet.create({ row: { padding: 15, borderRadius: 16 } });
14
15 export const FeeSheet = ({ onClose, onConfirm, fee }: Props) => (
16   <BottomSheet onClose={onClose}>
17     <ButtonIcon iconName={IconName.Info} onPress={() => undefined} />
18     <ScrollView>
19       <View style={styles.row}>
20         <Text variant={TextVariant.BodyMd} style={{ fontSize: 15 }}>{fee}</Text>
21       </View>
22     </ScrollView>
23     <ButtonBase style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })} onPress={onConfirm}>Back</ButtonBase>
24     <ButtonPrimary onPress={onConfirm}>Confirm</ButtonPrimary>
25   </BottomSheet>
26 );
```

Review findings, following the base Review workflow and the Mobile checklist:

| # | File:line | Finding | Evidence | Fix |
| --- | --- | --- | --- | --- |
| 1 | `FeeSheet.tsx:7,24` | `ButtonPrimary` is not exported by the installed package (invented or future API). | `dist/components/index.d.cts` at 0.55.0 has no `ButtonPrimary`; it ships in 0.56.0. | `<Button variant={ButtonVariant.Primary}>`. |
| 2 | `:18` | React Native `ScrollView` inside `BottomSheet` does not scroll on Android. | Mobile overlay, "Sheets". | `import { ScrollView } from 'react-native-gesture-handler'`. |
| 3 | `:2,13,19` | `StyleSheet.create`, `View`, and hard-coded `padding: 15` / `borderRadius: 16`. | Mobile overlay, "Styling surface"; base, "Never hard-code numbers such as `borderRadius: 16`". | `<Box padding={4} twClassName="rounded-2xl">`. 15px is off the 4px scale, so confirm 16 with design. |
| 4 | `:20` | Hand-set `fontSize`. | Base, "Typography". | Remove `style`; pick a `TextVariant`. |
| 5 | `:23` | `ButtonBase` `style` function does not type-check. | `ButtonBase.types.d.cts:74` `style?: StyleProp<ViewStyle>`; overlay pressed-state rule. | `twClassName={(pressed) => (pressed ? 'opacity-50' : '')}`. |
| 6 | `:17` | Icon-only button with no `accessibilityLabel` and a no-op press. | Base, "Icon-only buttons need an accessible name and a real action". The type does not require it (`ButtonIconPropsShared` has no label), so only review catches it. | Add `accessibilityLabel` and a real `onPress` (open the fee explainer), or remove it. |
| 7 | `:16,23` | Sheet composition: no `BottomSheetHeader`; "Back" calls `onConfirm`. | Overlay, "Use the full sheet composition … back for the child and close for the whole flow"; base trust rules. | Use `BottomSheetHeader` with `onClose`, and wire Back to back navigation. |

The skill's checklists produced every finding I planted; no finding needed knowledge outside the skill, types, and manifest.

**Extension (#213) — Pass**

| MCP | Types | Manifest | Overlay | No pin |
| --- | --- | --- | --- | --- |
| ✅ | ✅ | ✅ | ✅ | ✅ |

Invented patch, a new `ui/components/app/token-search/token-search.tsx`:

```tsx
1  import React from 'react';
2  import { Box as LegacyBox, ButtonIcon, IconName, TextFieldSearch } from '@metamask/design-system-react';
3  import { Box, Text } from '../../component-library';
4  import { TextVariant } from '../../../helpers/constants/design-system';
5  import './index.scss';
6
7  export const TokenSearch = ({ value, onChange, onClear, onClose }: Props) => (
8    <LegacyBox className="flex gap-2 p-[15px] bg-[#ffffff] rounded-[16px]">
9      <TextFieldSearch
10       value={value}
11       onChange={onChange}
12       clearButtonOnClick={onClear}
13       inputAriaLabel="Search tokens"
14     />
15     <ButtonIcon iconName={IconName.Close} onClick={onClose} />
16     <Box><Text variant={TextVariant.bodySm} className="text-[14px] text-gray-500">No results</Text></Box>
17   </LegacyBox>
18 );
```

| # | File:line | Finding | Evidence | Fix |
| --- | --- | --- | --- | --- |
| 1 | `token-search.tsx:2-3` | `Legacy*` prefix put on the MMDS import, and legacy kept on plain names. This is the overlay's exact "Don't". | Extension overlay, "Incremental migration paths". | `import { Box, … } from '@metamask/design-system-react'` and `import { Box as LegacyBox, Text as LegacyText } from '../../component-library'`, or drop legacy entirely (MMDS `Text` covers this). |
| 2 | `:13` | `inputAriaLabel` does not exist at the installed version (manifest-only prop). | React manifest marks it required on `main`; `TextFieldSearch.types.d.cts` at 0.47.0 lacks it. | `inputProps={{ 'aria-label': t('searchTokens') }}` (and localize). |
| 3 | `:15` | Icon-only `ButtonIcon` without `ariaLabel`, which is a type error at 0.47.0. | `ButtonIcon.types.d.cts:12` `ariaLabel: string`; overlay a11y bullet. | `ariaLabel={t('close')}`. |
| 4 | `:8,16` | Arbitrary values (`p-[15px]`, `bg-[#ffffff]`, `rounded-[16px]`, `text-[14px]`) and default palette (`text-gray-500`, removed by `tailwind.config.js:23`). | Base "Foundations"; Extension "Styling surface". | `p-4 bg-default rounded-2xl`; `TextColor.TextAlternative`; no font-size class. |
| 5 | `:5` | New SCSS import. | Extension overlay, "Do not create or modify SASS or SCSS files". | Remove; Tailwind only. |
| 6 | `:4,16` | New usage of legacy `Text`/`TextVariant.bodySm` where MMDS covers it. | Extension checklist, "No new usage of `ui/components/component-library` where MMDS covers the need". | MMDS `Text` + `TextVariant.BodySm`. |
| 7 | `:16` | "No results" is an async status change but is not announced. | Overlay, "Announce async errors and status with `role="alert"` or `aria-live="polite"` on a container that is already mounted". | Wrap the results region in an always-mounted `aria-live="polite"` container. |
| 8 | `:13,16` | Hard-coded English strings. | Out of scope for this skill; covered by `content-guidelines` / i18n. | Use `t()`. |

All planted violations were caught by the skill's own rules. Finding 8 needs another skill. On Extension, `content-guidelines` is not installed by `--domain ui` (it ships a Mobile overlay only), so the base's pointer "Copy and wording rules live in `content-guidelines`" has no Extension target. See ISS-013.

## Install smoke

Commands (from each PR worktree; targets are shallow clones of consumer `main`):

```bash
git worktree add /tmp/sk-mobile origin/cursor/mmds-mobile-skills-refresh-7309
git worktree add /tmp/sk-ext    origin/cursor/mmds-extension-skills-no-storybook-mcp-7309
(cd /tmp/sk-mobile && ./tools/install --repo metamask-mobile    --target /tmp/mm-mobile --domain ui)   # exit 0
(cd /tmp/sk-ext    && ./tools/install --repo metamask-extension --target /tmp/mm-ext    --domain ui)   # exit 0
```

| Check | Mobile (#212) | Extension (#213) |
| --- | --- | --- |
| Installer exit code | 0 | 0 |
| Outputs | `.claude/skills/`, `.agents/skills/` (with `agents/openai.yaml`), `.cursor/rules/…/RULE.md` | same |
| Merged file = shared base + overlay | ✅ 332 lines; `# MetaMask UI Development — MMDS Guidance` then `# MetaMask Mobile overlay` at line 210 | ✅ 294 lines; base then `# MetaMask Extension overlay` at line 210 |
| `references/reading-mmds-manifests.md` copied | ✅ all three targets | ✅ all three targets |
| `knowledge/agentic-design-system-strategy.md` copied | ✅ | ✅ |
| Relative links resolve | ⚠️ `references/…` OK; Strategy link broken (ISS-002, pre-existing) | ⚠️ same, plus the overlay's own `../../../knowledge/` link |
| No `mmds-react*.md` files | ✅ (`find -iname '*mmds-react*'` returns nothing) | ✅ |
| No MMDS version pins | ✅ only numeric match is "WCAG 2.5.3" | ✅ same |
| Storybook MCP wording | Optional, never block (base line 61) | Optional, never block; no "Required Storybook MCP Workflow" |
| Paths named by the skill exist | ✅ `dist/components/index.d.cts`, `design-system.stories.tsx`, `components-temp/`, `Nav/App/ToasterOverlay`, `Texts/Text` default + `TextVariant` export, `locales/languages/en.json` | ✅ `dist/components/index.d.cts`, `ui/components/component-library`, `ui/components/ui/marketing-moment`, `tailwind.config.js` preset + empty `fontSize` |
| External links | ✅ README at tag (`…react-native@0.55.0/…/Button/README.md` 200), `MIGRATION.md`, `AGENTS.md`, `docs/ai-agents.md`, three `.cursor/rules/*.md`: all 200 | ✅ `README.mdx` at `@metamask/design-system-react@0.47.0` 200 (`.md` would 404, and the overlay correctly says `.mdx`) |
| Hosted manifest reachable | ✅ RN, 1.15 MB, 87 entries | ✅ React, 0.9 MB, 62 entries |
| Other #212 overlays | `mms-component-scaffold` and `mms-content-guidelines`: README-at-tag, no MCP, no pins | n/a |

Cross-PR install (each PR alone): ⚠️ contradictory output for the other platform (ISS-003). Merging #212 then #213 is conflict-free.

### A/B contrast with `main`

Installed from `main` (`c40ef31`) into separate copies of both consumers:

- **Extension `main`** (164 lines): "## Required Storybook MCP Workflow — 1. Start by querying `storybook-broker-mcp` with `list-all-documentation`…", then a "Fallback When Storybook MCP Is Unavailable" section. With MCP assumed unavailable, an agent on `main` has to take the fallback path for every task and is told the server "is expected to be" present. #213 removes that, and makes types → manifest → README-at-tag the primary path. Clear improvement; nothing from the `main` fallback that I needed was lost.
- **Mobile `main`** (440 lines): a long hand-written component and prop inventory and conversion guide, including "**LAST RESORT**: Custom components with StyleSheet", which contradicts its own "REJECT any code suggestions that use StyleSheet.create()". #212 is a third of the size, drops the inventory in favor of the manifest plus installed types, and is internally consistent. The only `main` content I missed was the conversion guide (ISS-007).
- The Strategy-link breakage (ISS-002) is identical on `main`.

