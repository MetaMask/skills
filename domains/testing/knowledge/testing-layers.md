# Mobile Testing Layers

**Scope: MetaMask Mobile only.** This policy does not invent a component-view framework for Extension.

Use this decision tree whenever adding or reviewing tests for Mobile code.

**Peer skills:** `component-view-test` and `unit-testing` are documented at the same level. Choose by this tree — do not treat unit-testing as the primary testing guide.

## Decision tree

```
What are you testing?
├─ Screen / view / UI behavior via app state
│  → Write or update ComponentName.view.test.tsx (component-view-test skill)
│  → If the CV framework cannot cover the case yet:
│     → Smallest focused unit test + note why CV cannot
│
├─ Pure logic / helpers / narrow component contracts
│  → Focused unit test (unit-testing skill)
│
└─ Full device journey / Appium flow
   → E2E (e2e-test skill) — not a substitute for CV on a single view
```

## Default: component-view tests

Page/view behavior exercised through rendered UI and real Redux/app state belongs in **`*.view.test.tsx`** using the `tests/component-view/` framework.

- Drive state through presets/renderers — do **not** mock hooks or selectors to force UI state.
- Only Engine and allowed native modules may be mocked.
- How to write/run: load the **component-view-test** skill.

## Unit tests (allowed cases)

Keep unit tests for:

- Pure helpers and local utilities
- Narrow component contracts that are not screen/view behavior
- Cases the CV framework cannot cover yet — retain the **smallest** focused unit test and document why

How to write/run: load the **unit-testing** skill.

## Smell / avoid

Broad `*.test.tsx` files that render a whole screen/page and mock hooks/selectors to assert UI behavior. Convert those to `*.view.test.tsx` (or keep a minimal unit test only when CV cannot cover, with an explicit reason).

## E2E

Full multi-screen or device journeys that need Appium. Do not use E2E as the primary coverage for a single view when CV can cover it.

How to write/run: load the **e2e-test** skill.

## Coverage during conversion

Converting broad unit screen tests to component-view must preserve the same coverage intent. If a scenario cannot move to CV, document why and keep the smallest focused unit test needed.
