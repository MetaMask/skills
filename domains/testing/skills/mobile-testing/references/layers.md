# Mobile testing layers

**Scope: MetaMask Mobile only.**

Use this decision tree whenever adding or reviewing tests. The installable
entrypoint is **`mobile-testing`** — open the matching reference from that
skill instead of loading separate peer skills.

Canonical copy is also installed as `knowledge/testing-layers.md`.

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
      ├─ Yes → *.view.test.tsx → references/component-view.md
      │        Multi-screen / nav journeys are CV-first when routes can be
      │        registered and state/API driven in the CV framework.
      │        If CV cannot cover yet → smallest focused unit + why → unit.md
      └─ No → Can integration cover the app↔controller seam
             (real controller/provider/service, I/O isolated)?
         ├─ Yes → *.integration.test.ts → references/integration.md
         └─ No → Requires a real device / native runtime boundary?
            ├─ Yes → Appium (tests/smoke-appium/) → references/appium-e2e.md
            │        (Detox only for migration / remaining suites)
            │        Justify: why CV fails, why integration fails,
            │        what device/native boundary is required.
            └─ No → GAP / ACCEPT (do not invent E2E)
```

## Defaults

| Layer | Owns | File pattern |
| --- | --- | --- |
| **Component-view** | Screen visibility, presses, nav (including multi-screen when registerable), Redux/stream-driven UI | `*.view.test.tsx` |
| **Integration** | Real controllers/providers/services; mock I/O only | `*.integration.test.ts` |
| **Unit** | Pure helpers, selectors, reducers, CV fallback | `*.test.ts(x)` |
| **Appium E2E** | Device/native journeys only after CV + integration are insufficient | `tests/smoke-appium/**/*.spec.ts` |
| **Detox E2E** | Nearly deprecated — migrate or maintain unmigrated suites only | `tests/smoke/`, `tests/regression/` |

## When E2E is justified

Valid reasons (need at least one concrete device/native boundary):

- OS permissions / system dialogs
- App lifecycle (background, kill, relaunch)
- Real deep-link / OS dispatch into a built app
- Packaging / build / native wiring that Jest cannot exercise
- Platform gesture or runtime behavior that only appears on device

**Not** valid reasons for E2E:

- “User journey” / “feels end-to-end”
- Multiple screens (use CV cross-screen journeys when possible)
- “Smoke coverage” / “important feature”
- Controller or provider logic (use integration)
- Single-view or Redux-driven UI (use CV)

## Smell / avoid

Broad `*.test.tsx` files that render a whole screen and mock hooks/selectors to
assert UI behavior. Convert those to `*.view.test.tsx` (or keep a minimal unit
test only when CV cannot cover, with an explicit reason).

Do **not** use E2E as a substitute for any scenario CV or integration can cover
with equivalent confidence.

## Coverage during conversion

Converting broad unit screen tests to component-view must preserve the same
coverage intent. If a scenario cannot move to CV, document why and keep the
smallest focused unit test needed.

## Placement audits

For inventory → disposition → optional implement across layers (Jira / path /
PR), open [`placement.md`](placement.md). Default mode is analyze-only.
