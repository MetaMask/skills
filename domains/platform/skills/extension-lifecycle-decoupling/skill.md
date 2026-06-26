---
maturity: experimental
name: extension-lifecycle-decoupling
description: Verify platform lifecycle events before assuming they cause application-level side effects
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

## MV3 MetaMask Specifics

| Assumption | Reality |
|------------|---------|
| SW eviction triggers lock | No `onSuspend` lock handler — SW eviction does NOT trigger lock |
| Timers lost on SW restart | Auto-lock uses Chrome Alarms API — persists across SW restarts |
| State lost on SW restart | Wallet state persists in `chrome.storage.session` and IndexedDB |
| SW evicts frequently during active use | `background.js:750-758` calls `browser.storage.session.set` every 2s. Each `chrome.*`/`browser.*` call resets the 30s idle timer, so active-session eviction is effectively prevented. Cold starts (browser launch, extension reload) still happen. See `mv3-service-worker` knowledge for mechanism and verification discipline |

## Common Pitfalls

| Mistake | Correct Approach |
|---------|-----------------|
| "SW evicts N times/day → event fires N times/day" | Check if application code has handler for eviction |
| Assume frequency from platform behavior | Grep for actual handler chains in `background.js`, `app-state-controller.ts` |
| Conflate platform restart with application reset | Check which state is persisted vs re-initialized |
| "Keepalive uses `chrome.alarms`" | It does not — keepalive uses `browser.storage.session.set` at 2s cadence. `chrome.alarms` is used separately for auto-lock timers that must persist across SW restart |
