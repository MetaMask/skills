# Mobile — new AUS preference key

Find touchpoints with the discovery recipe in `skill.md`, using `priceAlerts`
(simplest default-UI key) or `agenticCli` as the exemplar. Expect hits under
`app/components/Views/Settings/NotificationsSettings/`, `locales/languages/en.json`
(`app_settings.notifications_opts.*`), `tests/api-mocking/mock-responses/defaults/user-storage.ts`,
and `docs/readme/deeplinking.md`. Hits elsewhere (Assets, Perps, deeplink
constants) usually concern the feature, not the preference.

## Not compiler-enforced, so easy to miss

- `SETTINGS_TYPE_BY_SECTION` and `SECTION_DEFINITIONS` (in `NotificationSettingsSectionContent.tsx`) are full `Record`s over the section type: `yarn lint:tsc` flags a miss.
- Not enforced: the `NOTIFICATION_SETTINGS_SECTIONS` registry entry and `NotificationSettingsSectionSlug` (kebab-case, doubles as the deeplink slug), the locale keys, the API mock, and the deeplink docs.
- Custom UI is the optional `Content` field on a `SECTION_DEFINITIONS` entry.
- `requiresSocialLeaderboard` is socialAI's own flag gate, and `featureNotificationsGateConfig.ts` only matters if the feature uses the gate sheet. Copy them only if the new section needs the same.

## Do not copy

- The `Omit`/`Required` override that makes `agenticCli` required in `useNotificationStoragePreferences.ts`: a workaround for an optional-turned-required field.
- Engine messenger allowlists: get/put are key-agnostic.

## Verify

Mobile's default jest config ignores `*.view.test.*`; view tests need their own command.

```bash
yarn jest <affected-unit-test-file>
yarn test:view:one <affected-view-test-file>
yarn test:integration:one <affected-integration-test-file>
yarn lint:tsc
yarn lint
```

Use the diff to identify changed implementation modules, then select tests for
those modules and modules that import the changed code. Run only affected unit
tests for pure logic or focused contracts, integration tests for changed
app-to-controller behavior, and component-view tests for changed rendered UI.
Component-view tests use `test:view:one` and exercise real Redux state. Do not
run full unit, view, or integration suites, or E2E tests, for this workflow.
Omit test-layer commands when the diff has no affected test at that layer.

After `yarn install`, follow the repo's dependency workflow in its `AGENTS.md`.
