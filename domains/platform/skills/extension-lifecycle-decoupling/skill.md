---
maturity: experimental
name: extension-lifecycle-decoupling
description: Verify that a platform lifecycle event actually causes the application-level effect attributed to it, before building on the assumption. Covers MV3 service worker restarts, cold starts, idle termination and the `browser.storage.session` keepalive that mitigates it, and the gap between the worker restarting and application state resetting — indistinguishable in a Sentry breadcrumb, different fixes. Use when an error is blamed on an SW restart, when reasoning about what survives a background restart, or when a fix assumes a lifecycle event fires.
---

# Extension Lifecycle Decoupling

## When To Use

- Estimating event frequency based on service worker eviction
- Debugging behavior that "should" trigger on lock/unlock but doesn't
- Investigating keepalive, timer, or state persistence behavior

## Do Not Use When

- Working on UI-only code with no background process interaction
- The behavior reproduces reliably in development without service worker eviction

## Core Distinction

| Layer | Examples | Characteristics |
|-------|---------|----------------|
| Platform lifecycle | SW eviction, page unload | Infrastructure-level |
| Application lifecycle | Lock, unlock, init | User-level |

These layers are often **decoupled**. The mapping between them is an implementation detail — verify it, don't assume it.

## Verification Checklist

Before claiming a platform lifecycle event causes application behavior:

1. Is there an explicit handler (`onSuspend`, `beforeunload`) that triggers the claimed effect?
2. Is there a keepalive mechanism preventing the lifecycle event?
3. Does relevant state persist across restarts (`chrome.storage.session`, IndexedDB)?
4. Are timers alarm-based (persist across SW restart) or `setTimeout`-based (don't)?
5. Is the guard/flag reset by the lifecycle event or by a separate application event?
