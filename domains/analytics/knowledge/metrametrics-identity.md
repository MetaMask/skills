---
name: metrametrics-identity
domain: analytics
description: isOptIn:true unconditionally strips user identity in MetaMetricsController — always sends as anonymous ID
---

# MetaMetrics Identity Stripping

## The Mechanism

In `MetaMetricsController` (`app/scripts/controllers/metametrics-controller.ts`):

```typescript
if (excludeMetaMetricsId || (isOptIn && !metaMetricsIdOverride)) {
  idType = 'anonymousId';
  idValue = METAMETRICS_ANONYMOUS_ID; // 0x0000000000000000
}
```

When `isOptIn: true` with no `metaMetricsIdOverride`:
- The user's real `metaMetricsId` is discarded
- ALL such events share a single anonymous ID (`0x0000000000000000`) in Segment
- User-level attribution is completely lost

This is **unconditional** — it applies to fully opted-in users with valid IDs, not just anonymous users.

## Intended Use

The onboarding opt-in flow (`creation-successful.tsx`) — where the user hasn't committed to MetaMetrics yet and no `metaMetricsId` has been persisted. The event must fire regardless of opt-in state.

## The Misuse Pattern

Post-opt-in `trackEvent` calls with `{ isOptIn: true }` without `metaMetricsIdOverride`. Defeats the purpose of Segment user-level dimensions (account types, feature flags).

## Detection

```bash
grep -r "isOptIn: true" app/scripts/ ui/ --include="*.ts" --include="*.tsx"
```

Any occurrence outside `creation-successful.tsx` (or the onboarding flow) is suspect.
