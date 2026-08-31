---
name: analytics
description: >-
  Product analytics and event tracking. Use when adding, migrating, or
  reviewing tracked events, or when writing tests for analytics call sites.
maturity: stable
mandatory: true
---

# Analytics

Use this skill for product event tracking.

## When to use

- Adding or migrating event tracking in UI or non-UI code
- Writing or updating tests for analytics call sites
- Reviewing a PR that introduces or changes tracked events

## Workflow

1. Pick an event name from the catalog.
2. Attach properties on the event builder.
3. Send the built event through the tracking entry point.
4. In tests, mock the analytics hook with the test factory.
