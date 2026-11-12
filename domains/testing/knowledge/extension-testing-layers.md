---
name: extension-testing-layers
domain: testing
description: >
  MetaMask Extension test-layer policy. Prefer unit for isolated logic,
  integration for UI/state or composed-background seams, and E2E for real
  browser/extension/dapp boundaries. Canonical source for extension-testing
  and cross-domain citations.
---

# Extension Testing Layers

**Scope: MetaMask Extension only.** For Mobile, use `knowledge/testing-layers.md`
and the `mobile-testing` skill.

**This file is the single source of truth** for Extension test-layer placement.
Do not duplicate this policy in skill `references/` — open this file (installed
as `knowledge/extension-testing-layers.md` beside testing skills).

**Entrypoint:** Install **`extension-testing`**. That skill routes to unit,
integration, and E2E create/maintain references. Do not treat the deprecated
standalone `unit-testing` / `e2e-testing` skills as the primary guide.

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
   └─ No → Pure logic / helpers / selectors / isolated controller / narrow RTL UI?
      ├─ Yes → Write or update colocated *.test.ts(x) (extension-testing → unit)
      └─ No → Needs full UI + real Redux without a browser?
         ├─ Yes → UI integration under test/integration/
         │        (extension-testing → integration)
         └─ No → Needs real MetaMaskController + child-controller composition?
            ├─ Yes → Composed-background integration in
            │        app/scripts/metamask-controller*.test.js
            │        (extension-testing → integration)
            └─ No → Needs a real browser / extension / dapp / multi-window boundary?
               ├─ Yes → E2E (extension-testing → e2e)
               │        Justify briefly: what browser/extension boundary is required.
               └─ No → GAP / ACCEPT (do not invent E2E)
```

## Not worth covering: static presentation

A change to static or default presentation is **GAP / ACCEPT** at every layer.
Do not add or update a test for it. This includes:

- Spacing, padding, margin, and alignment
- Color, typography, and design-token values
- Fixed truncation or other layout props that never change with state
- Swapping one class name, SCSS rule, or style value for another

Do not add a `data-testid` only so a test can read `style` or `className`, and
do not add or refresh a snapshot because only class names or static styles
changed. Verify these changes with screenshots (`visual-testing`) and the PR's
before/after evidence.

Presentation that depends on state or props is behavior. Test it, and assert
the outcome a user or caller sees (text shown or hidden, disabled, ARIA state),
not pixel or class values.

Do not use a coverage delta as the reason to add or skip a test. Coverage can
rise from a render that asserts nothing, and a real bug fix can leave coverage
flat. Coverage reports only point at uncovered branches worth considering.

## Defaults

| Layer           | Owns                                                                                                  | Existing homes                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Unit**        | Pure helpers, isolated controllers, selectors, narrow Redux/RTL component contracts                   | colocated `*.test.ts(x)`                                                                            |
| **Integration** | Full UI + real Redux with mocked background RPC; or real composed background with mocked external I/O | `test/integration/**/*.test.tsx`; `app/scripts/metamask-controller*.test.js`                         |
| **E2E**         | Real browser/extension/dapp/window journeys after unit and integration are insufficient               | `test/e2e/tests/**/*.spec.ts`                                                                       |

## Unit tests

Keep unit tests for:

- Pure helpers and local utilities
- Isolated controllers, messengers, selectors
- Component contracts exercised with Jest + RTL (not full browser)

How to write/run: `extension-testing` → `references/unit.md`.

## Integration tests

Extension has two existing integration homes for different seams:

- **UI integration:** `test/integration/**/*.test.tsx` renders the real UI root
  with a real Redux store. Mock the background RPC and external HTTP boundaries.
- **Composed-background integration:**
  `app/scripts/metamask-controller.test.js` and
  `app/scripts/metamask-controller.actions.test.js` construct the real
  `MetaMaskController` and child-controller graph. Mock external I/O such as
  network requests, browser APIs, providers, and encryption.

These are two homes in the same layer, not two new layers. Pick the home that
owns the failing boundary. Do not require UI integration coverage to be
duplicated in `MetaMaskController` tests, and do not invent a new integration
folder or file suffix without team agreement.

The composed-background files run through the unit Jest command because of the
repository's existing Jest configuration; their layer is defined by the
boundary they exercise, not by the command name.

How to write/run: `extension-testing` → `references/integration.md`.

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
- Composed `MetaMaskController` wiring that can run in the existing Node tests
- Preferring E2E because fixtures already exist nearby without a boundary need

How to write/maintain: `extension-testing` → `references/e2e.md`.

## Out of scope layers

- **Visual** (`mm` CLI) — separate `visual-testing` skill
- **A/B**, **i18n** — separate skills
- **Mobile CV / Appium** — `mobile-testing` only
- **Placement audits** — phase 2
