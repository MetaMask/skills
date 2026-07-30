---
name: test-layer-placement
description: >
  MetaMask Mobile orchestrator: given a code area, Jira ticket, and/or PR,
  inventory existing unit / component-view / integration / e2e coverage, classify
  each scenario by reason → best layer (knowledge/testing-layers.md), produce a
  disposition plan, and (only when asked) implement tests plus minimal pure
  extracts. Always post a MMQA-2100-style report to Jira and keep the PR
  description updated with a task checklist. Use when placing or auditing tests
  for a screen/folder, working MMQA unit↔CV overlap follow-ups (MMQA-2102+),
  reducing wrong-layer coverage, or when the user mentions test layer placement,
  coverage audit across layers, or “analyze this area for unit/CV/integration/e2e”.
  Default mode is analyze-only; do not implement until the user explicitly asks.
maturity: experimental
---
