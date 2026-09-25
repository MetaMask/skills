---
repo: metamask-mobile
parent: mixpanel-metrics-dev
---

# MetaMask Mixpanel Metrics (dev)

Print the Mixpanel / MetaMetrics ID from a running Mobile **dev** build by
reading live `AnalyticsController` state with `mm cdp`. Do not dump state logs,
drive Settings, or add a product log.

Launch and Hermes retry: `.claude/skills/mms-mobile-visual-testing/SKILL.md`.
CDP fiber walk: `.claude/skills/mms-mobile-visual-testing/references/state-manipulation.md`.
Segment / Mixpanel dashboards: `docs/readme/metametrics-debugging.md`.

The ID is injected at Engine init into live controller state
(`engine.backgroundState.AnalyticsController.analyticsId` and `optedIn`).
It is not persisted in Redux. Engine is up on the Login screen, so unlock is
not required.

Metro may log `Analytics Adapter: Privacy plugin added to Segment client` with
`analyticsId`. That is a hint, not the source of truth. Do not grep for the
stale line `MetaMetrics configured with ID`.

## Platform support

Hermes is on both iOS and Android (`hermesEnabled=true` in
`android/gradle.properties`). `mm cdp` is Metro talking to that inspector, so
the ID read is the same JS on both platforms **in theory**.

**In practice `mm` does not work with Android yet.**
`tests/llm-workflow/metamask-provider.ts` rejects `platform: android`:

> Android is not supported in this first-iteration mobile integration.

`yarn mm launch` / `yarn mm cdp` only run on iOS Simulator today. That is a
session-attach limit, not a different Mixpanel-ID recipe. When Android
`mm launch` lands, this skill does not change.

If the user is on Android, quote that rejection and stop. Do not invent `adb`,
share-sheet, or state-logs extraction.

## Workflow

Run from the MetaMask Mobile repository root.

### 1. Preflight

1. `git status --short`. Preserve unrelated changes.
2. If the user is on Android: quote the provider rejection and stop.
3. Confirm Metro is running. Start `yarn watch:clean` if it is not. Confirm a
   development build is installed. Do not install or reset unless the user asks.
4. `yarn mm:doctor` until Xcode, `idb`, `idb_companion`, and a booted simulator
   pass.

Never `--reinstall` or `--reset-app-data`.

### 2. Launch

```bash
yarn mm launch --metro-port 8081
```

Replace `8081` only when Metro uses another port. If `HERMES_TARGET_NOT_FOUND`
or a Hermes health-check fails, run `yarn mm cleanup` and retry the same
launch. Try at most three attempts. Do not CDP until launch succeeds.

### 3. Read AnalyticsController

Readable expression:

```javascript
(function () {
  var hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook) return JSON.stringify({ error: 'no react devtools hook' });
  var rid = hook.renderers.keys().next().value;
  var root = hook.getFiberRoots(rid).values().next().value;
  function find(f) {
    if (!f) return null;
    if (
      f.memoizedProps &&
      f.memoizedProps.store &&
      typeof f.memoizedProps.store.getState === 'function'
    )
      return f.memoizedProps.store;
    return find(f.child) || find(f.sibling);
  }
  var store = find(root.current);
  if (!store) return JSON.stringify({ error: 'store not found' });
  var a = store.getState().engine.backgroundState.AnalyticsController;
  return JSON.stringify({
    analyticsId: a && a.analyticsId,
    optedIn: a && a.optedIn,
  });
})();
```

```bash
yarn mm cdp Runtime.evaluate '{"expression":"(function(){var hook=globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;if(!hook)return JSON.stringify({error:\"no react devtools hook\"});var rid=hook.renderers.keys().next().value;var root=hook.getFiberRoots(rid).values().next().value;function find(f){if(!f)return null;if(f.memoizedProps&&f.memoizedProps.store&&typeof f.memoizedProps.store.getState===\"function\")return f.memoizedProps.store;return find(f.child)||find(f.sibling)}var store=find(root.current);if(!store)return JSON.stringify({error:\"store not found\"});var a=store.getState().engine.backgroundState.AnalyticsController;return JSON.stringify({analyticsId:a&&a.analyticsId,optedIn:a&&a.optedIn})})()","returnByValue":true}'
```

If `analyticsId` is missing, fall back to Engine.context (`state-manipulation.md` Strategy A), then `ctx.AnalyticsController.state`:

```bash
yarn mm cdp Runtime.evaluate '{"expression":"(function(){var hook=globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;if(!hook)return JSON.stringify({error:\"no react devtools hook\"});var rid=hook.renderers.keys().next().value;var root=hook.getFiberRoots(rid).values().next().value;var visited=0;function isCtx(o){return o&&typeof o.AnalyticsController!==\"undefined\"&&typeof o.NetworkController!==\"undefined\"}function search(o,d){if(!o||d>3||typeof o!==\"object\")return null;if(isCtx(o))return o;for(var k in o){try{var v=o[k];if(v&&typeof v===\"object\"){var f=search(v,d+1);if(f)return f}}catch(e){}}return null}function walk(f){if(!f||visited>2000)return null;visited++;var c=search(f.memoizedProps,0)||search(f.stateNode,0);if(c)return c;var h=f.memoizedState;while(h){if(h.memoizedState&&typeof h.memoizedState===\"object\"){c=search(h.memoizedState,0);if(c)return c}h=h.next}return walk(f.child)||walk(f.sibling)}var ctx=walk(root.current);if(!ctx)return JSON.stringify({error:\"Engine.context not found\"});var a=ctx.AnalyticsController&&ctx.AnalyticsController.state;return JSON.stringify({analyticsId:a&&a.analyticsId,optedIn:a&&a.optedIn})})()","returnByValue":true}'
```

Do not invent an ID. If both paths fail, wait once for Engine init and retry.
If it still fails, stop and report the CDP error.

### 4. Report and cleanup

Print:

- Mixpanel / MetaMetrics ID (`analyticsId`)
- `optedIn` — if false, Mixpanel will not receive identified events; tell the
  user to opt in under Settings → Security → MetaMetrics
- Pointer to Mixpanel Live View and the Segment Mobile Dev debugger in
  `docs/readme/metametrics-debugging.md`

Then `yarn mm cleanup` unless the user wants the session kept.

## Guardrails

- Never `--reinstall` / `--reset-app-data`.
- Never dump or Read state-logs JSON.
- Never add a product `__DEV__` log.
- Do not scrape Metro as the source of truth.
- Do not add a second Android extract path.
