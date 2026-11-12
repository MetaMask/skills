---
repo: metamask-extension
parent: feature-flags
---

# Feature flags — MetaMask Extension

There is no human-facing doc for version gating. `docs/ab-testing.md` covers A/B flags only.
`AGENTS.md` "Working with Feature Flags" covers build flags and local overrides, not version
gating.

## Canonical API

| Role | Path |
|------|------|
| Helper | `shared/lib/remote-feature-flag-utils.ts` → `getBooleanFeatureFlag`, `validatedVersionGatedFeatureFlag`, `hasMinimumRequiredVersion` |
| Raw flags | `shared/lib/selectors/remote-feature-flags.ts` → `getRemoteFeatureFlags`, `getFeatureFlagThresholdGroups` |
| Selectors | A colocated `feature-flags.ts` per domain, under `ui/selectors/**` or `shared/lib/**` |
| Names | Exported string constants beside the selector that reads them |
| E2E registry | `test/e2e/feature-flags/feature-flag-registry.ts` → `FEATURE_FLAG_REGISTRY` |

`shared/lib/remote-feature-flag-utils.ts` is a port of mobile's
`app/util/remoteFeatureFlag/index.ts` and its own header says so, so the exported names match
mobile. The evaluation differs in one respect that matters: `hasMinimumRequiredVersion`
compares against `packageJson.version`, read from the repo's `package.json` at build time.
There is no native binary version and no `react-native-device-info` equivalent. A flag change
reaches only installs running a build whose code reads the flag, so it cannot change behavior
on an older build.

`getBooleanFeatureFlag(flagValue, defaultValue)` is the usual entry point, at 34 non-test call
sites against 11 for `validatedVersionGatedFeatureFlag`. It takes the fallback as a required
second argument rather than mobile's trailing `?? localFlag`, and it returns a plain boolean
flag unchanged, so one call covers both a boolean and a version-gated object.

`validatedVersionGatedFeatureFlag` returns `boolean | undefined`. Reach for it when the caller
must tell an invalid or absent flag apart from a disabled one.

Progressive rollout wrappers shaped `{ name?, value: { enabled, minimumVersion } }` are
unwrapped by `unwrapVersionGatedFeatureFlag` inside both helpers.

### Two modules export the same three names

`shared/lib/feature-flags/version-gating.ts` also exports `hasMinimumRequiredVersion`,
`validatedVersionGatedFeatureFlag` and the type `VersionGatedFeatureFlag`. An import of either
name compiles against either module, so read the import path before trusting the behavior.

| | `shared/lib/remote-feature-flag-utils.ts` | `shared/lib/feature-flags/version-gating.ts` |
|---|---|---|
| Non-test importers | 14 | 4 |
| `minimumVersion` type | `string` | `string \| null` |
| Wrapper unwrapping | Yes | No |
| Also exports | `getBooleanFeatureFlag`, `isVersionGatedFeatureFlag` | `getBaseSemVerVersion` |

Prefer `shared/lib/remote-feature-flag-utils.ts` for new code. The other module is live and its
four importers are not defects, but it does not unwrap rollout wrappers.

Two further local reimplementations of the same version compare exist and take no new callers:
`isMultichainFeatureEnabled` in `shared/lib/multichain-feature-flags.ts`, and
`isPerpsRemoteConfigSatisfied` in `shared/lib/perps-feature-flags.ts`.

## Requirements

- Evaluate in a selector or a shared predicate. UI and hooks only call
  `useSelector(selectXEnabled)`.
- Map a non-standard remote shape to `{ enabled, minimumVersion }` before calling the helper.
- Register every new remote flag in `FEATURE_FLAG_REGISTRY` with its production default.

A shared predicate over the raw flag bag, when the background needs the same answer:

```ts
import { validatedVersionGatedFeatureFlag } from '../remote-feature-flag-utils';

export const MY_FEATURE_FLAG_NAME = 'myFeature';

export function isMyFeatureEnabled(
  remoteFeatureFlags: Record<string, unknown> | undefined,
): boolean {
  return (
    validatedVersionGatedFeatureFlag(remoteFeatureFlags?.[MY_FEATURE_FLAG_NAME]) ?? false
  );
}
```

Background code reads the bag through the `RemoteFeatureFlagController:getState` messenger
action. Until this session's fetch completes, that state holds the flags persisted from the
previous fetch.

The selector then composes that predicate over `getRemoteFeatureFlags`, which keeps one
version-gate interpretation shared between the UI and the background:

```ts
import { createSelector } from 'reselect';
import { getRemoteFeatureFlags } from '../../../shared/lib/selectors/remote-feature-flags';
import { isMyFeatureEnabled } from '../../../shared/lib/my-domain/feature-flags';

export const selectMyFeatureEnabled = createSelector(
  getRemoteFeatureFlags,
  isMyFeatureEnabled,
);
```

Where no background caller needs the predicate, `getBooleanFeatureFlag` inline is the shorter
and more common form:

```ts
export const selectMyFeatureEnabled = createSelector(
  getRemoteFeatureFlags,
  ({ myFeature }) => getBooleanFeatureFlag(myFeature, false),
);
```

UI:

```ts
const isEnabled = useSelector(selectMyFeatureEnabled);
```

## Adding a flag

1. Export the flag name as a constant beside the selector that reads it.
2. Write the predicate or selector against `getRemoteFeatureFlags`.
3. Add a `FEATURE_FLAG_REGISTRY` entry: `name`, `type`, `inProd`, `productionDefault` and
   `status`. The registry is what `mock-e2e.js` serves, so an unregistered flag reads as
   absent in E2E.
4. Cover the selector with a collocated test.

`getRemoteFeatureFlags` merges manifest flags over controller state, manifest winning, so a
local override goes in `.manifest-overrides.json` under `_flags.remoteFeatureFlags` with
`MANIFEST_OVERRIDES` set in `.metamaskrc`. There is no `OVERRIDE_REMOTE_FEATURE_FLAGS` switch.

## Testing

Collocated unit tests import `packageJson` and build flag values around the real current
version rather than hardcoding one, since the gate reads `package.json`:

```ts
import packageJson from '../../../package.json';

const CURRENT_VERSION = packageJson.version;
```

Cover enabled, disabled, below-minimum, rollout-wrapped, and invalid or absent.
`RemoteFeatureFlagController` is disabled until onboarding completes and while basic
functionality (`useExternalServices`) is off, so those users never fetch and read absent or
last-persisted flags. A failed fetch is only logged, in
`app/scripts/lib/update-remote-feature-flags.ts`.

For E2E, seed state with `withRemoteFeatureFlagController(...)` from
`test/e2e/fixtures/fixture-builder-v2.ts`, or override at runtime with
`manifestFlags.remoteFeatureFlags`. Seeded state never passes through fetching and validating
a flag response. To test that path, serve the response from `testSpecificMock`, which
`test/e2e/mock-e2e.js` registers ahead of its registry default for the `client-config` flags
route.

## Not present in the extension

State these as gaps rather than substituting a near neighbor:

- No `useRemoteFeatureFlag` hook. Consumption is `useSelector` over a selector. The only
  flag-reading hook is `useABTest` in `ui/hooks/useABTest.ts`, which is for A/B assignment and
  exposure events, not version gating.
- No central flag-name registry equivalent to mobile's `FeatureFlagNames`. An enum of that
  name exists at `shared/lib/feature-flags.ts` holding a single member, and it is not where
  flag names live.
- No handling for the multi-version shape `{ versions: { "7.53.0": value } }`. Neither helper
  reads a `versions` key.

## Extension only

- `FEATURE_FLAG_REGISTRY` is the production-default source of truth for E2E. Mobile has no
  counterpart. `.github/workflows/check-feature-flag-registry-drift.yml` checks it against
  production on a weekly schedule (`cron: '0 1 * * 2'`) and not on pull requests, so a new
  flag's `productionDefault` can merge unchecked.
- `getRemoteFeatureFlags` folds manifest overrides in at the selector, so override precedence
  is a property of the read rather than of a build switch.
- Threshold and A/B flags carry a separate `featureFlagThresholdGroups` map, read through
  `getFeatureFlagThresholdGroups`.

## Reject

- New local copies of `hasMinimumRequiredVersion`, or a `semver.gte` against
  `packageJson.version` for flag gating, outside `shared/lib/remote-feature-flag-utils.ts`
- Version checks in hooks or components
- A new remote flag with no `FEATURE_FLAG_REGISTRY` entry
- Importing `validatedVersionGatedFeatureFlag` without checking which of the two modules it
  resolves to

