---
name: extension-testing-layers
domain: testing
description: >
  MetaMask Extension test-layer policy. Prefer unit for pure logic, E2E for
  real browser/extension/dapp boundaries. Integration is underused (stub in
  v1). Canonical source for extension-testing and cross-domain citations.
---

# Extension Testing Layers

**Scope: MetaMask Extension only.** For Mobile, use `knowledge/testing-layers.md`
and the `mobile-testing` skill.

**This file is the single source of truth** for Extension test-layer placement.
Do not duplicate this policy in skill `references/` — open this file (installed
as `knowledge/extension-testing-layers.md` beside testing skills).

**Entrypoint:** Install **`extension-testing`**. That skill routes to unit,
integration (stub), and E2E create/maintain references. Do not treat the
deprecated standalone `unit-testing` / `e2e-testing` skills as the primary guide.

**Placement audits:** Cross-layer inventory (unit ↔ integration ↔ e2e) is
**phase 2** — not part of v1. Until then, use this decision tree when choosing
where to add coverage.

## Policy

Choose the **lowest-cost deterministic layer** that exercises the boundary
responsible for the behavior. Prefer **unit → integration (when justified) →
E2E**.

Unlike Mobile, Extension has **no component-view layer**. Selenium E2E is a
legitimate primary harness for browser/extension/dapp/window boundaries — do
not avoid E2E merely because Mobile gates Appium strictly.

## Decision tree

```
Is this scenario worth covering? (distinct realistic regression)
├─ No → GAP / ACCEPT (document why)
└─ Yes → Already covered at any correct layer?
   ├─ Yes → KEEP
   └─ No → Pure logic / helpers / selectors / controllers / RTL unit UI?
      ├─ Yes → Write or update colocated *.test.ts(x) (extension-testing → unit)
      └─ No → Needs jsdom app↔controller harness under test/integration/?
         ├─ Yes (v1 stub) → Prefer unit or E2E unless an existing integration
         │        suite already covers the seam; expand integration guidance later
         └─ No → Needs a real browser / extension / dapp / multi-window boundary?
            ├─ Yes → E2E (extension-testing → e2e)
            │        Justify briefly: what browser/extension boundary is required.
            └─ No → GAP / ACCEPT (do not invent E2E)
```

## Defaults

| Layer           | Owns                                                                                         | File pattern                          |
| --------------- | -------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Unit**        | Pure helpers, controllers, selectors, Redux/RTL component contracts                          | colocated `*.test.ts(x)`              |
| **Integration** | jsdom harness crossing app↔controller (underused; stub in v1)                                | `test/integration/**/*.test.tsx`      |
| **E2E**         | Real browser/extension/dapp/window journeys after unit (and integration) are insufficient    | `test/e2e/tests/**/*.spec.ts`         |

## Unit tests

Keep unit tests for:

- Pure helpers and local utilities
- Controllers, messengers, selectors
- Component contracts exercised with Jest + RTL (not full browser)

How to write/run: `extension-testing` → `references/unit.md`.

## Integration tests (v1 stub)

`test/integration/` exists but is sparsely used. In v1:

- Prefer **unit** or **E2E** unless you are extending an existing integration suite
- Do not invent a new integration harness without team agreement
- Full integration writing guidance is deferred (phase 2 expansion)

How to open the stub: `extension-testing` → `references/integration.md`.

## When E2E is justified

Real browser/extension journeys when unit (and existing integration) cannot
exercise the required boundary.

Valid reasons (need at least one concrete browser/extension boundary):

- MV3 service worker / extension lifecycle
- Multi-window / popup / notification / dapp tab switching
- Real dapp ↔ wallet connection or confirmation flows
- Phishing interstitial / deep-link security surfaces
- Network switching or UX that depends on live extension chrome APIs
- End-to-end paths that only fail when the full extension build runs

Invalid reasons alone:

- “It is a user journey” when unit/RTL can cover the behavior
- Pure controller/helper logic
- Preferring E2E because fixtures already exist nearby without a boundary need

How to write/maintain: `extension-testing` → `references/e2e.md`.

## Out of scope layers

- **Visual** (`mm` CLI) — separate `visual-testing` skill
- **A/B**, **i18n** — separate skills
- **Mobile CV / Appium** — `mobile-testing` only
- **Placement audits** — phase 2
