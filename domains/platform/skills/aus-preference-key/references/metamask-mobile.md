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
yarn jest <each touched non-view test file or dir>
yarn test:view:one <each touched *.view.test.tsx>
yarn lint:tsc
yarn lint
```

After `yarn install`, follow the repo's dependency workflow in its `AGENTS.md`.
