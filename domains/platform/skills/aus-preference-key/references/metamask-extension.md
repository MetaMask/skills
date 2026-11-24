# Extension — new AUS preference key

Find touchpoints with the discovery recipe in `skill.md`, using `agenticCli`
as the exemplar (not `priceAlerts`, which the extension lacks). Expect hits in
`ui/pages/notifications-settings/`, `ui/pages/settings/` (sub-page, registry,
search config), `ui/helpers/constants/routes.ts`, mocks, e2e page objects and
specs, and `app/_locales/en` (and `en_GB`, which the exemplar also has).

## Not compiler-enforced, so easy to miss

- `SETTINGS_TYPE_BY_SECTION` and `NOTIFICATIONS_SETTINGS_SECTION_ROUTES` are full `Record`s: `yarn lint:tsc` flags a miss.
- Not enforced: the config entry in `getNotificationsSettingsSectionConfigs`, the `settings-registry.ts` entry, the `search-config.ts` entries, and the `ROUTES` array entry in `routes.ts`. `settings-registry.test.ts` and `routes.test.ts` catch some; the grep catches the rest.
- `SECTION_CONTENT_BY_TYPE` is `Partial`: add an entry only for custom content. A missed custom entry silently renders the default toggles.
- If the section is build- or flag-gated, copy how `perps` is gated (`getIsPerpsIncludedInBuild()` conditional spreads) in every file that has it.

## Do not copy

- The `NonNullable` cast and its `TODO` on `agenticCli` in `notification-settings-section.tsx`: a workaround for a field that was once optional.
- Messenger allowlists, `metamask-controller.js` bindings, and store actions: get/put are key-agnostic.
- Non-English locales other than the exemplar's pattern.

## Verify

```bash
yarn lint:changed:fix
yarn lint:tsc
yarn test:unit <affected-unit-test-file>
```

Use the diff to identify changed implementation modules. Run only affected unit
and integration tests for those modules and modules that import the changed
code. Do not run the full unit or integration suite, or E2E tests, for this
workflow.

After `yarn install`, follow the dependency workflow in the repo's `AGENTS.md`
(`yarn lint:lockfile:dedupe:fix`, `yarn allow-scripts auto`, `yarn lavamoat:auto`).
Smoke: `yarn start`, Settings → Notifications, confirm the row, its page, and
that toggles persist.
