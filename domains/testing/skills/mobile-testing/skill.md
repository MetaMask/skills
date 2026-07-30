---
name: mobile-testing
description: >
  Single MetaMask Mobile testing entrypoint. Routes unit, component-view,
  integration, Appium E2E, Detox→Appium migration, and test-layer placement
  work to the right references. Use when writing, fixing, reviewing, or
  placing Mobile tests; when the user mentions Jest layers, *.view.test.tsx,
  *.integration.test.ts, Appium smoke, Detox migration, MMQA test-layer
  tickets, or asks which testing skill to install.
maturity: stable
---

# Mobile testing

One skill for MetaMask Mobile functional testing. Classify the task, pick the
layer, then open **only** the matching reference.

**Out of scope:** performance, visual, A/B, i18n, and flakiness skills — keep
those separate.

## First step — choose the layer

Read [`references/layers.md`](references/layers.md) (or installed
`knowledge/testing-layers.md`) before writing any test.

## Open next

| If the work is… | Open |
| --- | --- |
| Pure logic / helpers / selectors / CV fallback | [`references/unit.md`](references/unit.md) |
| Screen UI via real Redux / `*.view.test.tsx` | [`references/component-view.md`](references/component-view.md) |
| App↔controller seam / `*.integration.test.ts` | [`references/integration.md`](references/integration.md) |
| New or preferred device journey | [`references/appium-e2e.md`](references/appium-e2e.md) |
| Migrating or touching remaining Detox tests | [`references/detox-to-appium.md`](references/detox-to-appium.md) |
| Area / Jira / PR coverage audit across layers | [`references/placement.md`](references/placement.md) |

Do not read every reference up front. Follow the decision tree in the layer
doc, then open nested files only when that doc sends you there.

## Hard rules

1. **Default new device E2E to Appium.** Detox is nearly deprecated.
2. Prefer migrating Detox specs to Appium over extending Detox.
3. Do not add new Detox tests unless the user explicitly requires work on an
   unmigrated Detox suite.
4. For E2E, inspect existing Appium specs, POMs, fixtures, flows, and nearby
   feature examples in the mobile repo before proposing code.
5. E2E POM methods must not use `try/catch`.
6. Placement work defaults to **ANALYZE** — implement only when the user asks.

## Examples

```
User: Add tests for the new Predict screen visibility toggles
Agent: layers → CV → references/component-view.md → writing-tests.md
```

```
User: Cover HyperLiquid placeOrder through the real provider
Agent: layers → integration → references/integration.md
```

```
User: Add an Appium smoke for account rename
Agent: references/appium-e2e.md → mirror nearby tests/smoke-appium examples
```

```
User: Migrate this Detox smoke to Appium
Agent: references/detox-to-appium.md (Detox refs only if still needed)
```

```
User: Analyze Perps for unit/CV/integration/e2e — MMQA-2102
Agent: references/placement.md (ANALYZE mode)
```
