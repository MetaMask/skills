---
name: mixpanel-metrics-dev
description: >-
  Reads the Mixpanel / MetaMetrics ID from live AnalyticsController state on a
  Metro-attached MetaMask Mobile dev build using mm cdp. Same Hermes/CDP recipe
  on iOS and Android; mm only launches iOS today. Use when the user asks for the
  Mixpanel ID, MetaMetrics ID, metametrics_id, metametricsId, Mixpanel Live View, or help
  verifying Mixpanel events during Mobile development.
maturity: stable
---

# Mixpanel Metrics (dev)

## When To Use

- The user asks for the Mixpanel ID, MetaMetrics ID, `metametrics_id`,
  `metametricsId`, or Mixpanel Live View.
- The user needs help verifying Mixpanel events during Mobile development.

Do not use for Extension, production/release builds (no Hermes inspector), or
Android until `mm launch` supports it.

## Workflow

Follow the repo overlay (`repos/metamask-mobile.md`).
