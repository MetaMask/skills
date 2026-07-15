---
name: mv3-service-worker
domain: platform
description: MV3 service worker lifecycle — Chrome background termination model, MetaMask's idle-termination mitigation, and cold-start failure modes
---

# MV3 Service Worker Lifecycle

## MV2 vs MV3

| Manifest | Background | Default Lifecycle | Mitigated in MetaMask? |
|----------|------------|-------------------|------------------------|
| MV3 (Chrome) | Service Worker | Idle termination after 30s, hard cap ~5 min | Yes — see Idle Termination Mitigation |
| MV2 (Firefox) | Background Page | Always running | N/A |

## Idle Termination Mitigation

`app/scripts/background.js:750-758` runs a 2s `browser.storage.session` write loop. `saveTimestamp` (defined at `background.js:651-655`) writes an ISO timestamp into session storage:

    function saveTimestamp() {
      const timestamp = new Date().toISOString();
      browser.storage.session.set({ timestamp });
    }
    ...
    const SAVE_TIMESTAMP_INTERVAL_MS = 2 * 1000;
    saveTimestamp();
    setInterval(saveTimestamp, SAVE_TIMESTAMP_INTERVAL_MS);

Each `chrome.*` / `browser.*` API call resets the 30s idle timer. At 2s cadence the worker stays alive indefinitely while the extension is active. `storage.session` (not `storage.local`) is deliberate — it is MV3-only, in-memory, and does not accumulate disk writes from a heartbeat.

| Property | Value |
|---|---|
| API | `browser.storage.session.set` (MV3-only, in-memory) |
| Interval | 2000 ms (`SAVE_TIMESTAMP_INTERVAL_MS`) |
| Gate | `PreferencesController.enableMV3TimestampSave !== false` (default true) |
| Inline comment | `background.js:752` — "This keeps the service worker alive" |
| Pattern origin | De facto community consensus, not officially endorsed by Chrome DevRel |
| Re-verify if | Chromium policy change on idle-timer API interactions |

Ongoing idle termination is **not** a live failure mode while the extension is running. Cold starts (browser launch, extension enable/reload, crash recovery) are the actual source of MV3-concentrated failures.

## Verification Discipline

Before attributing an MV3-concentrated error to "idle termination pressure":

1. Verify `background.js:750-758` keepalive loop still exists and `saveTimestamp` still calls a `chrome.*` / `browser.*` API
2. Verify `enableMV3TimestampSave` is not disabled in affected Sentry events
3. Check whether error timing correlates with cold-start events, not idle periods

If any check out, the working hypothesis is cold-start cascade race, not ongoing termination.

## Error Concentration Signal

| Distribution | Conclusion |
|---|---|
| ~50/50 MV3/MV2 | Application bug (affects both contexts equally) |
| 99%+ MV3 only | MV3 service worker lifecycle — check cold-start cascade before assuming idle termination |
| 99%+ MV2 only | Firefox-specific browser behavior |

## Sentry Tag Dimensions

Independent — do not conflate.

| Tag | Meaning |
|-----|---------|
| `environment` | Build configuration (production, staging, development) |
| `installType` | How extension was loaded (normal, development, sideload, admin) |
| `dist` | Manifest version (mv3, mv2) |

A production build can have `installType: development` if loaded unpacked. Filter carefully.

## MV3-Specific Failure Modes

| Failure | Cause | Mitigated? |
|---------|-------|------------|
| Cold-start cascade race (`APP_INIT_ALIVE` sent before UI listener bound) | `app-init.js` → dynamic-import `background.js` → listener registration races against an open port | No |
| `Background connection unresponsive` via ongoing idle termination | Worker idle-killed mid-session | Yes — 2s keepalive loop |
| `Background connection unresponsive` via cold-start latency | Cold start on browser launch + first-flush latency before `startUiSync` | No — keepalive does not apply before worker exists |
| Silent `postMessage` failure | Port disconnected during wake/termination, try/catch swallows error | No |
| In-memory state lost on cold start | New worker instance has empty in-memory state | No (fresh persistence read required) |

## Sentry Diagnostic Instrumentation

| Tag | Purpose | Status |
|-----|---------|--------|
| `uiStartup.receivedAppInitPing` | Distinguishes cold-start cascade race cases; `false` + `ALIVE` received ⇒ `APP_INIT_ALIVE` lost on cold start | Missing on `Background connection unresponsive` path as of 13.26.0 — instrumentation gap, being fixed |
| Phase-specific critical error types (`BACKGROUND_INITIALIZED`, `START_UI_SYNC`) | Distinguishes which startup phase hung | Added by 3-phase startup watchdog (PR #40306) |

## When to Investigate MV3 Separately

- Error volume is 10× higher in Chrome than Firefox
- Error involves background connectivity, keepalive, or startup handshake
- Error disappears when running with the worker kept alive manually
- Error correlates with browser-launch or extension-reload timestamps, not idle gaps
