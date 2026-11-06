# UI development skills reshape eval, re-run after ISS fixes — 2026-11-05

This re-runs the [first eval](ui-development-reshape-2026-11-05.md) with the same method, after the actionable ISS fixes were applied to both PRs.

PRs: [#212](https://github.com/MetaMask/skills/pull/212) (Mobile), [#213](https://github.com/MetaMask/skills/pull/213) (Extension)

Skill heads under test:

- #212 `cursor/mmds-mobile-skills-refresh-7309` @ `02bb1c2` (first run: `2d1ba46`)
- #213 `cursor/mmds-extension-skills-no-storybook-mcp-7309` @ `a46f691` (first run: `9c57432`)
- A/B baseline: `main` @ `c40ef31` (unchanged)

The fixes are one shared commit, byte-identical on both branches (`6868dbc` on #212, `1ae0f98` on #213), plus one overlay commit per platform. Neither PR edits `CHANGELOG.md` in these commits.

Consumers (sparse shallow clones of `main`, 2026-11-05):

| Consumer | Commit | MMDS package (lockfile) | Shared | Preset |
| --- | --- | --- | --- | --- |
| metamask-mobile | `178a32b` | `design-system-react-native` 0.55.0 | `design-system-shared` 0.44.0 | `design-system-twrnc-preset` 0.14.0 |
| metamask-extension | `79ab2fd` | `design-system-react` **0.51.0** (was 0.47.0) | `design-system-shared` 0.45.0 | `design-system-tailwind-preset` 0.16.0 |

Extension `main` bumped its MMDS packages in [metamask-extension#47305](https://github.com/MetaMask/metamask-extension/pull/47305) (merged 21:51 UTC), after the first eval. As in the first run, installed types come from the npm tarballs at the lockfile versions (ISS-001). Storybook MCP and Context Forge were treated as unavailable.

## Summary

| Scenario | Mobile (#212) | Extension (#213) | First run |
| --- | --- | --- | --- |
| 1. Types win over manifest | Pass | Pass | Pass / Pass |
| 2. Restyle with foundations | Pass | **Pass** | Pass / Partial |
| 3. Legacy* migration | Pass | **Pass** | Pass / Partial |
| 4. Review checklist | Pass | Pass | Pass / Pass |
| Install smoke | Pass | Pass | Pass / Pass (with ISS-002) |

Both Extension Partials are now Pass. No new issues were found.

Merge verdict: **still safe to merge together, still not separately** (ISS-003 is unchanged by design). Merging #212 then #213, or #213 then #212, onto `main` is conflict-free, and the shared files are identical on both branches.

## Issue status

| Issue | Severity | Status | Change |
| --- | --- | --- | --- |
| ISS-001 | note | Open (method) | Unchanged. Tarballs instead of a full `yarn install`. |
| ISS-002 | minor | **Fixed** | The base's Strategy link is now an absolute GitHub URL (returns 200). The duplicate Extension overlay link is removed. No `../knowledge` links remain in either installed copy. |
| ISS-003 | major | Open (merge order) | Unchanged. Merge #212 and #213 back to back. |
| ISS-004 | minor | **Fixed** | `reading-mmds-manifests.md` lists the non-component entry kinds (`design-tokens-`/`docs-`, `patterns-`, cast-expression names). It says to treat an entry as a component only when its `path` is under the platform package's `src/components/` and the name is in the installed export index. The Mobile overlay names `app/components/UI/MarketingMomentTitle`. |
| ISS-005 | minor | **Fixed** | Base: "Use the replacement the JSDoc names if the installed platform package exports it. If no replacement is named, or the named one is not exported on this platform, keep existing usage and record the gap." |
| ISS-006 | minor | **Fixed** | Extension: "Do not add SASS or SCSS. Deleting SCSS rules, files, and `@import` lines that your change makes unused is expected." The checklist matches. |
| ISS-007 | note | **Fixed** | Mobile: a bullet on retiring `useStyles` + `*.styles.ts`. The `ListItem` bullet now says `isInteractive` applies the pressed background itself. |
| ISS-008 | minor | **Fixed** | Extension: prefer `Box` typed props for layout and `className` for the rest. Follow accessible web practices for anything clickable: a native `<button type="button">` or `<a>` (for example via `Box asChild`) with preset state classes, never `onClick` on a `div` or `span`. The overlay does not name any component as missing. |
| ISS-009 | major | **Fixed** | Extension "Incremental migration paths" names `ui/helpers/constants/design-system` as the source of most legacy enums. It says which to alias and which legacy-only enums keep their names, and the Do example shows both. |
| ISS-010 | minor | Deferred | Design Brain status (`Legacy*` and Hero still Proposed in Notion). Review later; no Notion or Design Brain change from this work. |
| ISS-011 | major | Deferred | Active Design Brain evidence-order rule vs "installed types win". Review later; no Notion change. The skill still says installed types win. |
| ISS-012 | note | **Fixed** | Base trigger: alias "when a file imports the same name from a legacy source and from the MMDS platform package". Legacy imports with no MMDS counterpart in the same file keep their names. |
| ISS-013 | minor | **Fixed** | Base: "Copy and wording rules live in `content-guidelines`, and file layout and test setup live in `component-scaffold`, where the repository has them." Extension still has no `content-guidelines` overlay; that is out of scope for #213. |

Open after this run: ISS-001 (method note), ISS-003 (merge together), ISS-010 and ISS-011 (Design Brain, deferred).

## Scenario results

Method as before: work as an agent with only the installed `mms-ui-development` skill, the installed types, the hosted manifests, and GitHub READMEs. Follow "Sources, in order" and the Create or Review workflow.

Rubric columns: **MCP** = did not block on Storybook MCP · **Types** = checked installed types before inventing · **Manifest** = used the correct hosted manifest for discovery only · **Overlay** = followed the platform overlay · **No pin** = no hard-coded MMDS version in the guidance followed.

### Scenario 1 — Types win over manifest

**Mobile (#212) — Pass**

| MCP | Types | Manifest | Overlay | No pin |
| --- | --- | --- | --- | --- |
| ✅ | ✅ | ✅ RN manifest | ✅ | ✅ |

- `ButtonPrimary` / `ButtonSecondary` / `ButtonTertiary` are the only manifest components under `src/components/` that the installed 0.55.0 index does not export. Refused. Use `Button` with `variant={ButtonVariant.Primary}`.
- `patterns-marketing-moments` (`name: "MarketingMoment"`): the updated reference flags `patterns-` ids as composition examples, so the agent does not look for an export. It goes straight to the overlay's `app/components/UI/MarketingMomentTitle`. (ISS-004 fixed.)
- `ButtonFilter` is deprecated toward `FilterButton`, which RN 0.55.0 exports, so the replacement is valid here.

**Extension (#213) — Pass**

| MCP | Types | Manifest | Overlay | No pin |
| --- | --- | --- | --- | --- |
| ✅ | ✅ | ✅ React manifest | ✅ | ✅ |

- The first run's candidate (`TextFieldSearch.inputAriaLabel`) is no longer manifest-only. At 0.51.0, `TextFieldSearch.types.d.cts:9` has `inputAriaLabel: string` (required). The overlay's "check the installed `TextFieldSearch` types for the prop name" now leads to `inputAriaLabel` with no skill change. That is the no-pin design working: the old #213 revision pinned 0.49.0 and would have had to be re-synced.
- New candidate: `ButtonPrimary`, which is in the React manifest (`react-components-button-variants-buttonprimary`) but not in the 0.51.0 export index. Refused. Use `Button` with `ButtonVariant.Primary` (`design-system-shared` 0.45.0 `Button.types.d.cts:9`).
- `ButtonFilter`: `@deprecated Use \`FilterButton\` instead` (`ButtonFilter.d.cts:4`), and React 0.51.0 does not export `FilterButton`. Under the new base wording, keep the existing `ButtonFilter` usage and record the gap. The rule no longer points the agent at a component missing from this platform. (ISS-005 fixed.)

### Scenario 2 — Restyle with foundations

**Mobile (#212) — Pass**

| MCP | Types | Manifest | Overlay | No pin |
| --- | --- | --- | --- | --- |
| ✅ | ✅ | ✅ | ✅ | ✅ |

The target is the same: `app/components/UI/Ramp/components/MenuItem/MenuItem.tsx` + `MenuItem.styles.ts`. The proposal is the same as in the first run: `ListItem isInteractive` with `twClassName="py-2"`. The difference is that the overlay now states both steps the agent previously had to infer:

- "When you change a component that uses `useStyles` with a `*.styles.ts` file, move its styles to typed `Box` props or `twClassName`, then delete the styles file and the `useStyles` call." That covers deleting `MenuItem.styles.ts` and the `useStyles(styleSheet, {})` call.
- "`ListItem` with `isInteractive`, which applies the pressed background itself; do not add `bg-pressed` again." This matches `ListItem.mjs:34` at 0.55.0.

(ISS-007 fixed.)

**Extension (#213) — Pass** (was Partial)

| MCP | Types | Manifest | Overlay | No pin |
| --- | --- | --- | --- | --- |
| ✅ | ✅ | ✅ | ✅ | ✅ |

The target is the same: `ui/components/multichain/funding-method-modal/funding-method-item.tsx`, a legacy `Box` with `onClick` plus `.funding-method-item` hover SCSS. Each overlay rule now maps to one part of the proposal:

- "Prefer MMDS `Box` typed props … for layout": `flexDirection`, `alignItems`, `gap={3}`, `padding={4}` on MMDS `Box`.
- "A native `<button type="button">` for actions … (for example through `Box asChild`), with preset state classes such as `hover:bg-hover active:bg-pressed`": `Box asChild` (`Box.types.d.cts:14` at 0.51.0) around `<button type="button" onClick={onClick}>`, `className="w-full text-left hover:bg-hover active:bg-pressed"`. Both classes are generated by preset 0.16.0 (`colors.mjs:16-17`). (ISS-008 fixed.)
- "Deleting SCSS rules, files, and `@import` lines that your change makes unused is expected": delete `funding-method-modal/index.scss` and `@import 'funding-method-modal';` (`multichain-components.scss:27`). The checklist item "No SASS or SCSS added; SCSS made unused by the change is deleted" now passes for exactly this diff. (ISS-006 fixed.)

### Scenario 3 — Legacy* migration

**Mobile (#212) — Pass**

| MCP | Types | Manifest | Overlay | No pin |
| --- | --- | --- | --- | --- |
| ✅ | ✅ | ✅ | ✅ | ✅ |

Target: `app/components/UI/Notification/SwitchLoadingModal/Loader.tsx`. The step migrates `Text` only:

```tsx
import { Button, ButtonSize, ButtonVariant, Text, TextVariant } from '@metamask/design-system-react-native';
import Icon, { IconColor, IconName, IconSize } from '../../../../component-library/components/Icons/Icon';
```

- Under the new trigger ("the same name from a legacy source and from the MMDS platform package"), legacy `Icon`/`IconName`/`IconSize`/`IconColor` keep their plain names, because MMDS `Icon` is not imported in this step. That matches repository practice. (ISS-012 fixed.)
- If some `Text` usages stay legacy, the overlay's default-export example applies: `import LegacyText, { TextVariant as LegacyTextVariant } …`.
- Notion still marks the `Legacy*` rule as Proposed (ISS-010, deferred).

**Extension (#213) — Pass** (was Partial)

| MCP | Types | Manifest | Overlay | No pin |
| --- | --- | --- | --- | --- |
| ✅ | ✅ | ✅ | ✅ | ✅ |

Target: `funding-method-item.tsx`. The step migrates `Text` only:

```tsx
import { Icon, IconName, IconSize, Text, TextColor, TextVariant } from '@metamask/design-system-react';
import { Box } from '../../component-library';
import {
  AlignItems,
  Display,
  FlexDirection,
  TextColor as LegacyTextColor,
  TextVariant as LegacyTextVariant,
} from '../../../helpers/constants/design-system';
```

- The overlay now says legacy enums come from `ui/helpers/constants/design-system`. It says to alias those the file also imports from MMDS (`TextVariant`, `TextColor`, which React 0.51.0 exports via `Text/index`), and that legacy-only `Display`, `FlexDirection`, `AlignItems` keep their names (no MMDS export of those names). The Do example shows exactly this shape. (ISS-009 fixed.)
- Legacy `Box` keeps its name because MMDS `Box` is not imported in this step (ISS-012 trigger). `LegacyTextColor`/`LegacyTextVariant` are needed only if some legacy `Text` usage stays.

### Scenario 4 — Review checklist

**Mobile (#212) — Pass**

The same invented `FeeSheet.tsx` patch produced the same seven findings, with the same evidence at 0.55.0:

1. `ButtonPrimary` is not exported.
2. React Native `ScrollView` is used inside `BottomSheet`.
3. `StyleSheet`, `View`, and hard-coded `15`/`16`.
4. Hand-set `fontSize`.
5. A `ButtonBase` `style` function (`ButtonBase.types.d.cts:74`, `StyleProp<ViewStyle>`).
6. An unlabeled, no-op `ButtonIcon`.
7. The sheet has no header, and Back calls `onConfirm`.

The new `useStyles` bullet does not apply because the patch is a new file.

**Extension (#213) — Pass**

The same invented `token-search.tsx` patch:

| # | Finding | Change from first run |
| --- | --- | --- |
| 1 | `Legacy*` prefix on the MMDS import | Same. |
| 2 | `inputAriaLabel` | **No longer a finding.** It is required at 0.51.0. The skill reached the right answer from the installed types without any edit. |
| 3 | `ButtonIcon` without `ariaLabel` (type error, `ButtonIcon.types.d.cts:12`) | Same. |
| 4 | Arbitrary values and default palette | Same. |
| 5 | New SCSS import | Same. The new wording "Do not add SASS or SCSS" still catches it. |
| 6 | New legacy `Text` / `TextVariant.bodySm` | Same. The new enum-path paragraph also flags the `helpers/constants/design-system` `TextVariant` import as the legacy enum. |
| 7 | Unannounced "No results" status | Same. |
| 8 | Hard-coded English strings | Same. The base pointer is now qualified ("where the repository has them"), so it no longer points Extension agents at a skill that is not installed (ISS-013). |

## Install smoke

```bash
git worktree add /tmp/wt-m origin/cursor/mmds-mobile-skills-refresh-7309          # 02bb1c2
git worktree add /tmp/wt-e origin/cursor/mmds-extension-skills-no-storybook-mcp-7309  # a46f691
(cd /tmp/wt-m && ./tools/install --repo metamask-mobile    --target /tmp/ev/metamask-mobile    --domain ui)  # exit 0
(cd /tmp/wt-e && ./tools/install --repo metamask-extension --target /tmp/ev/metamask-extension --domain ui)  # exit 0
```

| Check | Mobile (#212) | Extension (#213) |
| --- | --- | --- |
| Installer exit code | 0 | 0 |
| Merged file = base + overlay | ✅ 339 lines; overlay at line 212 | ✅ 314 lines; overlay at line 212 |
| `references/reading-mmds-manifests.md` and `knowledge/` copied | ✅ `.claude`, `.agents`, `.cursor/rules` | ✅ same |
| Relative links resolve in the installed `SKILL.md` | ✅ none broken (ISS-002 fixed) | ✅ none broken |
| Strategy link | ✅ absolute GitHub URL, 200 | ✅ same (overlay duplicate removed) |
| No `mmds-react*.md`, no MMDS version pins | ✅ | ✅ |
| `mms-content-guidelines` installed | ✅ | — (not shipped for Extension; the base pointer is now qualified) |
| `yarn test` / `yarn lint` / `yarn audit:skills` on the PR head | 76/76, pass, 0 errors | 76/76, pass, 0 errors |

Cross-PR installs (each PR alone, other platform), unchanged from the first run:

| Install | Lines | Contradiction |
| --- | --- | --- |
| #212 head → Extension | 365 | Old `main` overlay's "Required Storybook MCP" is still present (ISS-003) |
| #213 head → Mobile | 641 | Old `main` overlay's "LAST RESORT: … StyleSheet" is still present (ISS-003) |
| `main` → Extension / Mobile | 164 / 440 | A/B baseline; same as the first run |

## Constraints checked

- No `CHANGELOG.md` change in the fix commits on either branch.
- No version pins or component inventories were added. No overlay says a component is missing on its platform. The Extension clickable-row guidance is framed as accessible web practice.
- `design-system-shared`: guidance unchanged. Products import from the platform package. On Extension, `shared` appears only in the Tailwind `content` globs.
- No Design Brain or Notion changes. ISS-010 and ISS-011 are left for review.
- PR media format is not in any `ui-development` file.
