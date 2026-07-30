# Mobile testing layers

**Scope: MetaMask Mobile only.**

Use this decision tree whenever adding or reviewing tests. The installable
entrypoint is **`mobile-testing`** — open the matching reference from that
skill instead of loading separate peer skills.

Canonical copy is also installed as `knowledge/testing-layers.md`.

## Decision tree

```
What are you testing?
├─ Screen / view / UI behavior via app state
│  → ComponentName.view.test.tsx → references/component-view.md
│  → If the CV framework cannot cover the case yet:
│     → Smallest focused unit test + note why CV cannot → references/unit.md
│
├─ App-to-controller seam / controller flow with I/O isolated
│  → *.integration.test.ts → references/integration.md
│
├─ Pure logic / helpers / narrow component contracts
│  → Focused unit test → references/unit.md
│
└─ Full device journey
   → Default: Appium (tests/smoke-appium/) → references/appium-e2e.md
   → Remaining Detox suite / migration only → references/detox-to-appium.md
```

## Defaults

| Layer | Owns | File pattern |
| --- | --- | --- |
| **Component-view** | Screen visibility, presses, nav, Redux/stream-driven UI | `*.view.test.tsx` |
| **Integration** | Real controllers/providers/services; mock I/O only | `*.integration.test.ts` |
| **Unit** | Pure helpers, selectors, reducers, CV fallback | `*.test.ts(x)` |
| **Appium E2E** | Multi-screen / device journeys (default) | `tests/smoke-appium/**/*.spec.ts` |
| **Detox E2E** | Nearly deprecated — migrate or maintain unmigrated suites only | `tests/smoke/`, `tests/regression/` |

## Smell / avoid

Broad `*.test.tsx` files that render a whole screen and mock hooks/selectors to
assert UI behavior. Convert those to `*.view.test.tsx` (or keep a minimal unit
test only when CV cannot cover, with an explicit reason).

Do **not** use E2E as the primary coverage for a single view when CV can cover it.

## Coverage during conversion

Converting broad unit screen tests to component-view must preserve the same
coverage intent. If a scenario cannot move to CV, document why and keep the
smallest focused unit test needed.

## Placement audits

For inventory → disposition → optional implement across layers (Jira / path /
PR), open [`placement.md`](placement.md). Default mode is analyze-only.
