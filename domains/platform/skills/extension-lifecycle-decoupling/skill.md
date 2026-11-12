---
maturity: experimental
name: extension-lifecycle-decoupling
description: >
  Verify platform lifecycle events before assuming they cause application-level side effects. Use
  when estimating event frequency from service worker eviction, debugging behavior that should
  fire on lock or unlock but does not, or investigating keepalive, timer or state persistence.
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
3. Does relevant state persist across restarts (`chrome.storage.local`, `chrome.storage.session`, IndexedDB)?
4. Are timers alarm-based (persist across SW restart) or `setTimeout`-based (don't)?
5. Is the guard/flag reset by the lifecycle event or by a separate application event?
