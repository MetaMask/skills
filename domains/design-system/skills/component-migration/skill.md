---
name: component-migration
description: >-
  Two MetaMask Design System (MMDS) migration workflows: bringing a
  component from the Extension or Mobile component library into the MMDS
  monorepo (audit both APIs, choose a conservative or unified strategy,
  create shared types, document gaps or deprecations), and refactoring an
  existing MMDS component from duplicated per-platform enums to shared
  const objects (ADR-0003 and ADR-0004). Use when asked to migrate,
  consolidate, port, or align a component, or to convert enums to shared
  types.
maturity: stable
---

# Migrate a component into MMDS

Two workflows that end in the same architecture. The type rules are in
`component-architecture`, the scaffolding steps are in `component-creation`,
and neither is restated here.

Lookup order: `knowledge/mmds-sources.md` (source:
[`../../knowledge/mmds-sources.md`](../../knowledge/mmds-sources.md)).

## When to use

| Situation | Workflow |
| --- | --- |
| The component lives in the Extension or Mobile component library and needs to move into MMDS | [From a consumer repo](#from-a-consumer-repo) |
| The component is already in MMDS, but its enums or types are duplicated per platform | [Internal enum to shared types](#internal-enum-to-shared-types) |

Out of scope: a brand-new component (`component-creation`).

## Workflow

Pick the workflow from the table, follow its steps, then run its checklist.

## From a consumer repo

### 1. Audit both platforms

Search the Extension and Mobile repositories for the existing component in
their component library or app-level components. Audit both, even when the
request names one. For each, record the location, file structure, current
prop API and types, dependencies, and stories.

| Concern | Extension API | Mobile API | Decision |
| --- | --- | --- | --- |
| Prop names | | | Choose the unified name |
| Types | | | Align or unify |
| Size / variant | | | Scoped const; alias a base scale when values match |
| Event handlers | `onClick` | `onPress` | Keep both (platform) |
| Styling | `className` | style object | `className` / `twClassName` |

Create shared types for any matching props, even a small overlap, and for
props with the same meaning under different names (`disabled` and
`isDisabled`). Accept platform differences for idiomatic patterns
(`onClick` / `onPress`) and platform-only features.

### 2. Choose a strategy

- Low usage (under 5 instances) or consumers updated in the same effort:
  **unified**.
- High usage (over 20) or consumers not updated now: **conservative**.
- In between: decide on whether consumers are updated now.

**Conservative:** accept partial alignment. List the gaps under "Known gaps"
in the PR description and open a follow-up issue for each.

**Unified:** consolidate now. Keep each old prop with `@deprecated` and
`@see` JSDoc naming the replacement, map it in the implementation
(`const effectiveDisabled = isDisabled ?? disabled;`), add a migration map
(old prop, new prop, notes, before/after example), update or coordinate
consumers, and remove the deprecated prop in the next major release.

### 3. Create, implement, document

Run `component-creation` from step 2. While porting:

- Do not copy code across unchanged. Rebuild with `Box` and `Text`, tokens,
  and preset classes. Replace hardcoded colors and sizes with tokens.
- React Native uses `twClassName`, not `StyleSheet.create`.
- Keep the same shared props, variant behavior, and tokens on both
  platforms.

Document the migration in the platform package's `MIGRATION.md` (preferred)
or in a migration section of the README.

### Checklist

- [ ] Both platforms audited; comparison table in the PR.
- [ ] Strategy chosen and stated.
- [ ] Conservative: gaps listed in the PR and follow-up issues opened.
- [ ] Unified: `@deprecated` + `@see` on old props, mapped in code, migration
      map written, consumers updated or coordinated.
- [ ] `component-creation` checklist passes.
- [ ] `MIGRATION.md` (or README section) updated.

## Internal enum to shared types

For a component already in both MMDS platform packages whose const objects or
enums are duplicated per platform and that has no shared props type.

1. Find the duplicates: the same `enum` or const object declared in each
   platform's `src/types/index.ts` or component types.
2. Create the shared types per `component-architecture` (const objects,
   scoped consts, `<ComponentName>PropsShared` with `type`, exported from the
   shared index with the inline `type` keyword).
3. In each platform `<ComponentName>.types.ts`, import the shared props type
   and extend it. Do not re-export const objects.
4. Delete the old enums from each platform `src/types/index.ts`. Do not add
   re-exports there.
5. Export the const objects from each component `index.ts`, directly from
   shared.
6. Fix import order (shared before platform, types before values).
7. Build, test with coverage, and lint from the repository root.

The public API must stay backwards compatible: same export names, same
values.

### Checklist

- [ ] `component-architecture` checklist passes.
- [ ] Old enums removed from both platform `src/types/index.ts` files.
- [ ] No const re-exports from `.types.ts`.
- [ ] No breaking change to the component's public API.
- [ ] Build, tests (100% coverage), and lint pass; no TypeScript errors.
