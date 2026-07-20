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

**Testing layers** (Mobile — canonical policy: testing domain `knowledge/testing-layers.md`, installed beside testing skills):
1. **Component-view** (`*.view.test.tsx`) — **default** for screen/view UI behavior via real app state (`component-view-test` skill)
2. **Unit** (`*.test.ts(x)`) — pure helpers, narrow contracts, or cases CV cannot cover yet (`unit-testing` skill)
3. **E2E** — full device / multi-screen Appium flows (`e2e-test` skill)

Do **not** default to broad RTL unit tests that render a whole screen and mock hooks/selectors. Load **component-view-test** and **unit-testing** as peer skills (same documentation level); choose by layer, not by which skill is more familiar.

**File Organization**:
```
ComponentName/
├── ComponentName.{constants,stories,styles,types}.ts(x)
├── ComponentName.tsx
├── ComponentName.view.test.tsx   # preferred for screen/view behavior
├── ComponentName.test.ts(x)      # focused unit only (see testing-layers)
├── README.md
└── index.ts
```

## Documentation Quick Reference

**Core**: `/docs/readme/` (architecture, testing, debugging, performance, environment, expo-environment, storybook, troubleshooting, expo-e2e-testing, reassure, release-build-profiler)

**Features**: `/docs/` (deeplinks, animations, tailwind, confirmations, confirmation-refactoring) • `app/component-library/README.md` • `tests/MOCKING.md` • `CHANGELOG.md` • `app/core/{Analytics,Engine}/README.md`

**External**: [MetaMask Contributor Docs](https://github.com/MetaMask/contributor-docs) • [TypeScript Guidelines](https://github.com/MetaMask/contributor-docs/blob/main/docs/typescript.md)

**Testing (Mobile, peer layers)**:
- Layers policy: testing domain `knowledge/testing-layers.md` (beside `component-view-test` / `unit-testing` when installed)
- Component-view (default for views): `component-view-test` skill
- Unit (helpers / CV fallback): `unit-testing` skill • [Contributor unit testing docs](https://github.com/MetaMask/contributor-docs/blob/main/docs/testing/unit-testing.md)
- E2E (device journeys): `e2e-test` skill

## Enforcement (MANDATORY)

**Documentation**: Read `.github/guidelines/`, `README.md`, and relevant `/docs` before implementing

**Commands**: ONLY use `.claude/commands/` + yarn command

**Testing**: CV default for views → unit for allowed fallback → e2e for Appium. Load `component-view-test` and `unit-testing` as peers (plus `e2e-test` when needed); follow testing domain `knowledge/testing-layers.md` when those skills are installed.

**Forbidden**: ❌ npm/npx commands
