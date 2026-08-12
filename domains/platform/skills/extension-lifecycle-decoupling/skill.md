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
| SW evicts frequently during active use | A keepalive writes `browser.storage.session.set` on a short interval, and each `chrome.*`/`browser.*` call resets the 30s idle timer — so active-session eviction is effectively prevented. Cold starts (browser launch, extension reload) still happen. **Re-verify before relying on it — see below.** See `mv3-service-worker` knowledge for mechanism and verification discipline |

### Re-verify the keepalive before reasoning from it

This row is the only one that depends on a *current implementation detail* rather than on
absent handlers or persistent storage, and it is the one that inverts if the implementation
moves. If the interval grows past the idle timeout, or the keepalive is removed, the honest
answer flips from "eviction is prevented" to "eviction happens routinely" — and a skill that
still asserts the first would be worse than no skill.

Confirm it in the target repo before drawing conclusions:

```bash
# the keepalive writer and its cadence — symbol names, not line numbers
grep -rn "saveTimestamp\|SAVE_TIMESTAMP_INTERVAL_MS" app/scripts/background.js
```

Two things make the conclusion hold, and both must still be true:

1. The interval is **well under the ~30s idle timeout** (last verified: `2 * 1000` ms).
2. The callback performs an **extension API call** — `browser.storage.session.set` — since it
   is the API call that resets the timer, not the timer firing.

If either has changed, treat active-session eviction as live and re-derive the rest of this
table's consequences.

*Verified against `metamask-extension` at `d4dd55f300a` (2026-07-30):
`SAVE_TIMESTAMP_INTERVAL_MS = 2 * 1000`, `setInterval(saveTimestamp, …)`,
`saveTimestamp` calling `browser.storage.session.set`.*

## Common Pitfalls

| Mistake | Correct Approach |
|---------|-----------------|
| "SW evicts N times/day → event fires N times/day" | Check if application code has handler for eviction |
| Assume frequency from platform behavior | Grep for actual handler chains in `background.js`, `app-state-controller.ts` |
| Conflate platform restart with application reset | Check which state is persisted vs re-initialized |
| "Keepalive uses `chrome.alarms`" | It does not — keepalive works by making an extension API call (`browser.storage.session.set`) on a sub-idle-timeout interval. `chrome.alarms` is used separately, for auto-lock timers that must persist across SW restart |
| Citing this skill's keepalive claim without re-checking | It is the one row here that tracks a live implementation detail. Run the grep above; the conclusion inverts if the interval or the API call changes |
