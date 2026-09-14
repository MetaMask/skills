---
name: metrametrics-identity
domain: data
description: Which extension MetaMetrics events are sent without the user's analytics ID, set by the excludeMetaMetricsId option or by an event name starting with Send or Confirm
---

# MetaMetrics Identity on Anonymous Events

Read at `metamask-extension` [`c31416a`](https://github.com/MetaMask/metamask-extension/commit/c31416a47811bc4355a904925021a30f4c5564bb).

## The Mechanism

Each event is sent under the user's analytics ID or under one shared anonymous ID, decided per event:

1. The background `trackEvent` reads `excludeMetaMetricsId` from the event's build options. When it is true, [`applyAnonymousEventOptions`](https://github.com/MetaMask/metamask-extension/blob/c31416a47811bc4355a904925021a30f4c5564bb/app/scripts/controllers/analytics/analytics.ts#L303-L333) sets an `anonymous: true` marker on the event's properties.
2. The platform adapter reads the marker. A marked event is sent with `anonymousId` set to `METAMETRICS_ANONYMOUS_ID` ([`0x0000000000000000`](https://github.com/MetaMask/metamask-extension/blob/c31416a47811bc4355a904925021a30f4c5564bb/shared/constants/metametrics.ts#L777)), and an unmarked one with `userId` set to the analytics ID ([`platform-adapter.ts:345-355`](https://github.com/MetaMask/metamask-extension/blob/c31416a47811bc4355a904925021a30f4c5564bb/app/scripts/controllers/analytics/platform-adapter.ts#L345-L355)).
3. [`enrichEventProperties`](https://github.com/MetaMask/metamask-extension/blob/c31416a47811bc4355a904925021a30f4c5564bb/app/scripts/controllers/analytics/platform-adapter.ts#L137-L172) adds the profile identity properties to unmarked events only, and deletes `profile_id`, `canonical_profile_id` and the marker from marked ones.
4. Some events are renamed on the anonymous path through [`anonymousEventNameOverrides`](https://github.com/MetaMask/metamask-extension/blob/c31416a47811bc4355a904925021a30f4c5564bb/app/scripts/controllers/analytics/platform-adapter.ts#L246), for example the transaction lifecycle events and `SignatureRequested`.

No event is sent while basic functionality is off ([`analytics.ts:351`](https://github.com/MetaMask/metamask-extension/blob/c31416a47811bc4355a904925021a30f4c5564bb/app/scripts/controllers/analytics/analytics.ts#L351)).

## The Name Default

`excludeMetaMetricsId` is not only the caller's choice. An event whose name matches `/^send|^confirm/iu` is marked anonymous unless the caller passes `excludeMetaMetricsId: false` ([`analytics.ts:321-324`](https://github.com/MetaMask/metamask-extension/blob/c31416a47811bc4355a904925021a30f4c5564bb/app/scripts/controllers/analytics/analytics.ts#L321-L324)). The comment above it calls the match a carry-over from the previous implementation.

So a new event whose name begins with `Send` or `Confirm` loses user-level attribution by default. Every such event shares one ID in Segment, and user-level dimensions such as account type or feature flags cannot be joined to it.

## Sensitive Properties

An event carrying `sensitiveProperties` cannot also set `excludeMetaMetricsId: true`. `applyAnonymousEventOptions` throws ([`analytics.ts:307-315`](https://github.com/MetaMask/metamask-extension/blob/c31416a47811bc4355a904925021a30f4c5564bb/app/scripts/controllers/analytics/analytics.ts#L307-L315)), and `trackEvent` catches the error and reports it to Sentry ([`analytics.ts:391-392`](https://github.com/MetaMask/metamask-extension/blob/c31416a47811bc4355a904925021a30f4c5564bb/app/scripts/controllers/analytics/analytics.ts#L391-L392)), so the event is not sent.

## Detection

```bash
git grep -n 'excludeMetaMetricsId: true' -- app shared ui ':!*.test.*'
```

At `c31416a` this returns the phishing-detection, `eth_requestAccounts` and MetaMetrics data-deletion call sites, among others. A new hit, or a new event name beginning with `Send` or `Confirm`, drops the analytics ID from that event. Check that this is intended.
