# Detox → Appium migration

> **Detox is nearly deprecated.** Do not add new Detox coverage unless the user
> explicitly requires work on an unmigrated Detox suite. Prefer Appium for all
> new device journeys ([`appium-e2e.md`](appium-e2e.md)).

Use this reference when:

- Migrating a Detox smoke/regression spec to Appium
- Fixing or minimally maintaining a remaining Detox suite that is not migrated yet

When Detox is fully removed from Mobile, delete this doc and `references/detox/`.

## Migration workflow

1. Find the Detox spec under `tests/smoke/` or `tests/regression/`.
2. Create the Appium counterpart under `tests/smoke-appium/` with the **same
   folder layout** and feature tag.
3. Keep page-object calls identical when they already use cross-framework
   `Gestures` / `Assertions` / `Matchers`.
4. Apply the Appium wrapper differences (see [`appium-e2e.md`](appium-e2e.md)):
   - `appiumTest` from Playwright fixtures
   - `currentDeviceDetails` into `withFixtures`
   - `loginToAppPlaywright` instead of `loginToApp`
   - Remove Detox-only `device.*` usage
5. If a POM selector/action only works on Detox, update the page object with
   `resolve` / `encapsulated` / `encapsulatedAction` (see mobile
   `docs/testing/e2e-testing.md`).
6. Lint, typecheck, run `yarn appium-smoke:ios` (or android) against a
   **main-e2e** build — see [`appium-e2e.md`](appium-e2e.md) Build and run.
7. After Appium coverage is green, remove or stop extending the Detox twin
   when the team is ready (do not delete Detox specs unless asked).

## Side-by-side

```typescript
// Detox — tests/smoke/accounts/my-feature.spec.ts
describe(SmokeAccounts('My feature'), () => {
  it('does the thing', async () => {
    await withFixtures(
      { fixture: new FixtureBuilder().build(), restartDevice: true },
      async () => {
        await loginToApp();
        await SomePage.tapSomething();
        await Assertions.expectElementToBeVisible(SomePage.result);
      },
    );
  });
});

// Appium — tests/smoke-appium/accounts/my-feature.spec.ts
appiumTest.describe(SmokeAccounts('My feature'), () => {
  appiumTest(
    'does the thing',
    async ({ driver: _driver, currentDeviceDetails }) => {
      await withFixtures(
        {
          fixture: new FixtureBuilder().build(),
          restartDevice: true,
          currentDeviceDetails,
        },
        async () => {
          await loginToAppPlaywright({ scenarioType: 'e2e' });
          await SomePage.tapSomething();
          await Assertions.expectElementToBeVisible(SomePage.result);
        },
      );
    },
  );
});
```

## When you still need Detox docs

Only for unmigrated Detox work. Open nested files under [`detox/`](detox/) as
needed:

| Action | File |
| --- | --- |
| Legacy Detox playbook / golden rules | [`detox/legacy-playbook.md`](detox/legacy-playbook.md) |
| Writing Detox specs | [`detox/writing-tests.md`](detox/writing-tests.md) |
| Page objects / selectors | [`detox/page-objects.md`](detox/page-objects.md) |
| API / feature-flag mocking | [`detox/mocking.md`](detox/mocking.md) |
| Running / debugging Detox | [`detox/running-tests.md`](detox/running-tests.md) |

Banner on those files: nearly deprecated — migrate to Appium when possible.

## Do not

- Recommend Detox as the default for new E2E
- Port Detox debug-build workflows into Appium (Appium needs main-e2e release)
- Add `try/catch` in POM methods while migrating
