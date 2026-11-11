# UI development reshape eval — stack with the Design Brain source step, 2026-11-12

Fifth agent-driven run of the reshaped `ui/ui-development` skills. It re-runs [`ui-development-reshape-2026-11-11-stack.md`](ui-development-reshape-2026-11-11-stack.md) against the updated stack and adds four checks:
- **(a)** a run without Notion;
- **(b)** a run with read-only Notion;
- **(c)** a token scenario where Tailwind cannot reach the value;
- **(d)** a cross-file check of the new pattern lookup order.

Earlier docs are unchanged; issue numbers carry over.

## Heads

| PR | Head | Base | State |
| --- | --- | --- | --- |
| [#242](https://github.com/MetaMask/skills/pull/242) shared baseline | `2769110616ebc3cd5e9f410ff17076215ff58a71` | `main` @ `161673f` | ready for review |
| [#212](https://github.com/MetaMask/skills/pull/212) Mobile | `e3aa3ba2f7a919ed5bf3d5fc3a1355c786cc5d6c` | #242's branch | draft |
| [#213](https://github.com/MetaMask/skills/pull/213) Extension | `2e4cb388283d9751c50b604ee45c08dfaac3587d` | #242's branch | draft |

Since the last run:
- #242 adds one commit, "query Design Brain instead of copying its rules", on the same `main` base. It touches the base `skill.md`, the manifest reference, and the strategy doc.
- #212 and #213 each merge #242 and add one overlay commit: the token note, and `MIGRATION.md` at the installed tag. #212 also fixes the scaffold import example.
- No PR in the stack touches a `CHANGELOG.md` or `attribution.txt`.

Consumers, design-system package pins, and installed tarballs are the same as the last run (ISS-001). The installed design-tokens package README at its per-package tag returns 200.

## Summary

| Scenario | Mobile | Extension |
| --- | --- | --- |
| 1. Types win over manifest | Pass | Pass |
| 2. Restyle with foundations | Pass | Pass |
| 3. Legacy* migration | Pass | Pass |
| 4. Review checklist, no Notion | Partial (ISS-018, ISS-032) | Partial (ISS-018) |
| 4. Review checklist, read-only Notion | **Pass** | **Pass** (note ISS-030) |
| (c) Token outside Tailwind | Pass | Pass (note ISS-029) |
| (d) Pattern wording across the six installed files | Pass: no contradiction | Pass: no contradiction |

- **(a) Without Notion:** the skill requires "Design Brain not checked" in three places: Sources step 3 (`skill.md:62-63`), the Review workflow (`:85-86`), and the checklist (`:209-210`). The Create workflow reaches it through the checklist. The four-bullet floor (`:169-181`) catches all three requested cases: missing label, icon-only button with no name, and state shown by color alone.
  - The floor no longer catches a no-op icon-only button (ISS-032), and hero-family misuse stays a gap (ISS-018). The required disclosure line makes both gaps visible to the reviewer.
- **(b) With read-only Notion:** querying Lessons & Rules for the changed areas returns an Active rule for every planted accessibility case. Each one is cited with its priority (P0 must / P1 should). The typography rule comes back **Proposed**, so it is reported as guidance, not a failure. No Notion edits were made.
- **(c) Tokens:** on both platforms, the agent replaces a hex value in a chart with a semantic design token, never a hex value or raw palette entry. Mobile reads it through the app theme. Extension reads the CSS variable, and resolves it with computed style when a canvas needs a literal color, which the repo already does.
- **(d) Pattern order:** the Sources list, "Choosing a component", the manifest reference, the strategy doc, and both overlays agree. One reachability gap: the first stop, "Storybook or the manifest docs", has no MCP-free route written down (ISS-028).

Verdict: **ready, as one unit.** Merge #242, then #212 and #213 immediately, in either order (ISS-003). No blocker or new major issue. ISS-028 is the only new minor; it is a one-line addition and can follow.

## Issue status

| ID | Severity | Status | Notes for this run |
| --- | --- | --- | --- |
| ISS-001 | note | Open (method) | Tarballs at lockfile pins; no full app install, so proposals were not type-checked. |
| ISS-002 | minor | Fixed | Every relative link in all six installed files resolves; `references/` and `knowledge/` are copied. |
| ISS-003 | major | **Open (process)** | See [ISS-003](#iss-003-with-the-updated-stack). |
| ISS-004 to ISS-009, ISS-012, ISS-013 | — | Fixed | Unchanged since the last run. |
| ISS-010 | minor | Fixed | No Design Brain rule text is inlined any more; the skill queries Notion and applies Active rules (`skill.md:57-63`). |
| ISS-011 | major | Deferred (Notion side), **now reachable, mitigated** | With Notion, the agent reads the Active P0 evidence-order rule, which ranks MMDS `main` and published Storybook without mentioning installed types. Base `skill.md:61-62` ("Installed types still win on what exists in code") settles the conflict for code. The Notion rule is unchanged; no edit from this work. |
| ISS-014 | major | Fixed | Deprecated APIs is unchanged (`skill.md:110-124`). The scenario 1 probe still finds 2/2 deprecations per platform. |
| ISS-015 | major | Fixed, **reworded** | Replaced by the pattern lookup order; see (d). |
| ISS-016, ISS-017, ISS-020 | — | Fixed | Unchanged since the last run. |
| ISS-018 | minor | **Fixed with Notion; disclosed without it** | Base Typography (`:150-156`) is unchanged. With Notion, the Proposed typography rule is found and applied as guidance. Without Notion, hero-family misuse still passes, but the review says "Design Brain not checked". |
| ISS-019 | note | Open | Mobile overlay `:96-97` (Text default role "in installed types"). |
| ISS-021 | note | Open | Mobile overlay `:27`, `:113` ("app-level components"). |
| ISS-022 | note | Open | No "a `dist/` folder is not an export" line; the export-index check still catches it. |
| ISS-023 | minor | **Fixed** | Scaffold `:162-166` now uses a placeholder (`Foo`) and "adjusting `../` to the file". `:18` still names two real app folders inside the placement section (accepted exception; maintainers to confirm). |
| ISS-024 | note | Open | `skill.md:114-118`: still silent on new code when the replacement is not exported. |
| ISS-025 | note | **Fixed** | Checklist `:196` "Installed types were read." |
| ISS-026 | note | **Fixed** | Both overlays link `MIGRATION.md` at the installed per-package tag (Mobile `:129-130`, Extension `:96-97`); both return 200. |
| ISS-027 | note | Open | `skill.md:164` is still unwrapped. The new overlay token bullets (Mobile `:46`, Extension `:44`) are also single long lines. Cosmetic; lint passes. |
| ISS-028 | minor | **New** | Pattern step 1 has no MCP-free route. |
| ISS-029 | note | **New** | Extension token note does not cover canvas or JS-only color props. |
| ISS-030 | note | **New** | Design Brain rules carry no platform field; the skill does not say how Extension should apply Mobile-phrased rules, or what to do with P2 and Retired rules. |
| ISS-031 | note | **New** | An Active P0 process rule sets where accessibility findings are posted; the skill's review output does not mention it. |
| ISS-032 | note | **New** | The accessibility floor dropped the "real action" half of the icon-only button rule. |

### ISS-003 with the updated stack

| State of `main` | Mobile install | Extension install |
| --- | --- | --- |
| #242 + #212 + #213 (any order; also with #242 squash-merged) | ✅ 344 lines, overlay at 208 | ✅ 316 lines, overlay at 208 |
| #242 only | ⚠️ 637 lines: new base + old `main` overlay ("LAST RESORT: Custom components with StyleSheet", line 236). The base's "The overlay says how this platform reads one" (token fallback) has no overlay note to point at. | ⚠️ 361 lines: "None of these needs an MCP server" (line 28) next to the old required MCP-server workflow (line 276), a vendor MCP broker (line 289), and a Tailwind major-version pin (line 309). No token note either. |
| #242 + #212 only | ✅ | ⚠️ as "#242 only" |
| #242 + #213 only | ⚠️ as "#242 only" | ✅ |

`git merge-tree`:
- #242 onto `main` is clean, and its tree equals #242's tree.
- Then #212 and #213 in either order: clean, final tree `cfd70c5`.
- With #242 squash-merged, both orders are also clean, with the same tree.

Recommendation unchanged: merge the three back to back. Now that #242 is marked ready while #212 and #213 are drafts, take care that #242 does not merge on its own.

### ISS-028 — Pattern step 1 ("Storybook or the manifest docs") has no MCP-free route

- Platform: Shared (`skill.md:92-93`; reference `:90-92`)
- Scenario: (d), 2
- Severity: minor
- Expected: The first place in the pattern lookup order can be read without an MCP server, since the Sources list says none needs one.
- Actual:
  - Today's components manifests have 0 pattern entries on both platforms.
  - The React docs manifest has 4 intro entries and no patterns. React Native publishes no docs manifest (503 today).
  - The hosted Storybook index does list pattern stories, with no MCP needed: `<storybook>/index.json` for React and `<storybook>/react-native/index.json`, three `Patterns/` stories each. But neither the base nor the reference names it.
  - An agent following the order checks two places that never contain patterns, then moves on to the Design Brain. That is correct, but it skips the one MCP-free Storybook source.
- Evidence: `jq '.components|keys[]' components.json | grep -ci pattern` returns `0` (both); `jq '.entries|to_entries[]|select(.value.title|startswith("Patterns/"))'` on both `index.json` files.
- Suggested fix (skills): In the reference, add "Storybook's `index.json` (React at the site root, React Native under `/react-native/`) lists every story, including `Patterns/`. Read the story source at its `importPath` in the MMDS repo. It tracks MMDS `main`; installed types still win." In the base, say "Storybook (`index.json`) or the manifest docs".

### ISS-029 — Extension token note does not cover canvas or JS-only color props

- Platform: Extension overlay `:44`
- Scenario: (c)
- Severity: note
- Actual: The overlay says "read a semantic token as a CSS variable". A chart canvas (`strokeStyle`) and many third-party chart options need a literal color, where `var(--…)` does not resolve. The repo already handles this with computed style of the token variable (one chart body). The design-tokens README at the tag shows CSS variables and the JS themes, but not the canvas case. An agent that searches repo usage finds it, as source 5 says.
- Suggested fix (skills): Add "When a canvas or third-party option needs a literal color, read the variable's computed value at runtime (and re-read on theme change)."

### ISS-030 — Design Brain rules carry no platform field

- Platform: Shared (`skill.md:57-63`), Extension
- Scenario: (b)
- Severity: note
- Actual:
  - The Lessons & Rules schema has Status (Proposed, Active, Retired), Priority (P0 must, P1 should, P2 nice), Category, and a free-text Component field, but no platform field.
  - Many Active accessibility rules are phrased in React Native props. Only copy rules say "Platform: Both".
  - An Extension agent has to translate them (for example a native accessibility label to an ARIA name). The overlay's "Do not apply React Native guidance … to Extension" points the other way.
  - The skill also does not say what P2 nice or Retired rules mean.
- Suggested fix (skills): Add "Apply a rule's intent with this platform's mechanism (the overlay's accessibility mechanics). Ignore Retired rules. P2 rules are suggestions."

### ISS-031 — Where accessibility findings are posted

- Platform: Shared (Review workflow `skill.md:82-87`)
- Scenario: (b)
- Severity: note
- Actual: An Active P0 Accessibility rule says accessibility findings go in PR conversation comments, not inline review comments or chat. The skill's review output ("file, line, evidence, and a recommended fix") does not conflict, and an agent with Notion would follow the rule. An agent without Notion would not know about it.
- Suggested fix (skills): None needed if this is meant to live only in the Brain. Otherwise add one clause to the Review workflow.

### ISS-032 — The accessibility floor dropped the "real action" half of the icon-only button rule

- Platform: Shared (`skill.md:174-176`)
- Scenario: (a), 4 (Mobile case 6)
- Severity: note
- Actual:
  - The earlier inline set required both an accessible name and a real action for icon-only buttons, and banned info buttons whose press does nothing. The floor keeps only the accessible name.
  - Without Notion, an icon-only button with a name but a no-op press passes. The review still says "Design Brain not checked".
  - With Notion, the Active P1 rule against no-op info buttons catches it.
  - The other dropped items (visible text in the accessible name, abbreviations, combobox semantics, trust rules) are all Active rules that Notion returns. Mobile's sheet and back/close rules stay in the overlay (`:73-86`).
- Suggested fix (skills): Optional. Add "and a real action" to the floor's icon-only clause; it costs four words.

## (a) Run without Notion

The agent had no Notion connector. It followed the combined Mobile and Extension installs and reviewed the planted patches in scenario 4.

- **Required output:** every review ended with "Design Brain not checked", as `skill.md:62-63`, `:85-86`, and `:209-210` require. The Create workflow (`:78-80`) reaches the same checklist item.
- **Requested floor cases:**

| Planted case | Mobile | Extension | Floor line |
| --- | --- | --- | --- |
| Text input labelled by placeholder only | ✅ | ✅ | `:174` "Every input has a persistent label. A placeholder is not a label." |
| icon-only button with no accessible name | ✅ | ✅ | `:174-176` "… icon-only buttons have an accessible name" |
| Selected state shown by color only (tab / filter chip) | ✅ | ✅ | `:177` "Never show state with color alone, and expose that state to assistive tech." Mobile overlay tabs `:99` adds the mechanism. |

- **Not caught without Notion:** a no-op press on a named icon-only button (ISS-032), and body copy in the hero family (ISS-018). Both are disclosed by the "Design Brain not checked" line.

## (b) Run with read-only Notion

The agent queried Lessons & Rules (read-only `notion-query-data-sources` and `notion-fetch` on the data source), filtered to the areas the patches change: Accessibility, Design system, and Security. No pages were created, edited, or commented on.

| Planted case | Rule found | Status / priority | Agent's treatment |
| --- | --- | --- | --- |
| Placeholder-only label | Every text field needs a persistent accessible label tied to the input | Active, P0 must | Finding (must), rule cited |
| icon-only button with no name | Meaningful icons need an accessible name or must be hidden | Active, P0 must | Finding (must), rule cited |
| icon-only button with a no-op press | Do not ship icon-only info buttons that do nothing | Active, P1 should | Finding (should), rule cited |
| State by color only | Do not show selected, active, or unread state through color alone; tab controls expose the selected state | Active, P1 should; Active, P0 must (tabs) | Finding, both cited |
| Back that confirms in a sheet flow | Sheets and modals keep close/back available; the wallet trust rule (keep back, cancel, and recovery available) | Active, P0 must | Finding, both cited |
| Body copy in the hero family | The typography rule | **Proposed**, P1 should | Reported as guidance only; not a failure |
| Hex in a chart | WCAG AA contrast with semantic tokens; verify dark mode; do not hard-code | Active, P1 should | Supports the token finding |

- The agent also read the Active P0 evidence-order rule. It kept installed types as the contract for code, per `skill.md:61-62` (ISS-011).
- On Extension, the Mobile-phrased rules were applied through the Extension overlay's web mechanics (ISS-030).

## (c) Token scenario: Tailwind cannot reach the value

| Target (by role) | Before | Rule followed | After |
| --- | --- | --- | --- |
| Mobile: an SVG chart line and axis | Planted hex `stroke` and `fill` on `react-native-svg` elements | Base `:133-142` (token, never hex); Mobile overlay `:46`: "read a semantic token in JS … through the app theme" | Semantic color from the app theme hook; the repo's own prediction chart already does exactly this, and 419 files use the hook |
| Extension: a Chart.js crosshair plugin | Real hex on the canvas `strokeStyle`, with a TODO and a lint disable for the no-hex rule | Base `:133-142`; Extension overlay `:44` CSS variable | The semantic border token's CSS variable, resolved with computed style because canvas does not parse `var(--…)`. The sibling chart body already does this (ISS-029). |
| Extension: a candlestick chart | Real raw brand palette entries for the up and down colors | Base `:140` "Never use a raw palette value" | Semantic success and error tokens, read the same way |

- No hex, raw palette value, or arbitrary value in any proposal.
- No recorded reason was needed (`:137`).
- The design-tokens README at the installed tag documents the CSS-variable and JS-theme routes used.

## (d) Pattern wording across the six installed files

Each platform's three installed files (Claude skill, agents skill, and Cursor rule) have byte-identical bodies. The table checks the shared text plus each overlay.

| Place | Text | Consistent? |
| --- | --- | --- |
| Sources, in order (`skill.md:33-74`) | types → manifest → Design Brain → README at tag → repo usage | ✅ |
| Choosing a component (`:91-96`) | "For a pattern, use the first place that has it: Storybook or the manifest docs, then the Design Brain when Notion is available, then the component README at the installed tag, then existing repository usage." | ✅ same order |
| Design Brain step (`:61`) | "check the Brain for patterns too" | ✅ |
| Reference (`:81-83`, `:90-92`) | "A missing entry is not proof that no story or pattern exists. Follow the pattern lookup order…"; "Look in this manifest and the docs manifest, then follow the pattern lookup order" | ✅ |
| Strategy doc (`:63-64`) | installed types first; query Design Brain when Notion can reach it | ✅ |
| Mobile overlay (`:31`), Extension overlay (`:33`) | "Search the repo for existing MMDS usage before building custom UI." | ✅ the last step before custom UI, not a competing order |
| Older wording | "search the manifest for an existing pattern" and "Pattern … stories are not in the manifest" | ✅ 0 matches in all six files |

## Scenario results

Method unchanged: the agent works only from the installed `mms-ui-development` skill, installed types, today's manifests, and GitHub READMEs at the installed per-package tags. Targets are described by role.

### Scenario 1 — Types win over manifest: Mobile Pass, Extension Pass

- 3 manifest-only button variant components per platform are rejected by the export-index check.
- Story snippets that import enums from the shared package (30 React Native, 21 React) are redirected to the platform package.
- Deprecations are found 2/2 per platform through the Deprecated APIs grep.
- The new checklist item "Installed types were read" (`:196`) now states the types-first rule (ISS-025).

### Scenario 2 — Restyle with foundations: Mobile Pass, Extension Pass

- Same targets and evidence as the last run; the overlay styling surfaces changed only by the token note.
- Tailwind-first holds: the base says "Use preset Tailwind classes first" (`:128`).
- Pattern lookup for the Extension composed row:
  - The manifests and docs manifest have no patterns.
  - The Design Brain has an Active rule for interactive list rows (pressed highlight, own padding); it is reachable only with Notion.
  - The `Box` README at the tag documents `asChild`, and repo usage confirms the composition.

### Scenario 3 — Legacy* migration: Mobile Pass, Extension Pass

- Same targets and decisions as the last run. Only text-variant and text-color enums are aliased on Extension; legacy layout enums keep plain names.
- The prop-mapping link now opens `MIGRATION.md` at the installed tag (200 on both).

### Scenario 4 — Review checklist

No-Notion and with-Notion columns; ✅ = caught by the skill as written.

**Mobile** (invented fee-sheet patch)

| # | Planted violation | No Notion | Read-only Notion | Rule / evidence |
| --- | --- | --- | --- | --- |
| 1 | Button variant in the manifest but not exported | ✅ | ✅ | Reference export-index check |
| 2 | Scroll container from React Native inside the design-system sheet | ✅ | ✅ | Overlay Sheets |
| 3 | `StyleSheet.create` with hard-coded padding and radius | ✅ | ✅ | Overlay styling; base `:140-142` |
| 4 | Hand-set font size | ✅ | ✅ | Base Typography |
| 5 | Pressed `style` function on the base button | ✅ | ✅ | Overlay pressed-state bullet |
| 6 | icon-only button: no name, and a no-op press | ⚠️ name ✅ / no-op ❌ | ✅ | Floor `:174-176`; ISS-032; Active P1 no-op rule |
| 7 | Sheet with no header part; back calls confirm | ✅ | ✅ | Overlay Sheets `:73-86`; Active P0 sheet and trust rules |
| 8 | Deprecated button-family component for the primary call-to-action | ✅ | ✅ | Deprecated APIs |
| 9 | Body copy in the hero family | ❌ (disclosed) | ✅ guidance | ISS-018; Proposed typography rule |
| 10 | Hand-built pressable row where the MMDS list item covers it | ✅ | ✅ | Base `:87`, `:91-96` |
| 11 | New deprecated usage "because the repo already uses it" | ✅ | ✅ | Base `:116-117` |
| 12 | **New:** text input labelled by placeholder only | ✅ | ✅ | Floor `:174`; Active P0 |
| 13 | **New:** selected tab shown by color only | ✅ | ✅ | Floor `:177`; overlay `:99`; Active P0/P1 |
| 14 | **New:** hex `stroke` on an SVG chart | ✅ | ✅ | (c) |
| 15 | **New:** review omits any Design Brain statement | ✅ | ✅ | Checklist `:209-210` |

**Extension** (invented token-search-row patch)

| # | Planted violation | No Notion | Read-only Notion | Rule / evidence |
| --- | --- | --- | --- | --- |
| 1 | `Legacy` prefix on the MMDS import | ✅ | ✅ | Overlay Do / Don't |
| 2 | icon-only control with no accessible name | ✅ | ✅ | Floor; overlay `:57-59` |
| 3 | Search field with no label | ✅ | ✅ | Floor `:174`; overlay `:57-59` |
| 4 | Arbitrary values and default-palette classes | ✅ | ✅ | Base Foundations; overlay |
| 5 | New SCSS import | ✅ | ✅ | Overlay |
| 6 | New legacy `Text` with a legacy variant enum | ✅ | ✅ | Overlay |
| 7 | "No results" not announced | ✅ | ✅ | Floor `:179`; overlay live region |
| 8 | Hard-coded English strings | ✅ | ✅ | `mms-content-guidelines` |
| 9 | Deprecated button-family component | ✅ | ✅ | Deprecated APIs |
| 10 | Body copy in the hero family | ❌ (disclosed) | ✅ guidance | ISS-018 |
| 11 | Clickable `div` row | ✅ | ✅ | Overlay |
| 12 | New usage of a deprecated component whose replacement is not exported | ✅ flagged, ⚠️ fix unstated | same | ISS-024 |
| 13 | **New:** selected filter chip shown by color only | ✅ | ✅ | Floor `:177` |
| 14 | **New:** hex on a chart canvas | ✅ | ✅ | (c); ISS-029 |
| 15 | **New:** raw brand palette colors in a chart | ✅ | ✅ | Base `:140` |

## Install smoke

Installed the combined stack, `main`, #242 alone, and each overlay PR alone, into lightweight copies of today's consumers (`.claude`, `.agents`, `.cursor`, and `package.json`). All exited 0.

| Check | Mobile | Extension |
| --- | --- | --- |
| Targets written | `.claude/skills/`, `.agents/skills/`, `.cursor/rules/` | same |
| Merged file = base + thin overlay | ✅ 344 lines; overlay at line 208 in all three | ✅ 316 lines; overlay at line 208 in all three |
| Bodies identical across the three targets | ✅ | ✅ |
| `references/` and `knowledge/` copied; relative links resolve | ✅ | ✅ |
| Numeric version strings in the installed text | ✅ 0 (the WCAG criterion number left with the inlined rules) | ✅ 0 |
| MCP-server setup or workflow guidance | ✅ none; the Design Brain step is optional with a stated fallback | ✅ |
| Links at the installed tag (component README, design-tokens README, `MIGRATION.md`) | ✅ all at `@<installed version>`, 200 | ✅ |
| `yarn audit:skills` | 0 errors, 128 warnings (`main` 130); same on #242, #212, #213 heads | same |
| `yarn test` / `yarn lint` (combined tree) | 77/77 / pass | same |

### MMSkills content rules (combined install)

| Rule | Mobile `ui-development` | Mobile scaffold | Extension `ui-development` |
| --- | --- | --- | --- |
| No component names except `Box`, `Button`, `Text` | ✅ | ✅ (MMDS names); real app folder names at `:18` inside the placement section | ✅ (icon-only appears only as prose, overlay `:57`) |
| No hardcoded enums | ✅ | ✅ (only the template's own test-id constants) | ✅ |
| No version pins | ✅ | ✅ | ✅ |
| No MCP-server setup or workflow guidance | ✅ | ✅ | ✅ |
| No app folder paths | ✅ | ✅ accepted placement `:12-15`, fence `:175-177`, barrel `:326`; i18n `:149`, `:154`, `:165` for maintainers | ✅ |
| READMEs from GitHub at the installed tag | ✅ base `:64-70`, overlay token and README links | ✅ | ✅ |

Exported-name scan: every name exported by the installed React Native and React indexes, except `Box`, `Button`, and `Text`, was matched as a whole word against each installed file. The only hits were one common English word in scaffold JSDoc and test strings, and the capitalised start of an icon-only phrase in the Extension overlay.

### A/B contrast with `main`

- **Mobile:** `main` installs 440 lines (old inventory overlay and "LAST RESORT … StyleSheet"); the stack installs 344.
- **Extension:** `main` installs 164 lines built around a required MCP workflow; the stack installs 316, with no MCP dependency.
- **Accessibility:** on both, `main` carries no Design Brain rules. The stack routes them through Notion, with a floor and a required disclosure.

## What should change (for the stack authors)

These are eval findings only; nothing on #242, #212, or #213 was edited.

1. **ISS-003 (process):** merge #242, #212, and #213 back to back. #242 is now ready for review while the overlays are drafts, so avoid merging #242 alone.
2. **ISS-028 (reference and base):** name Storybook's `index.json` as the MCP-free pattern source.
3. **Notes, all one-liners:** ISS-029, ISS-030, ISS-031, ISS-032, ISS-024, ISS-019, ISS-021, ISS-022, ISS-027.

Resolved since the last run: **ISS-023**, **ISS-025**, **ISS-026**, and **ISS-018** (when Notion is available). ISS-010 and ISS-015 are superseded by the Design Brain step and the lookup order.
