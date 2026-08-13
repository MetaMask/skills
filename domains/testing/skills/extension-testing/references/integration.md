# Extension integration tests (stub — v1)

**Status:** Light stub. `test/integration/` exists and is underused. Full writing
guidance is deferred (phase 2).

## When to use (v1)

- Extending an **existing** suite under `test/integration/`
- The behavior is already covered nearby in integration style and unit/E2E would
  be a worse fit

## When not to use (v1)

- New coverage by default → prefer [`unit.md`](unit.md) or
  [`e2e.md`](e2e.md) per `knowledge/extension-testing-layers.md`
- Do not invent a new harness or broad `jest.mock` surface without team agreement

## Pointers

- Suites: `test/integration/**/*.test.tsx`
- Config: `jest.integration.config.js`
- Commands: `yarn test:integration`, `yarn test:integration:coverage`
- Philosophy: `docs/testing.md`

When integration guidance is expanded, this file becomes a router (writing /
harness / reference) similar to Mobile’s `references/integration.md`.
