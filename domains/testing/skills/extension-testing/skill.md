---
name: extension-testing
description: >
  Single MetaMask Extension testing entrypoint. Routes unit, integration (stub),
  and Selenium E2E create/maintain work (flakiness, POM anti-patterns) to the
  right references. Use when writing, fixing, reviewing Extension tests; when
  the user mentions FixtureBuilderV2, page objects, E2E flake, POM anti-patterns,
  MMQA testing-skills tickets, or asks which Extension testing skill to install.
maturity: stable
---

# Extension testing

One skill for MetaMask Extension functional testing. Classify the task, pick the
layer, then open **only** the matching reference.

**Out of scope:** performance, visual (`visual-testing` / `mm` CLI), A/B, i18n,
Mobile layers, and cross-layer placement audits (phase 2). Keep those separate.

**Flakiness note:** Unlike Mobile (where Jest unit flakiness is a separate
skill), Extension **E2E** flakiness lives **inside** this skill under
`references/e2e/flakiness.md` — create and maintain share one tree.

## First step — choose the layer

Read installed `knowledge/extension-testing-layers.md` (source:
[`../../knowledge/extension-testing-layers.md`](../../knowledge/extension-testing-layers.md))
before writing any test. `references/layers.md` is only a redirect stub.

## Open next

| If the work is… | Open |
| --- | --- |
| Pure logic / helpers / selectors / controllers / RTL unit | [`references/unit.md`](references/unit.md) |
| jsdom app↔controller under `test/integration/` (underused) | [`references/integration.md`](references/integration.md) |
| Create or update Selenium E2E / POM / fixtures | [`references/e2e.md`](references/e2e.md) → writing-tests |
| Fix flaky E2E or POM bad practices / audit anti-patterns | [`references/e2e.md`](references/e2e.md) → maintain / flakiness / pom-antipatterns |

Do not read every reference up front. Follow the decision tree in installed
`knowledge/extension-testing-layers.md`, then open nested files only when that
doc sends you there.

## Hard rules

1. **Layer gate first.** Prefer **unit → integration (only when justified) →
   E2E**. Document why unit is insufficient before proposing new E2E.
2. E2E is legitimate for real browser/extension/dapp/window boundaries — do not
   copy Mobile’s “almost never E2E” gate.
3. For E2E, inspect existing specs, page objects, flows, and fixtures in the
   feature folder before proposing code.
4. E2E POM methods must not use `try/catch`. Locators belong in page objects,
   not flows or specs. Specs must not call the driver for UI actions. Avoid
   hardcoded delays without a justifying comment.
5. Maintain mode: diagnose with `references/e2e/flakiness.md`, enforce structure
   with `references/e2e/pom-antipatterns.md`. Prefer waits and mocks over retries.
6. Do not treat Cursor Bugbot CI as a reliable POM merge gate — see
   `pom-antipatterns.md`. Use local review / self-check instead.

## Examples

```
User: Add a unit test for the deep-link parser helper
Agent: layers → unit → references/unit.md
```

```
User: Add E2E for connecting the test dapp and confirming a tx
Agent: layers → e2e (dapp/window boundary) → references/e2e.md → writing-tests.md
```

```
User: This E2E flakes on window handle / stale element
Agent: references/e2e.md → maintain.md → flakiness.md
```

```
User: Audit this PR for POM anti-patterns / try/catch in page objects
Agent: references/e2e.md → pom-antipatterns.md
```
