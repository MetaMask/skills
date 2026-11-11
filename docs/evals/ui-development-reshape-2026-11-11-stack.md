# UI development reshape eval — stacked PRs (#242 + #212 + #213), 2026-11-11

Fourth agent-driven run of the reshaped `ui/ui-development` skills. Earlier runs: [`ui-development-reshape-2026-11-05.md`](ui-development-reshape-2026-11-05.md), [`ui-development-reshape-2026-11-05-rerun.md`](ui-development-reshape-2026-11-05-rerun.md), and [`ui-development-reshape-2026-11-11.md`](ui-development-reshape-2026-11-11.md). Those docs are unchanged; issue numbers carry over.

This run evaluates the stack as it will merge: the shared files in #242, plus the Mobile overlays in #212 and the Extension overlay in #213.

## Heads

| PR | Branch | Head | Base |
| --- | --- | --- | --- |
| [#242](https://github.com/MetaMask/skills/pull/242) shared baseline | `cursor/ui-development-shared-baseline-4462` | `6f485f132f3c457bf026140c86f23f31dc96a48c` | `main` @ `161673f` |
| [#212](https://github.com/MetaMask/skills/pull/212) Mobile | `cursor/mmds-mobile-skills-refresh-7309` | `68c92124bd061da1ff403cb22295f8a2a30e59ef` | #242's branch |
| [#213](https://github.com/MetaMask/skills/pull/213) Extension | `cursor/mmds-extension-skills-no-storybook-mcp-7309` | `783ebd4c2e630d6bee1edea24ca5c173fd6b3e2a` | #242's branch |

Stack shape, checked with `git merge-base --is-ancestor` and `git diff --stat`:
- #242 is one commit on current `main`, and changes only the shared files: base `skill.md`, `references/reading-mmds-manifests.md`, and `knowledge/agentic-design-system-strategy.md`.
- #212 contains #242's head, and changes only the Mobile `ui-development` overlay and the Mobile `component-scaffold` overlay.
- #213 contains #242's head, and changes only the Extension `ui-development` overlay.
- No PR in the stack touches a `CHANGELOG.md` or `attribution.txt`.

Consumers: `metamask-mobile` `main` @ `2893eef8` and `metamask-extension` `main` @ `88e929e`, both today's heads. Their MMDS dependency ranges are unchanged since the last run, so the npm tarballs from the last run still match the lockfile pins and were reused for `node_modules` (ISS-001). The manifests were re-fetched today: React Native has 84 entries and React has 53, unchanged.

## Summary

| Scenario | Mobile | Extension |
| --- | --- | --- |
| 1. Types win over manifest | **Pass** (was Partial) | **Pass** (was Partial) |
| 2. Restyle with foundations | Pass | Pass |
| 3. Legacy* migration | Pass | Pass |
| 4. Review checklist | Partial (ISS-018) | Partial (ISS-018) |

- **ISS-014 is resolved.** The base now has one Deprecated APIs section that every overlay and the scaffold defer to. It says to grep the component's whole installed folder, and that an empty `jsDocTags` is not evidence a component is current. Following it, an agent finds both deprecated button-family components on each platform. A literal reading of the previous heads found none.
- **ISS-003 still applies, in a new shape.** The stack merges cleanly in every order, and a squash merge of #242 gives the same final tree. But any state where #242 is on `main` without both overlay PRs ships a new base over an old overlay.
- **No blocker or new major issue.** One new minor (ISS-023, a leftover app path in the Mobile scaffold) and four new notes.

Verdict: **ready to mark ready for review, as one unit.** Merge #242, then #212 and #213 immediately (either order), so `main` never ships #242 alone (ISS-003). ISS-018 and ISS-023 are small text fixes that can land before or right after.

## Issue status

| ID | Severity | Status | Notes for this run |
| --- | --- | --- | --- |
| ISS-001 | note | Open (method) | Tarballs at lockfile pins; no full app install, so proposals were not type-checked. |
| ISS-002 | minor | Fixed | Every relative link in the installed `ui-development` and `component-scaffold` files resolves, in all three targets on both platforms. |
| ISS-003 | major | **Open, new shape** | See [ISS-003 with the new stack](#iss-003-with-the-new-stack). |
| ISS-004 | minor | Fixed | The reference keeps "Treat an entry as a component only when its `path` is a story under … `src/components/` … and the component name appears in the installed export index." |
| ISS-005 | minor | Fixed | Base `skill.md:105-109`: use the named replacement when the installed platform package exports it, "even if the repository still uses the deprecated one". |
| ISS-006 | minor | Fixed | Extension overlay `:49-50`, the SCSS deletion wording. |
| ISS-007 | note | Fixed | Mobile overlay `:48-50` (`useStyles` conversion) and `:67-70` (interactive rows). |
| ISS-008 | minor | Fixed | Extension overlay `:64-67`: native button or link through `Box` `asChild`, never `onClick` on a `div`. |
| ISS-009 | major | Fixed | Now without a path: "Legacy components and legacy enums often come from different modules. Search the repo for the existing legacy imports" (Extension overlay `:73-77`). Scenario 3 confirms an agent still finds the module. |
| ISS-010 | minor | **Resolved (skill side)** | Read-only Notion query today: the `Legacy*` rule is Active. Typography is still Proposed, but #242 no longer cites it, so the skill enforces only Active rules. The typography gap itself is ISS-018. |
| ISS-011 | major | Deferred | The Active evidence-order rule still ranks MMDS `main` and published Storybook without mentioning installed types. The skill still says installed types win. No Notion change from this work. |
| ISS-012 | note | Fixed | Base `skill.md:147-149` alias trigger. |
| ISS-013 | minor | Fixed | Base `skill.md:28-29` points to `content-guidelines` and `component-scaffold` "where the repository has them". Both are installed on Mobile; Extension has `content-guidelines` only, so the qualifier is accurate. |
| ISS-014 | major | **Fixed** | See [ISS-014 verification](#iss-014-verification). |
| ISS-015 | major | Fixed | Base `skill.md:82-85`. The Mobile overlay dropped its duplicate of the sentence; both overlays keep "Search the repo for existing MMDS usage before building custom UI." |
| ISS-016 | minor | **Fixed** | Reference: "A component that does not accept one of them does not list it." Manifests today: React lists `testID` on 0/53 entries and its installed types declare it on none; React Native lists `className` on 0/84, and its types mention it only inside a JSDoc comment. The reference now matches both. |
| ISS-017 | note | **Fixed** | Reference now calls `docs.json` "intro docs" and says React Native does not publish one. |
| ISS-018 | minor | **Open** | See [ISS-018](#iss-018--font-family-choice-defers-to-sources-that-hold-no-usage-policy-still-open). |
| ISS-019 | note | Open | Mobile overlay `:95-96` still says to read the `Text` default role from the installed types; the default is only in the implementation (same package version as last run). |
| ISS-020 | minor | **Fixed** | Both `ui-development` overlays are free of app folder paths: `grep -oE '\`(app\|ui)/[^\`]*\`'` returns 0 in every installed file. The toaster now says "at the app root; search the repo for it". What is left is in the Mobile scaffold (ISS-023). |
| ISS-021 | note | Open | Mobile overlay `:27-30` ("Existing app-level components") and `:112` ("Legacy app-level components") still use one term for both the legacy library and feature components. Scenario 3 still passes. |
| ISS-022 | note | Open | Pass but fragile, as before: three button variant components are in both manifests but not in either export index. React Native ships their folders under `dist/`, and the `exports` map is only `"."` and `"./package.json"`. Base `skill.md:82-83` and the reference's export-index check catch it. |
| ISS-023 | minor | **New** | Mobile scaffold import example cites a real app file. See below. |
| ISS-024 | note | **New** | Deprecated APIs does not say what new code should use when the replacement is not exported. |
| ISS-025 | note | **New** | Review checklist lost its "installed types were read" item. |
| ISS-026 | note | **New** | `MIGRATION.md` links track MMDS `main` with no "installed types win" caveat. |
| ISS-027 | note | **New** | Formatting: one unwrapped line in the base. |

### ISS-014 verification

Probe: each platform's installed package has two button-family components tagged `@deprecated`, and today's manifests have no non-empty `jsDocTags.deprecated` on either platform.

| Step from base `skill.md:100-115` | Mobile | Extension |
| --- | --- | --- |
| `grep -rn @deprecated …/dist/components/<Name>/` finds the tag | ✅ 2/2 (component declaration `<Name>.d.cts`, plus the other declaration and source-map copies) | ✅ 2/2 |
| `.types` file carries the tag (the old pointer) | 0/2, which is why the base now says "the `.types` file can omit it" | 0/2 |
| Manifest `jsDocTags` | empty for both: "not evidence that it is current" applies | empty for both |
| README at the installed tag | 1/2 mention it; the base treats this as a supporting signal, not the primary check | 1/2 |
| Replacement named by the JSDoc is exported | yes for both: use the replacement | one yes, one no: keep existing usage and record the gap |
| Existing repo usage of the deprecated components | yes (5 and 3 files) | yes (4 and 1 files) |

So the rule finds every deprecation, and "even if the repository still uses the deprecated one" handles the existing usage correctly. The rule is in one place: both `ui-development` overlays (`:21-22` Mobile, `:20-21` Extension) and the Mobile scaffold (`:67`, `:348`) only give the platform folder and defer to it. The review workflow (`skill.md:74-76`) and the first checklist item (`skill.md:211-212`) both point to it.

### ISS-003 with the new stack

| State of `main` | Mobile install | Extension install |
| --- | --- | --- |
| #242 + #212 + #213 (any order; also with #242 squash-merged) | ✅ 353 lines, overlay at line 218 | ✅ 325 lines, overlay at line 218 |
| #242 only | ⚠️ 647 lines: new base + old `main` overlay ("LAST RESORT: Custom components with StyleSheet"), plus the old scaffold. About 115 MMDS component-name mentions and 7 app paths. | ⚠️ 371 lines: the base says "None of these needs an MCP server" (line 28), but the old overlay has a required MCP-server workflow (line 286), a vendor MCP broker, and a Tailwind major-version pin. |
| #242 + #212 only | ✅ | ⚠️ same as "#242 only" |
| #242 + #213 only | ⚠️ same as "#242 only" | ✅ |

Merge checks:
- `git merge-tree` of #242 onto `main` is conflict-free, and its tree equals #242's tree.
- Then #212 and #213 in either order: conflict-free, same final tree (`ff40076`).
- With #242 squash-merged (simulated as a new single commit with #242's tree on `main`), #212 then #213, and the reverse, are also conflict-free with the same tree. So the usual squash flow works for the stacked branches.

Recommendation: do not leave `main` with #242 alone. Merge the three back to back. Once #242's branch is deleted, GitHub retargets #212 and #213 to `main`, and their diffs shrink to the overlay files.

### ISS-018 — Font family choice defers to sources that hold no usage policy (still open)

- Platform: Shared (base "Typography", `skill.md:135-143`)
- Scenario: 4 (Review checklist)
- Severity: minor
- Change since last run: the amount-input bullet no longer links Notion; it says "Use the font family and variant options the installed types expose, and do not invent a dedicated amount style." That removes the only pointer to the Proposed typography rule.
- Actual:
  - The base still says to follow "the hosted manifest and the component README at the installed tag for when each applies".
  - At the installed tags, the React `Text` README says what the hero family renders and which cut ships, not when to use it. The React Native `Text` README does not mention it.
  - So the checklist item "Typography uses the design-system text component and the font family and variant options from the installed types" (`skill.md:217-218`) still passes body copy set in the hero family.
- Suggested fix (skills, no Notion and no enum names): add to the Typography bullets, "The hero family is for a view's single primary display amount, large amount inputs, and marketing headlines. Do not use it for body text, labels, buttons, titles, or small numbers, and do not pair it with a font weight. (Proposed rule: treat as guidance.)" Then the reviewer can flag misuse as guidance.

### ISS-023 — Mobile scaffold import example cites a real app file

- Platform: Mobile (`domains/ui/skills/component-scaffold/repos/metamask-mobile.md`, #212)
- Scenario: Install smoke, content rules
- Severity: minor
- Expected: App folder paths appear only in the accepted placement table, the ESLint fence table, and the barrel section.
- Actual:
  - `:162-165` "Imports: no path aliases" gives a full app file path as its example, plus that component's type import. This is outside the accepted sections, and it goes stale when the file moves.
  - `:18`: the naming rule names two real app component folders. It is inside the placement section, so it is probably covered by the exception; maintainers should confirm.
  - `:149` and `:154`: the i18n section names the repo-root locales module and the English strings file. These are repository-root paths rather than app folders; maintainers should confirm.
- Suggested fix (skills): Replace `:162-165` with a placeholder, for example "From a component four folders below the feature root: `import { strings } from '<../ to repo root>/<i18n module>';`". Use placeholders in `:18` (`<ComponentName>/`).

### ISS-024 — Deprecated APIs does not cover new usage when the replacement is not exported

- Platform: Shared (`skill.md:105-109`)
- Scenario: 4 (Review checklist)
- Severity: note
- Actual: The rule bans new usage, uses the replacement when it is exported, and otherwise "keep[s] existing usage and record[s] the gap". On Extension, one deprecated component's named replacement is not exported. A reviewer correctly flags new usage, but the skill does not say what the fix is.
- Suggested fix (skills): "For new code, fall back to the component hierarchy (legacy library, feature component, or custom UI from MMDS primitives) and record the gap."

### ISS-025 — Review checklist lost its "installed types were read" item

- Platform: Shared (`skill.md:209-220`)
- Severity: note
- Actual: The previous first item, "Installed types were read for every MMDS building block; the manifest and README were used only as supporting sources", was replaced by the deprecation item. Types-first is still in "Sources, in order" and in "No invented components, props, or variants", so scenario 1 still passes. The checklist no longer states it, though.
- Suggested fix (skills): Fold it back into the deprecation item: "Every MMDS building block was confirmed in the installed exports and types, and checked for deprecation."

### ISS-026 — `MIGRATION.md` links track MMDS `main`

- Platform: Mobile overlay `:128-129`, Extension overlay `:95-96`
- Severity: note
- Actual: The prop-mapping links point at `main`, while READMEs use the installed tag. Both `MIGRATION.md` files exist at the installed per-package tags (200), so a tagged link works. The "MMDS agent docs" section (`skill.md:205-206`) has a "these track MMDS `main`; installed types win" caveat; these links do not.
- Suggested fix (skills): Use the same per-package tag pattern as the README links, or add the caveat.

### ISS-027 — One unwrapped line in the base

- Platform: Shared (`skill.md:151`)
- Severity: note
- Actual: "…until that step migrates them. Do not alias legacy names that MMDS does not export, and never put the" runs to about 100 characters; the rest of the file wraps at 80. It is cosmetic, and lint passes.

## Scenario results

Method (unchanged): work as an agent with only the installed `mms-ui-development` skill (combined stack), the installed types, today's hosted manifests, and GitHub READMEs at the installed per-package tags. Follow "Sources, in order" and the Create or Review workflow. Targets are described by role, not path.

Rubric columns: **No MCP** = no dependency on any MCP server · **Types** = checked installed types before inventing · **Manifest** = used the correct hosted manifest for discovery only · **Overlay** = followed the platform overlay · **No pin** = no hard-coded MMDS version in the guidance followed.

### Scenario 1 — Types win over manifest

**Mobile — Pass** · **Extension — Pass**

| No MCP | Types | Manifest | Overlay | No pin |
| --- | --- | --- | --- | --- |
| ✅ | ✅ | ✅ | ✅ | ✅ |

- Manifest-ahead probe: on each platform, 3 component entries (button variants) are absent from the installed export index. The reference's "component name appears in the installed export index" rejects them, and the base forbids deep imports (ISS-022).
- Enum-source probe: 30 React Native and 21 React story `import` snippets pull enums from the shared package. Base `skill.md:51-54` and the reference caveat redirect them to the platform package. Base `skill.md:38-42` now says why: shared types are declared there, but imported from the platform package.
- Deprecation probe: passes (see [ISS-014 verification](#iss-014-verification)). This was the Partial on the last run.

### Scenario 2 — Restyle with foundations

**Mobile — Pass** · **Extension — Pass**

| No MCP | Types | Manifest | Overlay | No pin |
| --- | --- | --- | --- | --- |
| ✅ | ✅ | ✅ | ✅ | ✅ |

- **Mobile target:** a pressable row that the design-system list item covers.
  - The overlay styling surface is unchanged: `useTailwind()` is used in 643 app files today, with no default `twrnc` import, and `useStyles` conversion and interactive rows are covered at `:48-50` and `:67-70`.
  - The list-item README at the installed tag returns 200 and documents the interactive pressed tint.
- **Extension target:** a clickable row with no React list-row component, so the agent composes one.
  - The `Box` README at the installed tag returns 200 and documents `asChild` (4 mentions).
  - The repo already composes `Box asChild` and uses `hover:bg-hover`.
  - Today's `tailwind.config.js` still loads the MMDS preset and empties the default palette and `fontSize`, so the overlay's claims (`:40-43`, `:51-52`) hold.
  - Dropping the Tailwind version from `:40` loses nothing the agent needs.

### Scenario 3 — Legacy* migration

**Mobile — Pass** (note ISS-021) · **Extension — Pass**

| No MCP | Types | Manifest | Overlay | No pin |
| --- | --- | --- | --- | --- |
| ✅ | ✅ | ✅ | ✅ | ✅ |

- **Mobile target:** the notification loading modal. It imports the legacy text and icon default exports with named enums, alongside the MMDS `Button`. It is unchanged on today's `main`.
  - This step migrates text only. MMDS `Text` and its variant enum come from the platform package. The legacy icon default export and its enums keep their plain names, because the file does not import an MMDS icon in this step (base trigger, `skill.md:147-149`).
  - The overlay's placeholder example (`:120-126`) maps onto a default export plus named enums.
  - Both legacy implementations carry one `@deprecated` tag in source. The overlay's "apply the base Deprecated APIs rule to it" (`:29-30`) points the same way as the migration.
- **Extension target:** the funding-method row. It imports legacy `Box` and `Text` from the legacy library, layout and text enums from the legacy constants module, and an MMDS icon.
  - The overlay names no module now. It says the two come from different modules and to search the repo. The target file's own imports show both, and across the repo, 269 files import the legacy text enum from the same constants module. So the module is found from evidence, not from a skill path (ISS-009 stays fixed, ISS-020 fixed).
  - Decision: alias the legacy text variant and color enums `Legacy*`, because the platform index exports both names. Keep the legacy display, flex-direction, and align-items enums on plain names, because the platform exports only `Box`-prefixed layout enums, which do not clash (checked in `dist/components/index.d.cts`).
  - That is the overlay's Do example (`:80-88`) exactly.

### Scenario 4 — Review checklist

**Mobile — Partial** (ISS-018)

| No MCP | Types | Manifest | Overlay | No pin |
| --- | --- | --- | --- | --- |
| ✅ | ✅ | ✅ | ✅ | ✅ |

Same invented fee-sheet patch as the last run, plus one new case.

| # | Planted violation | Caught? | Rule / evidence |
| --- | --- | --- | --- |
| 1 | Imports a button variant component that is in the manifest but not exported | ✅ | Reference export-index check; ISS-022 |
| 2 | Platform scroll container inside the design-system bottom sheet comes from React Native | ✅ | Overlay "Sheets" `:78-80` |
| 3 | `StyleSheet.create` with hard-coded padding and radius | ✅ | Overlay `:46-47`; base `skill.md:126-129` |
| 4 | Hand-set font size on `Text` | ✅ | Base Typography |
| 5 | Pressed-state `style` function on the base button | ✅ | Overlay `:51-55` |
| 6 | An icon-only button with no label and a no-op press | ✅ | Base accessibility list |
| 7 | Sheet with no header part; back calls confirm | ✅ | Overlay "Sheets"; base trust rules |
| 8 | Deprecated button-family component for the primary call-to-action | ✅ **(was ❌)** | Review workflow, Deprecated APIs grep; the replacement is exported, so the fix is named |
| 9 | Body copy set in the hero font family | ❌ | ISS-018 |
| 10 | A hand-built pressable row where the MMDS list item covers the need, with no recorded reason | ✅ | Base `skill.md:78` and `:82-85` |
| 11 | **New:** new usage of a deprecated component "because the repo already uses it" | ✅ | Base `skill.md:107-108`: "even if the repository still uses the deprecated one" |

**Extension — Partial** (ISS-018)

| No MCP | Types | Manifest | Overlay | No pin |
| --- | --- | --- | --- | --- |
| ✅ | ✅ | ✅ | ✅ | ✅ |

Same invented token-search-row patch as the last run, plus one new case.

| # | Planted violation | Caught? | Rule / evidence |
| --- | --- | --- | --- |
| 1 | `Legacy` prefix on the MMDS import, legacy on plain names | ✅ | Overlay Do / Don't `:80-92` |
| 2 | An icon-only control without its required accessible-name prop | ✅ | Overlay `:56-58`; installed type requires it |
| 3 | Search field without its accessible-name prop | ✅ | Overlay `:56-58` |
| 4 | Arbitrary values and default-palette classes | ✅ | Base Foundations; overlay `:40-43` |
| 5 | New SCSS import | ✅ | Overlay `:49` |
| 6 | New legacy `Text` usage with a legacy variant enum | ✅ | Overlay `:26-28` and checklist `:109-110` (path-free now) |
| 7 | "No results" status not announced | ✅ | Overlay `:59-61` |
| 8 | Hard-coded English strings | ✅ | `mms-content-guidelines` is installed on Extension |
| 9 | Deprecated button-family component | ✅ **(was ❌)** | Deprecated APIs grep |
| 10 | Body copy in the hero font family | ❌ | ISS-018 |
| 11 | A clickable `div` row built from scratch, with no recorded reason | ✅ | Base `skill.md:78`; overlay `:64-67` |
| 12 | **New:** new usage of the deprecated component whose replacement is not exported on React | ✅ flagged; ⚠️ fix not stated | Base `skill.md:105-109`; ISS-024 |

## Install smoke

```bash
# combined = main + #242 + #212 + #213 (merge commits built with git merge-tree)
./tools/install --repo metamask-mobile    --target <mobile copy> --domain ui  # exit 0
./tools/install --repo metamask-extension --target <ext copy>    --domain ui  # exit 0
```

The same installs were run from `main`, from #242 alone, and from each PR branch alone into both consumers; all exited 0.

| Check | Mobile | Extension |
| --- | --- | --- |
| Targets written | `.claude/skills/`, `.agents/skills/`, `.cursor/rules/` | same |
| Merged file = shared base + thin overlay | ✅ 353 lines; overlay heading at line 218 in all three targets | ✅ 325 lines; overlay heading at line 218 in all three targets |
| Cursor rule body identical to the Claude skill body | ✅ | ✅ |
| `references/reading-mmds-manifests.md` and `knowledge/` copied | ✅ | ✅ |
| Relative links resolve (`ui-development`, `component-scaffold`) | ✅ | ✅ |
| One Deprecated APIs section | ✅ | ✅ |
| `docs/ai-agents.md` or `AGENTS.md` links | ✅ 0 | ✅ 0 |
| Tailwind major-version pin | ✅ 0 | ✅ 0 (was 1 on `main`) |
| MMDS version pins | ✅ 0 (only numeric match is the WCAG criterion) | ✅ 0 |
| MCP mentions | ✅ only "None of these needs an MCP server" (and the optional Figma source) | ✅ same |
| README links at the installed per-package tag | ✅ 200 (`README.md`) | ✅ 200 (`README.mdx`) |
| `yarn audit:skills` | 0 errors, 128 warnings (`main`: 130). `ui-development` has no warnings; the 2 `component-scaffold` warnings are pre-existing. Same on #242, #212, and #213 heads. | same |
| `yarn test` / `yarn lint` on the combined tree | 77/77 pass / pass | same |

### MMSkills content rules (combined install)

| Rule | Mobile `ui-development` | Mobile scaffold | Extension `ui-development` |
| --- | --- | --- | --- |
| No component names except `Box`, `Button`, `Text` | ✅ No other exported MMDS name in backticks or as a component reference. an icon-only phrase appears as a prose adjective (`skill.md:166`). React Native core primitives appear in Mobile mechanics, as before. | ✅ MMDS names only `Box`, `Button`, `Text`; real app component names at `:18`, `:162-165` (ISS-023) | ✅ icon-only phrase as prose (overlay `:56`) |
| No hardcoded enums | ✅ none (`<Enum>.<Member>` scan returns 0) | ✅ | ✅ |
| No version pins | ✅ | ✅ | ✅ |
| No MCP-server setup or workflow guidance | ✅ | ✅ ("No MCP server is needed.") | ✅ |
| No app folder paths | ✅ 0 | ⚠️ accepted: placement `:12-15`, fence `:174-176`, barrel `:325`. Not accepted: `:162` (ISS-023). For maintainers: i18n `:149`, `:154`. | ✅ 0 |
| READMEs from GitHub at the installed tag | ✅ base `:56-62`, overlay `:23-26` | ✅ `:59-65` | ✅ overlay `:22-25` |

Exported-name scan: every name exported by the installed React Native and React indexes, except `Box`, `Button`, and `Text`, was matched as a whole word against each installed file. The only hits were prose and test strings: the capitalised start of an icon-only phrase, and one common English word in JSDoc and test fixture text.

### A/B contrast with `main`

- **Mobile:** `main` installs a 440-line file with the old inventory overlay and the "LAST RESORT … StyleSheet" line. The stack installs 353 lines that rely on the manifest, installed types, and READMEs at the tag. Deprecations are now found reliably.
- **Extension:** `main` installs a 164-line file built around a required MCP workflow, with a Tailwind major-version pin. The stack installs 325 lines with no MCP dependency, and nothing in this run needed one.

## What should change (for the stack authors)

These are eval findings only; nothing on #242, #212, or #213 was edited.

1. **ISS-003 (process)**: merge #242, #212, and #213 back to back; never leave `main` with #242 alone.
2. **ISS-018 (base Typography, `skill.md:135-143`)**: inline one enum-free sentence on when the hero family applies, marked as Proposed guidance.
3. **ISS-023 (Mobile scaffold `:162-165`, `:18`)**: replace the real app file and component names with placeholders.
4. **ISS-024, ISS-025, ISS-026, ISS-027, ISS-019, ISS-021, ISS-022**: one-line wording fixes; none blocks.

Resolved since the last run: **ISS-010** (skill side), **ISS-014**, **ISS-016**, **ISS-017**, **ISS-020**.
