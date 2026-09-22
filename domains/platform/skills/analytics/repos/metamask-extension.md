---
repo: metamask-extension
parent: analytics
---

# Analytics — MetaMask Extension

Read at `metamask-extension` [`e81ed46`](https://github.com/MetaMask/metamask-extension/commit/e81ed463b0b0af60a1ef01f9b95b2ed5792a7c2f). A/B enrichment: `docs/ab-testing.md`. How an event loses the user's analytics ID: `knowledge/metametrics-identity.md`. Tracking-plan governance and Data Council contacts: `knowledge/segment-governance.md`.

## Canonical API

| Role | Path |
|------|------|
| Helper (UI) | `ui/hooks/useAnalytics.ts` → `useAnalytics` |
| Helper (background) | `app/scripts/controllers/analytics/index.ts` → `trackEvent`, `createEventBuilder` |
| Helper (Redux thunks) | `ui/store/actions.ts` → `trackAnalyticsEvent` |
| Event builder | `shared/lib/analytics/create-event-builder.ts` → `createEventBuilder` |
| Event names | `shared/constants/metametrics.ts` → `MetaMetricsEventName` |
| Categories | `shared/constants/metametrics.ts` → `MetaMetricsEventCategory` |
| Anonymous-event marking | `app/scripts/controllers/analytics/analytics.ts` → `applyAnonymousEventOptions` |
| A/B registry | `shared/lib/ab-testing/ab-test-analytics.ts` → `AB_TEST_ANALYTICS_MAPPINGS` |
| Tracking plan | `Consensys/segment-schema` → `tracking-plans/metamask-extension.yaml`, which lists event libraries. Event definitions live in `libraries/events/<library>/` |

`useAnalytics()` returns `trackEvent` and `createEventBuilder` ([`useAnalytics.ts:28-31`](https://github.com/MetaMask/metamask-extension/blob/e81ed463b0b0af60a1ef01f9b95b2ed5792a7c2f/ui/hooks/useAnalytics.ts#L28-L31)). Its `trackEvent` sends the built event to the background through `trackAnalyticsEvent`, which the background maps to `trackEvent` ([`metamask-controller.js:3528`](https://github.com/MetaMask/metamask-extension/blob/e81ed463b0b0af60a1ef01f9b95b2ed5792a7c2f/app/scripts/metamask-controller.js#L3528)).

Every path ends in the background `trackEvent` ([`analytics.ts:344-394`](https://github.com/MetaMask/metamask-extension/blob/e81ed463b0b0af60a1ef01f9b95b2ed5792a7c2f/app/scripts/controllers/analytics/analytics.ts#L344-L394)). It merges the options given to `.build()` with any passed beside the event, applies the anonymous marker, and sends through `AnalyticsController:trackEvent` (`MetricsOptOut` takes a separate path). It catches every error and reports it to Sentry, and the UI hook discards a failed send ([`useAnalytics.ts:56`](https://github.com/MetaMask/metamask-extension/blob/e81ed463b0b0af60a1ef01f9b95b2ed5792a7c2f/ui/hooks/useAnalytics.ts#L56)), so a dropped event raises nothing at the call site.

`MetaMetricsContext` in `ui/contexts/metametrics.tsx` also exposes a `trackEvent`, which takes the older `{ event, category, properties }` payload and builds the same event ([`metametrics.tsx:177-222`](https://github.com/MetaMask/metamask-extension/blob/e81ed463b0b0af60a1ef01f9b95b2ed5792a7c2f/ui/contexts/metametrics.tsx#L177-L222)). Event call sites use `useAnalytics`, and the context serves buffered traces ([metamask-extension#44380 (remove MetaMetricsController shims and finish background migration)](https://github.com/MetaMask/metamask-extension/pull/44380)).

## Requirements

- UI: `useAnalytics` from `ui/hooks/useAnalytics.ts`
- Background: `trackEvent` and `createEventBuilder` from `app/scripts/controllers/analytics`
- Redux thunks in `ui/store/actions.ts`: `trackAnalyticsEvent`
- Event names from `MetaMetricsEventName`, categories from `MetaMetricsEventCategory`
- Properties via `.addProperties(...)`, category via `.addCategory(...)`, options via `.build(options)`. `.build()` accepts `excludeMetaMetricsId`, `matomoEvent`, `environmentType`, `page` and `referrer` ([`create-event-builder.ts:15-22`](https://github.com/MetaMask/metamask-extension/blob/e81ed463b0b0af60a1ef01f9b95b2ed5792a7c2f/shared/lib/analytics/create-event-builder.ts#L15-L22))
- Page title: `useAnalytics` has no `contextPropsIntoEventProperties` option. Add `[MetaMetricsContextProp.PageTitle]: segmentContext.page?.title` to the properties, with `segmentContext` from `useSegmentContext()` ([`about-info.tsx:40-50`](https://github.com/MetaMask/metamask-extension/blob/e81ed463b0b0af60a1ef01f9b95b2ed5792a7c2f/ui/pages/settings/about-tab/about-info.tsx#L40-L50))

An event with `addSensitiveProperties` is sent twice, and cannot also set `excludeMetaMetricsId: true` (`knowledge/metametrics-identity.md`, Sensitive Properties).

UI (`ui/components/app/balance-empty-state/balance-empty-state.tsx`):

```ts
import { useAnalytics } from '../../../hooks/useAnalytics';
import {
  MetaMetricsEventCategory,
  MetaMetricsEventName,
} from '../../../../shared/constants/metametrics';

const { trackEvent, createEventBuilder } = useAnalytics();

const handleAction = useCallback(() => {
  trackEvent(
    createEventBuilder(MetaMetricsEventName.NavBuyButtonClicked)
      .addCategory(MetaMetricsEventCategory.Navigation)
      .addProperties({
        location: 'balance_empty_state',
        text: 'Add funds',
        chainId,
      })
      .build(),
  );
  setIsModalOpen(true);
}, [chainId, trackEvent]);
```

Background, with an anonymous event (`app/scripts/metamask-controller.js`):

```js
import {
  createEventBuilder,
  trackEvent,
} from './controllers/analytics';

trackEvent(
  createEventBuilder(MetaMetricsEventName.ProceedAnywayClicked)
    .addCategory(MetaMetricsEventCategory.Phishing)
    .addProperties({
      url: origin,
      referrer: {
        url: origin,
      },
    })
    .build({
      referrer: {
        url: origin,
      },
      excludeMetaMetricsId: true,
    }),
);
```

Redux thunk (`ui/store/actions.ts`):

```ts
trackAnalyticsEvent(
  createEventBuilder(MetaMetricsEventName.SettingsUpdated)
    .addCategory(MetaMetricsEventCategory.Settings)
    .addProperties({
      stx_opt_in: value,
      prev_stx_opt_in: smartTransactionsOptInStatus,
    })
    .build(),
);
```

`trackAnalyticsEvent` takes the options as its second argument, and `useAnalytics` fills in `environmentType` there. `ui/store/actions.ts` is `@ts-nocheck`, so a thunk call without that argument compiles, and the background then records `environment_type` as `background` ([`analytics.ts:256-265`](https://github.com/MetaMask/metamask-extension/blob/e81ed463b0b0af60a1ef01f9b95b2ed5792a7c2f/app/scripts/controllers/analytics/analytics.ts#L256-L265)).

## Adding an event

1. **Search `MetaMetricsEventName`** ([`metametrics.ts:798-1212`](https://github.com/MetaMask/metamask-extension/blob/e81ed463b0b0af60a1ef01f9b95b2ed5792a7c2f/shared/constants/metametrics.ts#L798-L1212)). The event may already exist under a different phrasing.
2. **Search the tracking plan.** It names an event by the enum's string value, not its key: `AccountAdded = 'Account Added'` is `name: Account Added` in `libraries/events/metamask-account-mgmt/account-added.yaml`.
3. **Add the enum entry**, then the `trackEvent` call. The `Consensys/segment-schema` `CONTRIBUTING.md` asks for an object plus past-tense verb in Title Case (`Wallet Created`) and `snake_case` properties.
4. **Pass `excludeMetaMetricsId: true` to `.build()` only for an event that must not carry the user's identity.** It sends the event under the shared anonymous ID and drops the profile IDs, for every user, not only those who have not opted in. An event whose name matches `/^send|^confirm/iu` gets it by default unless `.build()` receives `excludeMetaMetricsId: false` (`knowledge/metametrics-identity.md`).
5. **Open the `Consensys/segment-schema` pull request before merging, and get it merged before the event ships.** Its `CONTRIBUTING.md` requires two approvals, one from a Data Council delegate, and its workflow attaches an Impact Report to review. At `e81ed46` no workflow in metamask-extension checks an event against the tracking plan, so skipping this step fails nothing (`knowledge/segment-governance.md`).
6. **Register A/B enrichment** if the event belongs to an experiment: add its name to an `ABTestAnalyticsMapping` in `AB_TEST_ANALYTICS_MAPPINGS` ([`ab-test-analytics.ts:19-22`](https://github.com/MetaMask/metamask-extension/blob/e81ed463b0b0af60a1ef01f9b95b2ed5792a7c2f/shared/lib/ab-testing/ab-test-analytics.ts#L19-L22)), as `docs/ab-testing.md` describes.

## Updating an event

- Adding or changing a property: update the event's YAML in `Consensys/segment-schema`, reviewed like a new event.
- Renaming an event: the `Consensys/segment-schema` `README.md` asks first whether historical continuity is needed, which it almost always is for a KPI event. If it is, a Segment Transformation maps the old name to the new one. A property change in the same move also needs a dbt migration.
- Removing an event: confirm no dashboard depends on it. The `Consensys/segment-schema` convention marks an event that powers key dashboards with `kpi: true` under `labels`, and a change to a KPI-labeled event needs a Data Council approval.

## Testing

UI tests mock the hook and keep the real builder, then assert the built event:

```ts
const mockTrackEvent = jest.fn();

jest.mock('../../../hooks/useAnalytics', () => {
  const { createEventBuilder } = jest.requireActual(
    '../../../../shared/lib/analytics/create-event-builder',
  );
  return {
    useAnalytics: () => ({
      trackEvent: mockTrackEvent,
      createEventBuilder,
    }),
  };
});

expect(mockTrackEvent).toHaveBeenCalledWith({
  name: MetaMetricsEventName.EmptyBuyBannerDisplayed,
  properties: {
    category: MetaMetricsEventCategory.Navigation,
    locale: 'en',
    network: 'Goerli',
    referrer: ORIGIN_METAMASK,
    location: 'balance_empty_state',
  },
  sensitiveProperties: {},
});
```

`addCategory` stores the category inside `properties` ([`create-event-builder.ts:72-78`](https://github.com/MetaMask/metamask-extension/blob/e81ed463b0b0af60a1ef01f9b95b2ed5792a7c2f/shared/lib/analytics/create-event-builder.ts#L72-L78)). `build()` drops `undefined` property values and adds an `options` key only when it receives options ([`create-event-builder.ts:106-111`](https://github.com/MetaMask/metamask-extension/blob/e81ed463b0b0af60a1ef01f9b95b2ed5792a7c2f/shared/lib/analytics/create-event-builder.ts#L106-L111)).

`ui/__mocks__/useAnalytics.ts` is a Storybook alias ([`.storybook/main.js:41-49`](https://github.com/MetaMask/metamask-extension/blob/e81ed463b0b0af60a1ef01f9b95b2ed5792a7c2f/.storybook/main.js#L41-L49)), not a Jest manual mock, so a Jest test still mocks the hook itself.

Background tests mock the module the same way (`app/scripts/lib/ramps/trackRampsCheckoutAnalytics.test.ts`):

```ts
jest.mock('../../controllers/analytics', () => ({
  createEventBuilder: jest.requireActual('../../controllers/analytics')
    .createEventBuilder,
  trackEvent: jest.fn(),
}));

const built = jest.mocked(trackEvent).mock.calls[0][0];
expect(built.name).toBe(MetaMetricsEventName.RampsCheckoutOpened);
```

## Review

```bash
git grep -n 'excludeMetaMetricsId: true' -- app shared ui ':!*.test.*'
```

Each hit sends its event under the shared anonymous ID. Confirm the event must not carry identity. A new event name beginning with `Send` or `Confirm` is anonymous by default, so check new names too.

## Reject

- New `MetaMetricsContext.trackEvent` call sites. Use `useAnalytics`
- `excludeMetaMetricsId: true` on an event that needs user identity. It sends the event under the shared anonymous ID for every user
- `excludeMetaMetricsId: true` on an event with sensitive properties. The background throws, reports the error to Sentry, and does not send the event
- `matomoEvent: true` on a new event. The option is for Matomo holdovers that do not conform to the schema ([`metametrics.ts:153-158`](https://github.com/MetaMask/metamask-extension/blob/e81ed463b0b0af60a1ef01f9b95b2ed5792a7c2f/shared/constants/metametrics.ts#L153-L158)), and the background adds `legacy_event: true` to the event ([`analytics.ts:335-342`](https://github.com/MetaMask/metamask-extension/blob/e81ed463b0b0af60a1ef01f9b95b2ed5792a7c2f/app/scripts/controllers/analytics/analytics.ts#L335-L342))
- Shipping an event before its `Consensys/segment-schema` pull request merges. No CI check catches it, so put the tracking-plan PR on the PR checklist
- An event name string at a call site that has no `MetaMetricsEventName` entry
