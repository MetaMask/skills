---
repo: metamask-mobile
parent: coding-guidelines
---

# General Coding Guidelines

## Required Reading Before Development

**ALWAYS** check: `.github/guidelines/CODING_GUIDELINES.md` • `README.md` • Relevant `/docs` before coding

**Docs Structure**: `/docs/readme/` (core) • `/docs/` (features) • `README.md` (overview)

## Development Workflow

**Before Starting**: Read README.md → Check coding guidelines → Review relevant docs → Understand architecture

**Code Quality**:

- TypeScript guidelines from contributor docs • Functional components + hooks • PascalCase (components) / camelCase (functions)
- Reusable components/utilities • TSDoc format • Comprehensive tests following testing layers (below)
- Redux selectors: install **selector-patterns** (`yarn skills --include coding/selector-patterns --save`) when writing or updating them.

**Testing layers** (Mobile — canonical policy: testing domain `knowledge/testing-layers.md`, installed beside `mobile-testing`):

1. **Component-view** (`*.view.test.tsx`) — **default** for screen/view UI behavior via real app state
2. **Integration** (`*.integration.test.ts`) — app-to-controller flows with real controllers/providers/services and only the I/O boundary mocked
3. **Unit** (`*.test.ts(x)`) — pure helpers, narrow contracts, or cases CV cannot cover yet
4. **E2E** — justified device/native **Appium** journeys only (after CV + integration)

Do **not** default to broad RTL unit tests that render a whole screen and mock hooks/selectors. Install **`mobile-testing`** and let it route to the matching reference by layer.

**File Organization**:

```
ComponentName/
├── ComponentName.{constants,stories,styles,types}.ts(x)
├── ComponentName.tsx
├── ComponentName.view.test.tsx   # preferred for screen/view behavior
├── ComponentName.integration.test.ts # app-to-controller flow (see testing-layers)
├── ComponentName.test.ts(x)      # focused unit only (see testing-layers)
├── README.md
└── index.ts
```

## Formatting Numbers and Currency

Use the shared formatters from `@metamask/client-utils` for every user-facing currency, number and percent.

- **Components and hooks:** `const { formatCurrency } = useFormatters();` from `app/components/hooks/useFormatters`
- **Utils, selectors and sagas:** `getFormatters()` from the same file (no hook rules)
- **Never** hardcode a locale (`'en-US'`), build `$` + `toFixed(2)` by hand, or create a new `Intl.NumberFormat` for display
- **Deprecated, do not add callers:** `renderFiat` (`app/util/number`), `formatCurrency` (`app/util/confirm-tx`), `formatFiat`, `formatSubscriptionFiat`, Bridge `formatCurrency` (`utils/currencyUtils`)

| Display                           | Use                                                         |
| --------------------------------- | ----------------------------------------------------------- |
| Fiat amount                       | `formatCurrency(value, currency)`                           |
| Fiat that can be tiny (`< $0.01`) | `formatCurrencyWithMinThreshold(value, currency)`           |
| Compact fiat (`$1.2M`)            | `formatCurrencyCompact(value, currency)`                    |
| Token price                       | `formatCurrencyTokenPrice(value, currency)`                 |
| Token amount with symbol          | `formatToken` / `formatTokenQuantity` / `formatTokenAmount` |
| Plain number                      | `formatNumber(value, options?)`                             |
| Percent                           | `formatPercentWithMinThreshold(ratio, options?)`            |
| Date and time                     | `formatDateTime(timestamp, options?)`                       |

**Gotchas**:

- `formatPercentWithMinThreshold` takes a **ratio** (`0.05` → `5.00%`), not a percent. It adds no `+` sign and raises values under 0.01% to `0.01%` with no `<`. Add the sign (and `<` if needed) at the call site.
- `formatCompact` and `formatCurrencyCompact` use `Intl` compact notation, which Hermes may not support. Check on iOS and Android builds before using them.
- Keep domain rounding rules (for example, Bridge minimum received rounds down) as explicit math before calling a formatter.

## Documentation Quick Reference

**Core**: `/docs/readme/` (architecture, testing, debugging, performance, environment, expo-environment, storybook, troubleshooting, expo-e2e-testing, reassure, release-build-profiler)

**Features**: `/docs/` (deeplinks, animations, tailwind, confirmations, confirmation-refactoring) • `app/component-library/README.md` • `tests/MOCKING.md` • `CHANGELOG.md` • `app/core/{Analytics,Engine}/README.md`

**External**: [MetaMask Contributor Docs](https://github.com/MetaMask/contributor-docs) • [TypeScript Guidelines](https://github.com/MetaMask/contributor-docs/blob/main/docs/typescript.md)

**Testing (Mobile)**:

- Entrypoint: `mobile-testing` skill
- Layers policy: testing domain `knowledge/testing-layers.md` (beside `mobile-testing` when installed)
- Component-view / integration / unit / Appium E2E / placement: references inside `mobile-testing`
- Contributor unit docs: [Unit testing](https://github.com/MetaMask/contributor-docs/blob/main/docs/testing/unit-testing.md)

## Enforcement (MANDATORY)

**Documentation**: Read `.github/guidelines/`, `README.md`, and relevant `/docs` before implementing

**Commands**: ONLY use `.claude/commands/` + yarn command

**Testing**: CV default for views → integration for app-to-controller flows → unit for allowed fallback → Appium for justified device journeys. Install `mobile-testing` and follow testing domain `knowledge/testing-layers.md`.

**Forbidden**: ❌ npm/npx commands

**Lint**: No new `eslint-disable`; fix the violation, or state in the same comment why it is unavoidable.
