---
repo: metamask-mobile
parent: analytics
---

# Analytics — MetaMask Mobile

Human-facing file map: `app/core/Analytics/README.md`.

## Canonical API

Two emission paths. Use one of them; do not add a third.

| Role | Path |
|------|------|
| Imperative helper | `app/util/analytics/analytics.ts` → `analytics.trackEvent` |
| Controller messenger | `AnalyticsController:trackEvent` via the Engine / init messenger |
| React hook (same helper) | `app/components/hooks/useAnalytics/useAnalytics.ts` → `useAnalytics` |
| Event builder | `app/util/analytics/AnalyticsEventBuilder.ts` → `AnalyticsEventBuilder.createEventBuilder` |
| Catalog | `app/core/Analytics/` → `EVENT_NAME`, `MetaMetricsEvents` |
| Test factory | `app/util/test/analyticsMock.ts` → `createMockUseAnalyticsHook` |

`useAnalytics()` is the React face of `analytics`. It returns `trackEvent`,
`createEventBuilder`, `identify`, `enable`, `isEnabled`, `getAnalyticsId`,
and data-deletion helpers.

Controllers that already talk to Engine should call
`messenger.call('AnalyticsController:trackEvent', event)` with a built event.

## Require

- UI: platform `useAnalytics` from `app/components/hooks/useAnalytics/useAnalytics.ts`
- Non-React: `analytics.trackEvent`, or `AnalyticsController:trackEvent` on a messenger
- Event names from `EVENT_NAME` / `MetaMetricsEvents`
- Properties via `.addProperties(...).build()`
- Tests: `createMockUseAnalyticsHook`

```ts
import { useAnalytics } from '../../hooks/useAnalytics/useAnalytics';
import { EVENT_NAME } from '../../../core/Analytics';

const { trackEvent, createEventBuilder, identify } = useAnalytics();

trackEvent(
  createEventBuilder(EVENT_NAME.RAMPS_BUTTON_CLICKED)
    .addProperties({ location: 'AccountsMenu' })
    .build(),
);

await identify({ /* traits */ });
```

Non-React:

```ts
import { analytics } from '../../util/analytics/analytics';
import { AnalyticsEventBuilder } from '../../util/analytics/AnalyticsEventBuilder';
import { EVENT_NAME } from '../../core/Analytics';

analytics.trackEvent(
  AnalyticsEventBuilder.createEventBuilder(EVENT_NAME.APP_OPENED)
    .addProperties({ source: 'cold_start' })
    .build(),
);
```

Messenger (controllers):

```ts
initMessenger.call(
  'AnalyticsController:trackEvent',
  AnalyticsEventBuilder.createEventBuilder(EVENT_NAME.APP_OPENED)
    .addProperties({ source: 'cold_start' })
    .build(),
);
```

Prefer `EVENT_NAME.*` strings. `MetaMetricsEvents.*` wrappers (`IMetaMetricsEvent`)
are still valid; `createEventBuilder` copies only `category`. When migrating a
wrapper that used `generateOpt(name, action, description)`, re-apply
`properties.action` and `properties.name` with `addProperties`.

`generateOpt` belongs in catalog modules: `app/core/Analytics/MetaMetrics.events.ts`,
`app/core/Analytics/events/`, and feature-local `<feature>/analytics/events.ts`
(see SampleFeature). Component files import catalog entries; they do not call
`generateOpt` themselves.

Tests mock the hook with the factory, not a hand-built object:

```ts
import { useAnalytics } from '../../hooks/useAnalytics/useAnalytics';
import { createMockUseAnalyticsHook } from '../../../util/test/analyticsMock';
import { AnalyticsEventBuilder } from '../../../util/analytics/AnalyticsEventBuilder';

jest.mock('../../hooks/useAnalytics/useAnalytics');

jest.mocked(useAnalytics).mockReturnValue(
  createMockUseAnalyticsHook({
    trackEvent: mockTrackEvent,
    createEventBuilder: AnalyticsEventBuilder.createEventBuilder,
  }),
);
```

## Reject

- `addSensitiveProperties` — deprecated. New tracking uses `addProperties` only.
  When editing a call site that already uses `addSensitiveProperties`, stop and
  review those fields: drop them, or move them to `addProperties`, whenever
  that is safe. Do not add new sensitive properties to an existing event.
- A feature-owned tracking API between the call site and `analytics` /
  `AnalyticsController:trackEvent` (a second `useAnalytics`, a typed event
  map, an `*Analytics` module, a local `track*` helper). Call the platform
  helper or messenger directly. Existing feature APIs stay; do not add another.
- Reintroducing `useMetrics` (removed) or MetaMetrics internals at call sites
- Dropping `generateOpt` `action` / `name` when migrating `IMetaMetricsEvent` call sites (until the catalog migration lands)
- Hand-built `useAnalytics` mock objects — use `createMockUseAnalyticsHook`
