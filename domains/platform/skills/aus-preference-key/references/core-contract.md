# Core — new AUS preference key

Find every touchpoint with the discovery recipe in `skill.md`. Stable anchors
(symbol names, not lines) in `core`:

- `packages/authenticated-user-storage/src/`: `types.ts` (`NotificationPreferences`), `validators.ts` (`NotificationPreferencesSchema`, per-key schemas, `DEFAULT_*_PREFERENCES`), `index.ts` (explicit exports, no barrels)
- `packages/notification-services-controller/src/NotificationServicesController/NotificationServicesController.ts`: `buildFreshPreferences`
- Fixtures and tests: whatever grep of the existing key finds under `packages/*/tests` and `*.test.ts`

## What to change

1. Type and schema for the key; field on `NotificationPreferences` (optional unless the user chose required); default constant if wanted; explicit export of new types and constants.
2. Add the key to `buildFreshPreferences`.
3. Update every fixture and test the grep finds. `PerpsController.state.test.ts` builds its own minimal blob and only needs the key if it became required.
4. Changelog in `packages/authenticated-user-storage/CHANGELOG.md` under `## Unreleased` → `### Added` (or `### Changed` with `**BREAKING:**` if required), with the PR link added once the PR exists. `@metamaskbot update-changelogs` only generates dependency-bump entries.

## Do not touch

`PerpsController` builds its watchlist PUT with `{ ...prefs, perps: { ...prefs.perps, ... } }`. Do not "clean up" these spreads; they are what preserves unknown keys.

## Verify

Use the diff to select tests. Run only affected unit and integration tests for
changed modules and modules that import the changed code. Do not run full
package test suites or E2E tests for this workflow. Use the package's Jest
command with the selected test file paths, for example:

```bash
yarn workspace <package-name> run jest --no-coverage <test-file>
```

Run the following non-test checks as applicable:

```bash
yarn changelog:validate
yarn lint:oxlint
yarn lint:misc:check
yarn lint:tsc:check
```
