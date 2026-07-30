# Mobile Testing Layers

**Scope: MetaMask Mobile only.** This policy does not invent a component-view framework for Extension.

Use this decision tree whenever adding or reviewing tests for Mobile code.

**Entrypoint:** Install **`mobile-testing`**. That skill routes to unit, component-view, integration, Appium E2E, Detox→Appium migration, and placement references. Do not treat unit-testing as the primary testing guide.

**Placement audits:** For a code area / Jira / PR audit across all layers (inventory → disposition → optional implement → Jira + PR report), open `mobile-testing` → `references/placement.md`. Default mode is analyze-only. Unit↔CV overlap migrate/delete is a sub-pass of that path.

## Decision tree

```
What are you testing?
├─ Screen / view / UI behavior via app state
│  → Write or update ComponentName.view.test.tsx (mobile-testing → component-view)
│  → If the CV framework cannot cover the case yet:
│     → Smallest focused unit test + note why CV cannot
│
├─ App-to-controller seam / controller flow with I/O isolated
│  → Write or update *.integration.test.ts (mobile-testing → integration)
│  → Exercise real controllers/providers/services through a domain harness
│
├─ Pure logic / helpers / narrow component contracts
│  → Focused unit test (mobile-testing → unit)
│
└─ Full device journey
   → Default: Appium (mobile-testing → appium-e2e)
   → Remaining Detox / migration only (mobile-testing → detox-to-appium)
   → Not a substitute for CV on a single view
```

## Default: component-view tests

Page/view behavior exercised through rendered UI and real Redux/app state belongs in **`*.view.test.tsx`** using the `tests/component-view/` framework.

- Drive state through presets/renderers — do **not** mock hooks or selectors to force UI state.
- Only the Engine and native modules may be mocked.
- How to write/run: `mobile-testing` → `references/component-view.md`.

## Integration tests

Behavior that crosses the app-to-controller seam belongs in **`*.integration.test.ts`** using the `tests/integration/` framework.

- Run real controller, provider, service, validation, and state-transition code.
- Mock only the I/O boundary; Shape B/C harnesses may also mock documented app-shell glue while preserving the real target chain.
- Reuse a per-domain harness. Test files must not add one-off `jest.mock(...)` declarations.
- How to write/run: `mobile-testing` → `references/integration.md`.

## Unit tests (allowed cases)

Keep unit tests for:

- Pure helpers and local utilities
- Narrow component contracts that are not screen/view behavior
- Cases the CV framework cannot cover yet — retain the **smallest** focused unit test and document why

How to write/run: `mobile-testing` → `references/unit.md`.

## Smell / avoid

Broad `*.test.tsx` files that render a whole screen/page and mock hooks/selectors to assert UI behavior. Convert those to `*.view.test.tsx` (or keep a minimal unit test only when CV cannot cover, with an explicit reason).

## E2E

Full multi-screen or device journeys. **Default to Appium** (`tests/smoke-appium/`). Detox is nearly deprecated — prefer migrating remaining Detox specs rather than extending them. Do not use E2E as the primary coverage for a single view when CV can cover it.

How to write/run: `mobile-testing` → `references/appium-e2e.md` (or `references/detox-to-appium.md` for migration / remaining Detox).

## Coverage during conversion

Converting broad unit screen tests to component-view must preserve the same coverage intent. If a scenario cannot move to CV, document why and keep the smallest focused unit test needed.
