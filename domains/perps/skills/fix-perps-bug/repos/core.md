---
repo: core
parent: fix-perps-bug
---

## File Paths

| Area | Path |
|---|---|
| Package | `packages/perps-controller/` |
| Controller | `packages/perps-controller/src/PerpsController.ts` |
| Providers | `packages/perps-controller/src/providers/` |
| Services | `packages/perps-controller/src/services/` |
| Types | `packages/perps-controller/src/types/` |
| Utils | `packages/perps-controller/src/utils/` |
| Tests | `packages/perps-controller/tests/` |

## Core-Specific Workflow

1. **Classify the bug as shared controller behavior.** If the issue is UI-only, fix it in Mobile or Extension instead. Core fixes should affect provider/service logic, controller state, selectors, formatting utilities, calculations, or package exports.
2. **Preserve the package boundary.** Do not import Mobile/Extension UI/runtime helpers into `@metamask/perps-controller`; keep the implementation platform-agnostic and dependency-light.
3. **Fix the smallest shared contract.** Prefer targeted changes in providers, services, selectors, or utils. Avoid broad refactors that make downstream Mobile/Extension sync harder.
4. **Add package tests.** Cover the failing behavior in `packages/perps-controller/tests/` or colocated package test structure. Formatting/calculation bugs must include edge cases from the shared perps formatting rules.
5. **Check downstream impact.** If the fix changes state shape, exported types, selectors, provider semantics, or public package exports, note the required Mobile/Extension follow-up or compatibility behavior.

## Validation

1. `yarn workspace @metamask/perps-controller test`
2. `yarn workspace @metamask/perps-controller build`
3. `yarn workspace @metamask/perps-controller messenger-action-types:check` when controller messenger actions/types changed
4. Relevant lint/changelog checks for touched files and public package changes
