---
repo: metamask-mobile
parent: analytics
---

# Analytics — MetaMask Mobile

Human-facing file map: `app/core/Analytics/README.md`. A/B enrichment SSOT: `docs/ab-testing.md`.

## Canonical API

| Role | Path |
|------|------|
| Helper (non-React) | `app/util/analytics/analytics.ts` → `analytics.trackEvent` |
| Helper (UI) | `app/components/hooks/useAnalytics/useAnalytics.ts` → `useAnalytics` |
| Engine (controllers) | `app/core/Engine/utils/analytics.ts` → `trackEvent`, `buildAndTrackEvent` |
| Event builder | `app/util/analytics/AnalyticsEventBuilder.ts` → `AnalyticsEventBuilder.createEventBuilder` |
| Catalog | `app/core/Analytics/` → `MetaMetricsEvents` (existing sites), `EVENT_NAME` (new catalog names) |
| Typed helpers | `app/util/analytics/actionButtonTracking.ts` (and sibling `*Tracking.ts` files) |
| Test factory | `app/util/test/analyticsMock.ts` → `createMockUseAnalyticsHook`, `createMockEventBuilder` |

`useAnalytics()` returns `trackEvent`, `createEventBuilder`, `identify`, `enable`,
`isEnabled`, `getAnalyticsId`, and data-deletion helpers.

Controllers that already talk to Engine use `trackEvent` / `buildAndTrackEvent`
from `app/core/Engine/utils/analytics.ts` (A/B enrichment + try/catch). Raw
`initMessenger.call('AnalyticsController:trackEvent', …)` skips enrichment:
attach `active_ab_tests` with `createActiveABTestAssignment()` from
`app/util/analytics/activeABTestAssignments.ts`, and keep the Engine-util cast.

`createMockEventBuilder()` default `build()` is
`{ name: 'mock-event', properties: {}, sensitiveProperties: {} }`.

## Requirements

- UI: platform `useAnalytics` from `app/components/hooks/useAnalytics/useAnalytics.ts`
- Non-React: `analytics.trackEvent`
- Controllers: `trackEvent` / `buildAndTrackEvent` from `app/core/Engine/utils/analytics.ts`
- When a typed helper exists in `app/util/analytics/` (`*Tracking.ts`) for this event, call it (do not invent a new feature-local layer)
- Existing call sites keep `MetaMetricsEvents.*`. `EVENT_NAME.*` is for brand-new catalog names. New tracking: add the name in catalog modules, then import it. Reuse a catalog name only when this control is the same interaction as existing call sites (same event, same product meaning).
- Properties via `.addProperties(...).build()`
- UI tests: `createMockUseAnalyticsHook` wrapping `useAnalytics`, including when the file already mocks the hook; `createEventBuilder: jest.fn(() => createMockEventBuilder())`
- Non-React tests: assert `AnalyticsEventBuilder.createEventBuilder` and `analytics.trackEvent` or Engine `trackEvent` / `buildAndTrackEvent`

```ts
import { useAnalytics } from '../../hooks/useAnalytics/useAnalytics';
import {
  ActionButtonType,
  ActionLocation,
  trackActionButtonClick,
} from '../../../../util/analytics/actionButtonTracking';

const { trackEvent, createEventBuilder } = useAnalytics();

trackActionButtonClick(trackEvent, createEventBuilder, {
  action_name: ActionButtonType.SEND,
  action_position: actionPosition,
  button_label: label,
  location: ActionLocation.HOME,
});
```

Non-React:

```ts
import { analytics } from '../../util/analytics/analytics';
import { AnalyticsEventBuilder } from '../../util/analytics/AnalyticsEventBuilder';
import { MetaMetricsEvents } from '../../core/Analytics';

analytics.trackEvent(
  AnalyticsEventBuilder.createEventBuilder(MetaMetricsEvents.APP_OPENED)
    .addProperties({ type: 'cold_start', source: 'direct' })
    .build(),
);
```

Controllers:

```ts
import { buildAndTrackEvent } from '../../core/Engine/utils/analytics';
import { MetaMetricsEvents } from '../../core/Analytics';

buildAndTrackEvent(
  initMessenger,
  MetaMetricsEvents.PROFILE_ACTIVITY_UPDATED.category,
  {
    profile_id: profileId,
    feature_name: 'Contacts Sync',
    action: 'Contacts Sync Contact Updated',
  },
);
```

Messenger escape hatch (skips Engine-util enrichment):

```ts
import type { AnalyticsTrackingEvent as PackageAnalyticsTrackingEvent } from '@metamask/analytics-controller';
import { createActiveABTestAssignment } from '../../util/analytics/activeABTestAssignments';
import { AnalyticsEventBuilder } from '../../util/analytics/AnalyticsEventBuilder';
import { MetaMetricsEvents } from '../../core/Analytics';

const event = AnalyticsEventBuilder.createEventBuilder(
  MetaMetricsEvents.APP_OPENED,
)
  .addProperties({
    type: 'cold_start',
    source: 'direct',
    active_ab_tests: [createActiveABTestAssignment('flagKey', 'treatment')],
  })
  .build();

// Cast needed until @metamask/analytics-controller removes saveDataRecording from its AnalyticsTrackingEvent
(
  initMessenger as typeof initMessenger & {
    call: (
      action: 'AnalyticsController:trackEvent',
      event: PackageAnalyticsTrackingEvent,
    ) => void;
  }
).call(
  'AnalyticsController:trackEvent',
  event as unknown as PackageAnalyticsTrackingEvent,
);
```

`createEventBuilder` copies only `category` from `IMetaMetricsEvent`. When
migrating a wrapper that used `generateOpt(name, action, description)`, re-apply
`properties.action` and `properties.name` with `addProperties`.

`generateOpt` belongs in catalog modules: `app/core/Analytics/MetaMetrics.events.ts`,
`app/core/Analytics/events/`, and feature-local `<feature>/analytics/events.ts`
(see SampleFeature). Component files import catalog entries; they do not call
`generateOpt` themselves.

Tests mock the hook with the factory, not a hand-built object.
Call `createMockUseAnalyticsHook` again in `beforeEach` after
`jest.clearAllMocks()` / `jest.resetAllMocks()` — those wipe mock
implementations.

```ts
import { useAnalytics } from '../../hooks/useAnalytics/useAnalytics';
import {
  createMockUseAnalyticsHook,
  createMockEventBuilder,
} from '../../../util/test/analyticsMock';

jest.mock('../../hooks/useAnalytics/useAnalytics');

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAnalytics).mockReturnValue(
    createMockUseAnalyticsHook({
      trackEvent: mockTrackEvent,
      createEventBuilder: jest.fn(() => createMockEventBuilder()),
    }),
  );
});
```

## Reject

- `addSensitiveProperties` on new tracking. Existing call sites: drop those
  fields only. Moving the last sensitive field into `addProperties` flips
  `isAnonymous` (true iff `sensitiveProperties` is nonempty). Do not relocate
  without human sign-off.
- A feature-owned tracking API between the call site and `analytics` /
  Engine `trackEvent` (a second `useAnalytics`, a typed event map, an
  `*Analytics` module, a local `track*` helper). Files matching `*Tracking.ts`
  under `app/util/analytics/` are the platform typed-helper layer — use them;
  do not add another feature-local one. Existing feature APIs stay.
- Replacing `MetaMetricsEvents.*` at an existing call site with `EVENT_NAME.*`
  unless that site is taking a brand-new catalog name
- Reintroducing `useMetrics` (removed) or MetaMetrics internals at call sites
- Dropping `generateOpt` `action` / `name` when migrating `IMetaMetricsEvent` call sites (until the catalog migration lands)
- Hand-built `useAnalytics` mock objects — use `createMockUseAnalyticsHook`
- Raw `initMessenger.call('AnalyticsController:trackEvent', …)` when Engine
  `trackEvent` / `buildAndTrackEvent` is available (skips A/B enrichment)
- Attaching a new control to a catalog event whose live call sites are a different product (example: `VIEW_ALL_ASSETS_CLICKED` is wallet tokens/NFTs `asset_type`, not a homepage section)
- Firing an existing catalog event at a new lifecycle (example: `TOKEN_DETECTED` on controller init). Add a catalog name for that lifecycle.
