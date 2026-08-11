# Mobile Testing Layers

**Scope: MetaMask Mobile only.** This policy does not invent a component-view framework for Extension.

Use this decision tree whenever adding or reviewing tests for Mobile code.

**Entrypoint:** Install **`mobile-testing`**. That skill routes to unit, component-view, integration, Appium E2E, Detox→Appium migration, and placement references. Do not treat unit-testing as the primary testing guide.

**Placement audits:** For a code area / Jira / PR audit across all layers (inventory → disposition → optional implement → Jira + PR report), open `mobile-testing` → `references/placement.md`. Default mode is analyze-only. Unit↔CV overlap migrate/delete is a sub-pass of that path.

## Policy

Choose the **lowest-cost deterministic layer** that exercises the boundary
responsible for the behavior. Prefer **CV → integration → unit fallback → E2E**.

Do **not** propose Appium E2E until CV and integration have been ruled out in
writing. “Default to Appium” means: **once E2E is justified**, implement it in
Appium (not Detox) — not “default the layer to E2E.”

## Decision tree

```
Is this scenario worth covering? (distinct realistic regression)
├─ No → GAP / ACCEPT (document why)
└─ Yes → Already covered at any correct layer?
   ├─ Yes → KEEP
   └─ No → Can CV cover it (Redux/state, registered routes, Engine, HTTP mock)?
      ├─ Yes → Write or update ComponentName.view.test.tsx (mobile-testing → component-view)
      │        Multi-screen / nav journeys are CV-first when routes can be
      │        registered and state/API driven in the CV framework.
      │        If CV cannot cover yet → smallest focused unit + why
      └─ No → Can integration cover the app↔controller seam
             (real controller/provider/service, I/O isolated)?
         ├─ Yes → Write or update *.integration.test.ts (mobile-testing → integration)
         └─ No → Requires a real device / native runtime boundary?
            ├─ Yes → Appium (mobile-testing → appium-e2e)
            │        (Detox only for migration / remaining suites)
            │        Justify: why CV fails, why integration fails,
            │        what device/native boundary is required.
            └─ No → GAP / ACCEPT (do not invent E2E)
```

## Default: component-view tests

Page/view behavior exercised through rendered UI and real Redux/app state belongs in **`*.view.test.tsx`** using the `tests/component-view/` framework.

- Drive state through presets/renderers — do **not** mock hooks or selectors to force UI state.
- Only the Engine and native modules may be mocked.
- Multi-screen / navigation journeys are **CV-first** when routes can be registered.
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

Device/native journeys **only after CV and integration are insufficient**. If and
only if E2E is justified, implement new coverage in **Appium**
(`tests/smoke-appium/`). Detox is nearly deprecated — prefer migrating remaining
Detox specs rather than extending them.

Valid E2E reasons need a concrete device/native boundary (OS permissions,
lifecycle, real deep-link dispatch, packaging/build wiring, platform runtime
Jest cannot exercise). Non-reasons: “user journey”, multiple screens, “smoke”,
“important feature”, controller logic, Redux-driven UI.

Do **not** use E2E as a substitute for any scenario CV or integration can cover
with equivalent confidence.

How to write/run: `mobile-testing` → `references/appium-e2e.md` (or `references/detox-to-appium.md` for migration / remaining Detox).

## Coverage during conversion

Converting broad unit screen tests to component-view must preserve the same coverage intent. If a scenario cannot move to CV, document why and keep the smallest focused unit test needed.
