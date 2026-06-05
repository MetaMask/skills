---
name: segment-governance
domain: analytics
description: Segment event governance via segment-schema is advisory — no CI enforcement prevents unregistered events from shipping
---

# Segment Event Governance

## Architecture

| Component | Location |
|-----------|----------|
| Tracking plan | `Consensys/segment-schema` → `tracking-plans/metamask-extension.yaml` |
| Event registry | `shared/constants/metametrics.ts` → `MetaMetricsEventName` enum (300+ entries) |
| Review process | `CONTRIBUTING.md` in segment-schema; Data Council review |
| Governance channel | `#metamask-metametrics`, `@consensys/data-council` |

## The Gap

There is **no CI enforcement** in the extension repo. A developer can:

1. Add entry to `MetaMetricsEventName` enum
2. Call `trackEvent` with it
3. Merge and ship to production

...without registering in segment-schema or going through Data Council review.

## Implications

- Schema drift between tracking plan and production events
- No property schema validation for unregistered events
- Billing impact goes unreviewed
- Data Council review is bypassable by omission

## Recommended Fix

CI check that:
1. Parses `MetaMetricsEventName` entries
2. Validates each against `tracking-plans/metamask-extension.yaml`
3. Fails build if event is missing from the plan
