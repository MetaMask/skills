# UI development skills reshape eval — 2026-11-11

This is the third run of the ui-development reshape eval. The [first run](ui-development-reshape-2026-11-05.md) and the [re-run](ui-development-reshape-2026-11-05-rerun.md) are historical and left unchanged. This run uses the same method against the current skill heads and the new hosted component manifests.

PRs: [#212](https://github.com/MetaMask/skills/pull/212) (Mobile), [#213](https://github.com/MetaMask/skills/pull/213) (Extension)
Agent: Cursor cloud agent, eval branch `cursor/ui-development-reshape-eval-682b`

Write-up constraints for this doc: it names no components except `Box`, `Button`, and `Text`. It quotes no enum values, no MMDS release numbers, and no consumer app folder paths. Where the skills themselves break those rules, the doc reports it as a finding without repeating the offending text.

## Heads used

| Item | Commit | Notes |
| --- | --- | --- |
| #212 `cursor/mmds-mobile-skills-refresh-7309` | **`0a64f0da20fb9eefa50a09bec2a7f568ed0f2e1a`** | Final head for every result below. One commit on top of `1a080abc3dc21eeedcc6cbff41b5b80a136da383` (the first head this run used): "stop sending agents to pattern stories in the manifest". |
| #213 `cursor/mmds-extension-skills-no-storybook-mcp-7309` | **`ce7ef8084d9245e9fe873394746d33a2c5a08500`** | Final head for every result below. One commit on top of `65f807ce8ada6a29f94c35df5c5476247125e8f5` (the first head this run used), with the same subject. |
| skills `main` (A/B baseline) | `a926dbdc16f39dbbac5bdc68c227d56c802a4d36` | Includes #221, which adds an Extension `content-guidelines` overlay. |
| metamask-mobile `main` | `c28aed88` | Shallow clone, 2026-11-11. |
| metamask-extension `main` | `93f6c52` | Shallow clone, 2026-11-11. |

Any follow-up commit on the PR branches after these SHAs is not covered here.

The follow-up commits change only the pattern guidance:
- In the base `skill.md` ("Choosing a component", first bullet), the shared text is identical on both branches.
- In each overlay, the change is one bullet in "Packages and paths".

I first ran the eval on the earlier heads and found ISS-015. After the fix landed, I reinstalled from the final heads into fresh consumer copies (same tarballs) and re-ran every scenario that touches that guidance: scenario 1 (the edited bullet is its lookup rule), 2 (restyle, where custom composition is considered), and 4 (review), plus install smoke. Scenario 3 does not read the edited lines; its results carry over unchanged.

The shared files are byte-identical on both PR heads: `skill.md`, `references/reading-mmds-manifests.md`, and `knowledge/agentic-design-system-strategy.md`.

Installed types come from the npm tarballs at each consumer's lockfile pins: the platform package, `design-system-shared`, the Tailwind or twrnc preset, and `design-tokens`. Both consumers bumped their MMDS pins since the 5 Nov runs. Read the exact versions from the consumer lockfiles at the commits above. No MCP server was configured or used.

Manifests (fetched 2026-11-11):

| Manifest | HTTP | Size | Entries | Prop key |
| --- | --- | --- | --- | --- |
| React `manifests/components.json` | 200 | 1.35 MB | 53 | `reactDocgenTypescript` (53/53), `meta.docgen: "react-docgen-typescript"` |
| React Native `react-native/manifests/components.json` | 200 | 2.11 MB | 84 | `reactDocgenTypescript` (84/84), same `meta.docgen` |
| React `manifests/docs.json` | 200 | 4 KB | 4 docs | intro pages only |
| React Native `react-native/manifests/docs.json` | 404 | — | — | — |

Every manifest entry has a `path` under the platform package's `src/components/`. No entry has an old `reactDocgen` key or an `error` key. Neither manifest contains `patterns-`, `design-tokens-`, or `docs-` ids, and every `name` is a plain identifier.

## Summary

| Scenario | Mobile (#212) | Extension (#213) |
| --- | --- | --- |
| 1. Types win over manifest | Partial (ISS-014) | Partial (ISS-014) |
| 2. Restyle with foundations | Pass | Pass |
| 3. Legacy* migration | Pass | Pass (ISS-020 tension) |
| 4. Review checklist | Partial (ISS-014, ISS-018) | Partial (ISS-014, ISS-018) |
| Install smoke | Pass | Pass |

Rubric across all eight runs:

- No run depended on an MCP server.
- Installed types were read before choosing anything.
- The matching hosted manifest was used for discovery only.
- No guidance I followed pins an MMDS version.
- The overlays were followed everywhere. In the two Partial scenarios, following them literally misses something; that is a gap, not a deviation.

What still fails on the final heads, in one line each:

1. **Deprecation detection (ISS-014, major).** The new manifests carry no deprecation tags, so an empty `jsDocTags` no longer means "not deprecated". The skill still treats it as a signal, and it sends agents to the `.types` file, where the installed packages put no `@deprecated` tags. Two deprecated components per platform slip through a literal reading.
2. **Hero font family policy (ISS-018, minor).** The skill defers the policy to the manifest and the README, and neither contains one, so review can't flag hero type misused on body text.
3. **MMSkills rules in the overlays (ISS-020, minor).** Both overlays still contain consumer app folder paths. The pattern fix added none.

**Fixed during this run: ISS-015 (major).** On the earlier heads, the base and both overlays said "search the manifest for an existing pattern", which contradicted the reference and the manifests. On the final heads, all four places agree: pattern, foundation, and design-token stories are not in the manifest; read the component README at the installed tag and search repository usage before building custom UI.

Merge verdict from an agent-eval perspective: **not ready yet. Fix ISS-014 first, then merge #212 and #213 together, back to back (ISS-003).** The fix is a text edit to the shared `skill.md` and `reading-mmds-manifests.md`. Everything else can follow up.

## Issue status (carried over)

| Issue | Severity | Status on these heads | Evidence this run |
| --- | --- | --- | --- |
| ISS-001 | note | Open (method) | Tarballs at lockfile pins again; no full app install, so no type-check of the proposals. |
| ISS-002 | minor | Fixed | No relative link outside the skill folder; `references/reading-mmds-manifests.md` resolves in all three install targets on both platforms. |
| ISS-003 | major | **Open** | #212 alone into Extension: 360 lines (final head), the old `main` overlay's required MCP-server workflow (three mentions). #213 alone into Mobile: 636 lines (final head), the old "LAST RESORT … StyleSheet" line. Both merge orders onto `main` are conflict-free. |
| ISS-004 | minor | Fixed, then superseded | The new manifests drop pattern, token, and foundation stories. The reference's "Treat an entry as a component only when its `path` is … `src/components/` … and the name is in the installed export index" matches every entry. |
| ISS-005 | minor | Fixed | Base keeps "Use the replacement the JSDoc names if the installed platform package exports it." See ISS-014 for where the JSDoc tag now has to be found. |
| ISS-006 | minor | Fixed | Extension: "Do not add SASS or SCSS. Deleting SCSS rules, files, and `@import` lines that your change makes unused is expected." |
| ISS-007 | note | Fixed | Mobile: the `useStyles` + `*.styles.ts` conversion bullet, and the list-row bullet saying the interactive mode applies the pressed background itself. |
| ISS-008 | minor | Fixed | Extension: native button or link (for example via `Box` `asChild`) with preset state classes; never `onClick` on a `div` or `span`. |
| ISS-009 | major | Fixed | Extension names where legacy enums come from. ISS-020 records that the fix uses an app folder path. |
| ISS-010 | minor | **Half resolved** | Read-only Notion query, 2026-11-11: the `Legacy*` alias rule is now **Active**, so the base's migration section and checklist item enforce an Active rule. The typography rule is still **Proposed** (see ISS-018). This work made no Notion change. |
| ISS-011 | major | Deferred | The evidence-order rule is still **Active** (same query). Its full text was not re-read because the Notion API rate-limited the follow-up query. No Notion change from this work. The skill still says installed types win. |
| ISS-012 | note | Fixed | Base trigger: alias "when a file imports the same name from a legacy source and from the MMDS platform package". |
| ISS-013 | minor | Fixed | Base pointer is qualified, and Extension now gets `mms-content-guidelines` from `main` (#221). |

## Issues (new this run)

### ISS-014 — Deprecations are invisible to a literal reading: the manifest no longer tags them, and the skill sends agents to the wrong installed file
- Platform: Shared (base `skill.md` and `reading-mmds-manifests.md`)
- Scenario: 1 (Types win over manifest), 4 (Review checklist)
- Severity: major
- Expected: An agent that follows the skill finds out a component is deprecated before it adds new usage.
- Actual:
  - **Manifest.** `jsDocTags` is `{}` on all 53 React and all 84 React Native entries. Two button-family components are `@deprecated` both on MMDS `main` and in the installed types, on both platforms. They are in the manifests with empty `jsDocTags`. The React Native entry's docgen description for one of them presents it as the button for "primary marketing and call-to-action use cases". The reference still says "An entry without a `deprecated` key is not deprecated in `main`", which is now false.
  - **Installed types.** The base says a component is deprecated "when its installed type carries `@deprecated`". The reference says "check for `@deprecated` in the installed `.types` file". In both installed platform packages, `grep -rl @deprecated dist/components --include=*.types.d.cts` returns nothing. The tags sit on the component declaration (`dist/components/<Name>/<Name>.d.cts`).
  - **Result.** An agent that checks the manifest and the `.types` file, exactly as written, concludes both components are fine and recommends one for a call-to-action.
- Evidence: `jq '[.components[]|select(.jsDocTags.deprecated)]|length'` returns `0` on both manifests. `grep -rl "@deprecated" dist/components --include=*.d.cts` lists two component `.d.cts` files per package and no `.types.d.cts`. The MMDS `main` source for the same component still carries the `@deprecated` JSDoc.
- Suggested fix (skills):
  - Base "Choosing a component": a component, prop, or enum value is deprecated when `@deprecated` appears anywhere in its installed declarations (`grep -rn @deprecated node_modules/<platform package>/dist/components/<Name>/`).
  - Reference "Common queries" and "Caveats": replace "An entry without a `deprecated` key is not deprecated in `main`" with "`jsDocTags` can be empty even for deprecated components; its absence is not evidence. The installed declarations decide." Keep `jsDocTags.deprecated` only as a positive signal.
  - Separately, report to MMDS that the react-docgen-typescript manifest drops component-level JSDoc tags.

### ISS-015 — Base and both overlays say "search the manifest for an existing pattern", but pattern stories are not in the manifest
- Platform: Shared, Mobile, Extension
- Scenario: 2 (Restyle with foundations), 4 (Review checklist)
- Severity: major
- Status: **Fixed** at #212 `0a64f0d` / #213 `ce7ef80`. The text below describes the earlier heads (`1a080ab` / `65f807c`).
  - Base, new wording: "Pattern, foundation, and design-token stories are not in the manifest. Read the component README at the installed tag, and search existing repository usage, before building custom UI."
  - Each overlay's bullet now says the same thing.
  - `grep -ci 'search the manifest for an existing pattern'` returns `0` in all six installed files.
  - Re-run evidence: scenarios 2 and 4 below.
  - Optional follow-up: the fix does not point at the MMDS repository's pattern story files on GitHub. The README-and-repo-usage route was enough for both scenario targets.
- Expected: One consistent instruction for finding an existing pattern before building custom UI.
- Actual:
  - Base "Choosing a component" says: "Search the manifest for an existing pattern before building custom UI."
  - The Mobile and Extension overlays repeat it in "Packages and paths".
  - The reference says the opposite, correctly: "Pattern stories are not in this manifest. Read the component README at the installed tag, and search existing repository usage", and "a missing entry is not proof that no story exists".
  - The live manifests confirm the reference: no `patterns-` ids on either platform. The MMDS repository still has pattern story files for both platforms (three for React Native, three for React plus an intro page), next to each Storybook build's stories.
  - An agent that follows the base, the first instruction it reads, searches the manifest, finds nothing, and proceeds to custom UI. Hierarchy step 4 then applies when steps 1–3 might have covered the need.
- Evidence: base `skill.md` "Choosing a component" first bullet; Mobile and Extension overlay "Packages and paths" last bullets; reference "Which props appear" last paragraph and "Common queries"; `jq -r '.components|keys[]' <manifest> | grep -c '^patterns'` returns `0` on both.
- Suggested fix (skills): In the base and both overlays, replace the sentence with "Pattern stories are not in the manifest. Before building custom UI, read the pattern story sources in the MMDS repository on GitHub, the component README at the installed tag, and existing repository usage." Add the same pointer to the reference's "Is there already a pattern?" query. Those pattern files are not versioned per package, so add: "They track MMDS `main`; installed types still win."

### ISS-016 — Reference says `className`, `style`, `children`, and `testID` are "always kept"; that is platform-specific
- Platform: Shared (reference)
- Scenario: 1 (Types win over manifest)
- Severity: minor
- Expected: The kept-props list matches each manifest.
- Actual:
  - React: `className` 52/53, `style` 52/53, `children` 45/53, `testID` 0/53. `data-testid` appears on 18/53 entries, but only where a component declares it.
  - React Native: `style` 81/84, `testID` 81/84, `children` 52/84, `className` 0/84. `twClassName` appears on 76/84.
  - An agent that reads "always kept" and finds no `testID` on a React entry may wrongly conclude the component rejects test ids.
- Evidence: `jq --arg p <prop> '[.components[]|select(.reactDocgenTypescript.props[$p])]|length'` on both manifests.
- Suggested fix (skills): "React keeps `className`, `style`, and `children`; React Native keeps `style`, `testID`, and `children`. Other host props are filtered. Check the installed types for anything inherited, including test-id props."

### ISS-017 — `docs.json` is mentioned with no guidance on what it is for
- Platform: Shared (reference)
- Scenario: 1 (Types win over manifest)
- Severity: note
- Expected: If the reference names `docs.json`, it says when to read it.
- Actual: The reference says React publishes `manifests/docs.json` and React Native does not (confirmed: 200 and 404). The file holds four intro pages: getting started, design tokens, color, and components. Their `content` is mostly MDX that imports a README. It is not a component or pattern source, but an agent may fetch it expecting one.
- Evidence: `jq -c '.docs|to_entries[]|{k:.key,title:.value.title}' docs.json`.
- Suggested fix (skills): One sentence: "`docs.json` holds the React Storybook intro pages only; it is not a component or pattern index." Or drop the mention.

### ISS-018 — Font family choice now defers to sources that hold no usage policy
- Platform: Shared (base "Typography")
- Scenario: 4 (Review checklist)
- Severity: minor
- Expected: Either the skill gives (or links) the rule for when the hero font family applies, or a source it defers to does.
- Actual:
  - The base says: "Use the font family and variant options the installed types expose, and follow the hosted manifest and the component README at the installed tag for when each applies."
  - The `Text` font-family prop description in both manifests names the faces, but not when to use them.
  - The React Native `Text` README at the installed tag does not mention the hero family.
  - The React `Text` README describes what the hero family renders, but not when to use it.
  - The checklist item "Typography uses the design-system text component and the font family and variant options from the installed types" therefore passes a patch that sets body copy in the hero family. The 5 Nov base caught this; this one does not.
  - The Design Brain typography rule is still Proposed (ISS-010; the `Legacy*` half of that issue is now Active). The base links it only for amount inputs.
- Evidence: `jq '.components[]|select(.name=="Text")|.reactDocgenTypescript.props.fontFamily.description'` on both manifests; `curl` of both `Text` READMEs at the per-package tags (both 200).
- Suggested fix (skills): Link the Proposed Design Brain typography rule as guidance for every font-family choice, not just amount inputs, and say so in the checklist ("hero family use follows the linked Proposed rule; flag it as guidance"). Longer term, ask MMDS to put the usage policy in the `Text` README so the "README at the installed tag" source actually carries it.

### ISS-019 — Mobile overlay says to read the `Text` default accessibility role from the installed types; it is only in the implementation
- Platform: Mobile
- Scenario: 4 (Review checklist)
- Severity: note
- Expected: The pointer leads to where the default is declared.
- Actual: "Check the default role on the MMDS `Text` component's installed types instead of assuming one." `dist/components/Text/Text.types.d.cts` declares no default. The default is set in `dist/components/Text/Text.mjs`.
- Evidence: `grep -n accessibilityRole dist/components/Text/Text.mjs dist/components/Text/Text.types.d.cts` matches only the `.mjs`.
- Suggested fix (skills): "…on the installed component (`dist/components/<Name>/<Name>.mjs` when the types do not state a default)."

### ISS-020 — Overlays still contain consumer app folder paths (MMSkills rule)
- Platform: Mobile, Extension
- Scenario: 3 (Legacy* migration), Install smoke
- Severity: minor
- Expected: Skill text follows the MMSkills rules: no consumer app folder paths, and no component names except `Box`, `Button`, `Text`.
- Actual:
  - Mobile overlay: two app folder paths, the product UI root in "Packages and paths" and the toaster host in "Sheets". It also names three React Native core primitives in backticks in the styling, sheet, and accessibility bullets. Those are platform primitives, not MMDS components; maintainers should confirm whether the rule covers them.
  - Extension overlay: three distinct app folder paths in five places: the legacy library barrel (three times), the feature UI root, and the legacy enum constants module.
  - The enum-module path is the ISS-009 fix, so removing it naively reintroduces ISS-009.
  - The base is clean: no app paths, and no component names beyond `Box`, `Text`, and the placeholder `Component`.
- Evidence: `grep -noE '\`(app|ui)/[^\`]*\`'` on each installed `SKILL.md` gives 2 Mobile and 5 Extension matches, on both the earlier and the final heads. The pattern fix kept the existing paths in the edited bullets and added none.
- Suggested fix (skills): Use the approach the Mobile legacy section already takes: "search the repo for the existing import". For example:
  - "Legacy enums usually come from a separate constants module, not the legacy library barrel. Find it from the file's existing imports, and alias only names MMDS also exports."
  - "The app mounts a single design-system toaster. Find it before adding one."
  - "Product UI lives in the app's components tree. Search it for existing usage."

### ISS-021 — Mobile overlay blurs the legacy component library with feature components
- Platform: Mobile
- Scenario: 3 (Legacy* migration)
- Severity: note
- Expected: The overlay keeps the base hierarchy's distinction: step 2 is the legacy component library (non-deprecated only), and step 3 is existing feature components.
- Actual:
  - "Packages and paths" has one bullet, "Existing app-level components: use one only when [MMDS] has no equivalent … Never use anything marked `@deprecated`; those have MMDS equivalents."
  - "Incremental migration paths" opens with "Legacy app-level components have no single barrel."
  - Both legacy library and feature components are called "app-level components", so the overlay never says which one is the legacy library that `Legacy*` aliases apply to.
  - In this run the Mobile legacy text and icon components are `@deprecated` in source, so the outcome (migrate to MMDS) was still correct.
- Evidence: Mobile overlay "Packages and paths" and "Incremental migration paths"; `grep -c @deprecated` returns `1` on each legacy text and icon implementation used in scenario 3.
- Suggested fix (skills): Say "legacy component-library components" in the migration section and "feature components" in the hierarchy bullet, matching base steps 2 and 3, without adding paths.

### ISS-022 — Component folders in `dist/` are not proof of export
- Platform: Shared
- Scenario: 1 (Types win over manifest)
- Severity: note
- Expected: The skill warns that only the export index counts.
- Actual: The manifests list three button variant components on both platforms. On Mobile, their folders now ship under `dist/components/<button>/variants/`, but neither the package entry index nor the `exports` map (`"."` and `"./package.json"` only) exposes them. On Extension they do not ship at all. The base's "confirm the name is exported by the installed package index" handles this correctly. An agent that greps `dist/` instead would wrongly import them through a deep path, which the base also forbids. So this is a pass, but a fragile one.
- Evidence: `jq '.exports|keys' package.json`; `grep -c <variant> dist/components/index.d.cts` returns `0`; `ls dist/components/<button>/variants` (Mobile).
- Suggested fix (skills): Add to the base: "A folder under `dist/components/` is not an export. Only names in the export index (and the package `exports` map) are importable."

## Scenario results

All results are for the final heads (#212 `0a64f0d`, #213 `ce7ef80`). Scenarios 1, 2, and 4 were re-run after the pattern fix; scenario 3 carries over from the earlier heads because it reads none of the edited lines.

Method (unchanged): work as an agent with only the installed `mms-ui-development` skill, the installed types, the hosted manifests, and GitHub READMEs at the installed per-package tags. Follow "Sources, in order" and the Create or Review workflow. Targets are the same consumer files as on 5 Nov, all unchanged on today's consumer `main`; they are described here by role, not path.

Rubric columns: **No MCP** = no dependency on any MCP server · **Types** = checked installed types before inventing · **Manifest** = used the correct hosted manifest for discovery only · **Overlay** = followed the platform overlay · **No pin** = no hard-coded MMDS version in the guidance followed.

### Scenario 1 — Types win over manifest

**Mobile (#212) — Partial**

| No MCP | Types | Manifest | Overlay | No pin |
| --- | --- | --- | --- | --- |
| ✅ | ⚠️ ISS-014 | ✅ React Native manifest | ✅ | ✅ |

- Export probe (pass): the only manifest components not in the installed export index are three button variant components. Refused. Use `Button` with the variant prop, whose members come from the installed variant enum (read from `design-system-shared`'s `Button` types). Their folders ship in `dist/` but are not exported (ISS-022).
- Prop probe (pass): every `reactDocgenTypescript.props` key on every manifest entry is declared in the installed component or shared types. Named-enum `type.value` members match the installed enums; 42 enums checked. Manifest and installed versions are now close, so props can't catch the "manifest is ahead" case this time; the export probe still does.
- Deprecation probe (fail on literal reading): two button-family components are deprecated in the installed declarations, but the manifest's `jsDocTags` is empty and the `.types` files carry no tag (ISS-014). Following the skill as written, the agent does not see the deprecation.
- Re-run on the final heads: the edited bullet still starts "look up the component by name in the manifest and the installed exports". The deprecation bullet is unchanged. All three probes give the same result.

**Extension (#213) — Partial**

| No MCP | Types | Manifest | Overlay | No pin |
| --- | --- | --- | --- | --- |
| ✅ | ⚠️ ISS-014 | ✅ React manifest | ✅ | ✅ |

- Export probe (pass): the same three button variant components are in the React manifest and absent from the installed export index. They are not in the tarball at all. Refused; use `Button` with the variant prop.
- Prop probe (pass): no manifest prop is missing from the installed types; 44 named enums checked. The search-field accessible-name prop that was manifest-only on 5 Nov is now required in the installed types, and the overlay's "use the accessible-name or label prop declared on its types" leads straight to it.
- Deprecation probe (fail on literal reading): same as Mobile (ISS-014). One of the two components is deprecated toward a replacement this platform does not export. The base rule (keep existing usage, record the gap) would handle that correctly, but only once the agent finds the tag.
- Re-run on the final heads: same result as Mobile.

### Scenario 2 — Restyle with foundations

**Mobile (#212) — Pass**

| No MCP | Types | Manifest | Overlay | No pin |
| --- | --- | --- | --- | --- |
| ✅ | ✅ | ✅ | ✅ | ✅ |

Target: a Ramp menu row that pairs a one-rule `StyleSheet.create` styles file with a legacy select-row wrapper.

- The overlay's role-based wording ("the design-system list item component exposes an interactive mode … applies the pressed background itself") led to the right export by searching the installed index. The installed implementation applies the pressed background when interactive, so the proposal adds no pressed class.
- The proposal is the same as before. Replace the legacy wrapper with the MMDS list item in interactive mode. Pass the icon as the start accessory and title/description as props. Map the styles file's vertical padding to a `twClassName` on the 4px scale. Delete the styles file and the `useStyles` call, as the overlay's conversion bullet says.
- `Box` utility props were not needed. The overlay's "either `Box` utility props or `twClassName` is fine" left the choice open without ambiguity.
- Re-run on the final heads, with the pattern guidance: the target has an MMDS equivalent, so no custom UI is built. The new route (README at the installed tag) still helps. The React Native list item README at the installed per-package tag returns 200 and documents the interactive pressed tint. That confirms "do not add the pressed class" from a second source, not just the implementation.

**Extension (#213) — Pass**

| No MCP | Types | Manifest | Overlay | No pin |
| --- | --- | --- | --- | --- |
| ✅ | ✅ | ✅ | ✅ | ✅ |

Target: a funding-method row built on the legacy `Box` with `onClick`, plus a hover rule in its own SCSS file.

- The proposal uses MMDS `Box` with `asChild` (declared in the installed `Box` types) around a native `<button type="button">`. Layout uses `Box` utility props. `className="w-full text-left hover:bg-hover active:bg-pressed"`, and both state classes are generated by the installed Tailwind preset. Text uses MMDS `Text` with variant and color enums from the platform package.
- Cleanup: delete the SCSS file and its `@import` line in the parent stylesheet. The overlay now says this is expected, and the checklist item "SCSS made unused by the change is deleted" passes.
- The Tailwind config still removes the default palette and font sizes, so the overlay's "font-size utilities do not exist in this config" holds.
- Re-run on the final heads, with the pattern guidance. This is the one target where the agent composes UI, because the React package has no list row component. The new wording sends it to:
  - The `Box` README at the installed per-package tag. It returns 200 and documents `asChild`, including an `asChild` example.
  - Existing repository usage. Eight files compose `Box asChild`, one of them around a native button, and 38 files use `hover:bg-hover`.

  That is enough evidence to record the reason for composing ("no React list-row component; composed per existing repo usage and the `Box` README"), as hierarchy step 4 requires. On the earlier heads the base sent the agent to a manifest search that returns nothing for patterns. The answer was the same, but the recorded reason was weaker.

### Scenario 3 — Legacy* migration

**Mobile (#212) — Pass** (notes ISS-020, ISS-021)

| No MCP | Types | Manifest | Overlay | No pin |
| --- | --- | --- | --- | --- |
| ✅ | ✅ | ✅ | ✅ | ✅ |

Target: a notification loading modal that imports the legacy text and icon components (default exports with named enums) alongside the MMDS `Button`.

- This step migrates text only: MMDS `Text` and its variant enum come from the platform package. The legacy icon default export and its enums keep their plain names, because the file does not import an MMDS icon in this step (base trigger: "the same name from a legacy source and from the MMDS platform package").
- The overlay's placeholder example (`Component` / `EnumName` / `LegacyComponent`) maps directly onto a default export plus named enums.
- Both legacy implementations are `@deprecated` in source, so the overlay's "Never use anything marked `@deprecated`" points the same way as the migration.

**Extension (#213) — Pass** (ISS-020 tension)

| No MCP | Types | Manifest | Overlay | No pin |
| --- | --- | --- | --- | --- |
| ✅ | ✅ | ✅ | ✅ | ✅ |

Target: the same funding-method row (legacy `Box` and `Text`, with layout and typography enums from the legacy constants module).

- This step migrates text only. MMDS `Text` plus its variant and color enums come from the platform package. The legacy constants module's variant and color enums are aliased with the `Legacy` prefix, because the platform package exports enums with those names and the file imports both. The legacy display, flex-direction, and align-items enums keep their names, because the platform package exports no enums with those names (checked in the installed index).
- The overlay's Do example shows exactly this shape.
- The overlay found the enum module by naming its app path, which ISS-020 flags under the MMSkills rules.

### Scenario 4 — Review checklist

**Mobile (#212) — Partial**

| No MCP | Types | Manifest | Overlay | No pin |
| --- | --- | --- | --- | --- |
| ✅ | ⚠️ ISS-014 | ✅ | ✅ | ✅ |

Invented new-file patch (a fee sheet). It repeats the 5 Nov violations and adds two:

| # | Planted violation | Caught by the skill as written? | Rule / evidence |
| --- | --- | --- | --- |
| 1 | Imports a button variant component that is in the manifest but not exported | ✅ | Base "confirm … installed export index"; ISS-022 |
| 2 | Platform scroll container inside the design-system bottom sheet comes from React Native, not gesture-handler | ✅ | Overlay "Sheets" |
| 3 | `StyleSheet.create` with hard-coded padding and radius numbers | ✅ | Overlay "Styling surface"; base "Never hard-code numbers such as `borderRadius: 16`" |
| 4 | Hand-set font size on `Text` | ✅ | Base "Typography" |
| 5 | Pressed-state `style` function on the base button | ✅ | Overlay pressed-state bullet; installed `style` is a plain style prop |
| 6 | An icon-only button with no label and a no-op press | ✅ | Base accessibility list |
| 7 | Sheet with no header part; back calls confirm | ✅ | Overlay "Sheets"; base trust rules |
| 8 | **New:** uses a deprecated button-family component for the primary call-to-action | ❌ | Manifest `jsDocTags` empty; installed `.types` file has no tag (ISS-014) |
| 9 | **New:** body copy set in the hero font family | ❌ | The checklist passes any installed font family (ISS-018) |
| 10 | **New (re-run):** a hand-built pressable row where the MMDS list item covers the need, with no recorded reason | ✅ | Base "Custom UI without a recorded reason is a finding"; the new pattern wording sends the reviewer to the list item README at the installed tag, which documents the interactive row. On the earlier heads the base also sent it to a manifest pattern search that cannot succeed. |

**Extension (#213) — Partial**

| No MCP | Types | Manifest | Overlay | No pin |
| --- | --- | --- | --- | --- |
| ✅ | ⚠️ ISS-014 | ✅ | ✅ | ✅ |

Invented new-file patch (a token search row). It repeats the 5 Nov violations and adds the same two:

| # | Planted violation | Caught by the skill as written? | Rule / evidence |
| --- | --- | --- | --- |
| 1 | `Legacy` prefix on the MMDS import, legacy on plain names | ✅ | Overlay Do / Don't |
| 2 | An icon-only control without its required accessible-name prop | ✅ | Overlay accessibility mechanics; installed type requires it |
| 3 | Search field without its accessible-name prop | ✅ | Overlay "use the accessible-name or label prop declared on its types"; installed type requires it |
| 4 | Arbitrary values and default-palette classes | ✅ | Base "Foundations"; overlay "Styling surface" |
| 5 | New SCSS import | ✅ | Overlay "Do not add SASS or SCSS" |
| 6 | New legacy `Text` usage with a legacy variant enum | ✅ | Overlay checklist; enum-module paragraph |
| 7 | "No results" status not announced | ✅ | Overlay live-region bullet |
| 8 | Hard-coded English strings | ✅ | Out of this skill. `mms-content-guidelines` is now installed on Extension (#221), so the base pointer resolves. |
| 9 | **New:** uses a deprecated button-family component | ❌ | ISS-014 |
| 10 | **New:** body copy in the hero font family | ❌ | ISS-018 |
| 11 | **New (re-run):** a clickable `div` row built from scratch, with no recorded reason | ✅ | Base "Custom UI without a recorded reason is a finding"; overlay "Never put `onClick` on a `div`"; the new pattern wording points at the `Box` README (`asChild`) and existing repo usage as the reason a composed row would need. |

## Install smoke

Final heads, installed into fresh consumer copies:

```bash
git worktree add /tmp/r2/sk-mobile 0a64f0da20fb9eefa50a09bec2a7f568ed0f2e1a
git worktree add /tmp/r2/sk-ext    ce7ef8084d9245e9fe873394746d33a2c5a08500
(cd /tmp/r2/sk-mobile && ./tools/install --repo metamask-mobile    --target /tmp/r2/mm-mobile2 --domain ui)  # exit 0
(cd /tmp/r2/sk-ext    && ./tools/install --repo metamask-extension --target /tmp/r2/mm-ext2    --domain ui)  # exit 0
```

The earlier heads (`1a080ab` / `65f807c`) also installed with exit 0: Mobile had 340 lines with the overlay at line 205, and Extension had 309 lines with the overlay at line 205.

| Check | Mobile (#212) | Extension (#213) |
| --- | --- | --- |
| Installer exit code | 0 | 0 |
| Targets written | `.claude/skills/`, `.agents/skills/`, `.cursor/rules/` | same |
| Merged file = shared base + thin overlay | ✅ 343 lines; overlay heading at line 207 in all three targets | ✅ 313 lines; overlay heading at line 207 in all three targets |
| "search the manifest for an existing pattern" | ✅ 0 in all three targets | ✅ 0 in all three targets |
| `references/reading-mmds-manifests.md` and `knowledge/` copied | ✅ all three targets | ✅ all three targets |
| Relative links resolve | ✅ (only `references/…`; the Strategy link is an absolute URL) | ✅ |
| No `mmds-react*` files | ✅ | ✅ |
| No MMDS version pins in installed text | ✅ (only numeric match is the WCAG criterion number) | ✅ |
| No MCP-server dependency in installed `ui-development`, `component-scaffold`, or `content-guidelines` | ✅ only "None of these needs an MCP server" and "Skills must work with no MCP server connected" | ✅ same |
| Component-README links at the installed per-package tag | ✅ 200 | ✅ 200 (`README.mdx`) |
| `yarn audit:skills` linter on the PR head | 0 errors (warnings only) | 0 errors (warnings only) |
| Cross-PR install (this PR alone, other platform) | ⚠️ ISS-003 | ⚠️ ISS-003 |
| Merge both onto `main`, either order | ✅ conflict-free | ✅ conflict-free |

### A/B contrast with `main`

- **Extension `main`**: still has the required MCP workflow overlay from the 5 Nov baseline. #213 has none, and nothing in this run needed it.
- **Mobile `main`**: still has the long hand-written inventory overlay. #212 is about a third of the size and relies on the manifest plus installed types. That approach worked for exports and props but missed deprecations (ISS-014). The `main` overlay's inline inventory has the same weakness in a different way, since it goes stale.

## What should change in the skills (for #212 / #213 authors)

These are eval findings only; nothing on the PR branches was edited here.

1. **ISS-014 (shared files, blocks the verdict)**: source deprecations from the installed component declarations (grep the component's `dist/` folder), and stop treating an empty `jsDocTags` as "not deprecated".
2. **ISS-018 (base Typography)**: link the Proposed typography rule as guidance for every font-family choice.
3. **ISS-020 (both overlays)**: replace consumer app folder paths with "find it from existing imports" wording, keeping the ISS-009 enum guidance.
4. **ISS-016, ISS-017, ISS-019, ISS-021, ISS-022**: one-line wording fixes in the reference, Mobile overlay, and base.
5. **ISS-003 (unchanged)**: merge #212 and #213 together, back to back.

Done during this run: **ISS-015** (pattern guidance) is fixed at #212 `0a64f0d` / #213 `ce7ef80`. A pointer to the MMDS pattern story files is an optional extra.
