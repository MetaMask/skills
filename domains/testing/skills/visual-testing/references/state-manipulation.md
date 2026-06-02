# Runtime State Manipulation

Use `mm cdp` to read and write wallet state mid-session when fixtures and presets don't cover your scenario. All operations use `Runtime.evaluate` against the active extension page and work on every build type.

## Contents

- [CDP Basics](#cdp-basics)
- [Four Operations](#four-operations)
- [Verify State After Mutation](#verify-state-after-mutation)
- [When to Use CDP](#when-to-use-cdp)

## CDP Basics

`mm cdp` sends a raw [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/) command against the active page. Use this **only when structured commands cannot express what you need**.

```bash
mm cdp Runtime.evaluate '{"expression":"document.title"}'
mm cdp Network.enable
mm cdp DOM.getDocument '{"depth":2}' --timeout 60000
```

| Argument        | Description                                                       |
| --------------- | ----------------------------------------------------------------- |
| `<method>`      | CDP method name (e.g., `Runtime.evaluate`, `DOM.getDocument`)     |
| `[params-json]` | Optional JSON object with method-specific parameters              |
| `--timeout`     | Per-command timeout in ms. Default: 30000. Min: 1000. Max: 30000  |

**Blocked methods** (returns `MM_CDP_BLOCKED`): `Browser.close`, `Target.closeTarget`, `Target.disposeBrowserContext`, `Browser.crashGpuProcess`.

CDP calls are **mutating** — run `mm describe-screen` afterward to re-sync the a11y ref map.

## Four Operations

| Operation            | API                                  | Scope                                                    |
| -------------------- | ------------------------------------ | -------------------------------------------------------- |
| Read Redux state     | `stateHooks.getCleanAppState()`      | In-memory UI state (what the user sees)                  |
| Read persisted state | `stateHooks.getPersistedState()`     | On-disk controller state (`chrome.storage.local`)        |
| Write Redux state    | Fiber dispatch via CDP               | Instant UI update, lost on reload                        |
| Write persisted state| `chrome.storage.local.set()` via CDP | Survives reload, eventually reflected in UI              |

To change what the user sees: write Redux state.
To make changes survive a reload: write persisted state too.
For most visual testing: writing Redux state alone is sufficient.

### 1. Read Redux State

```bash
# Full state keys
mm cdp Runtime.evaluate '{"expression":"stateHooks.getCleanAppState().then(s => JSON.stringify(Object.keys(s.metamask).sort()))", "awaitPromise":true, "returnByValue":true}'

# Specific values
mm cdp Runtime.evaluate '{"expression":"stateHooks.getCleanAppState().then(s => JSON.stringify({ privacyMode: s.metamask.preferences?.privacyMode, selectedNetwork: s.metamask.selectedNetworkClientId }))", "awaitPromise":true, "returnByValue":true}'
```

### 2. Read Persisted State

```bash
mm cdp Runtime.evaluate '{"expression":"stateHooks.getPersistedState().then(s => JSON.stringify(Object.keys(s.data)))", "awaitPromise":true, "returnByValue":true}'

# Specific controller
mm cdp Runtime.evaluate '{"expression":"stateHooks.getPersistedState().then(s => JSON.stringify(s.data.PreferencesController))", "awaitPromise":true, "returnByValue":true}'
```

### 3. Write Redux State

Locate the Redux store via the React fiber tree and dispatch `UPDATE_METAMASK_STATE`:

```bash
mm cdp Runtime.evaluate '{"expression":"(function(){var r=document.getElementById(\"app-content\");var k=Object.keys(r).find(function(k){return k.startsWith(\"__reactFiber$\")});var f=r[k];while(f){if(f.stateNode&&f.stateNode.store&&typeof f.stateNode.store.dispatch===\"function\"){var store=f.stateNode.store;var s=store.getState();var next=JSON.parse(JSON.stringify(s.metamask));next.preferences=Object.assign({},next.preferences,{privacyMode:true});store.dispatch({type:\"UPDATE_METAMASK_STATE\",value:next});return\"ok\"}f=f.return}return\"store not found\"})()","returnByValue":true}'
```

**To modify for other state changes**, change the line that modifies `next`:

```javascript
// Toggle privacy mode
next.preferences = Object.assign({}, next.preferences, {privacyMode: true});

// Change a nested controller value
next.PreferencesController = Object.assign({}, next.PreferencesController, {
  preferences: Object.assign({}, next.PreferencesController.preferences, {
    showTestNetworks: true
  })
});
```

Notes:
- The `__reactFiber$` key suffix is a random hash per build. The traversal pattern is stable.
- `UPDATE_METAMASK_STATE` does not persist. Change is lost on reload.
- If the fiber walk fails (e.g., LavaMoat scuttling), returns `"store not found"`.

### 4. Write Persisted State

Write directly to `chrome.storage.local`. The extension uses a split format where each controller is a separate key tracked by a `manifest` array.

```bash
# Modify an existing controller
mm cdp Runtime.evaluate '{"expression":"chrome.storage.local.get([\"PreferencesController\"]).then(function(r){r.PreferencesController.preferences.privacyMode=true;return chrome.storage.local.set(r)})","awaitPromise":true}'

# Add a new controller (must update manifest)
mm cdp Runtime.evaluate '{"expression":"chrome.storage.local.get([\"manifest\"]).then(function(r){var m=r.manifest;if(m.indexOf(\"MyController\")<0)m.push(\"MyController\");return chrome.storage.local.set({manifest:m,MyController:{key:\"value\"}})})","awaitPromise":true}'
```

Storage schema:

```
chrome.storage.local = {
  manifest: ['PreferencesController', 'NetworkController', ...],
  PreferencesController: { preferences: { privacyMode: false, ... }, ... },
  meta: { version: 175, storageKind: 'split' }
}
```

Rules:
- Always read before write. Merge with existing state, never blind-write.
- Update `manifest` when adding new keys. Keys not in the manifest are invisible on next load.
- Do not delete or corrupt `manifest` or `meta`.

## Verify State After Mutation

```bash
# Check Redux state
mm cdp Runtime.evaluate '{"expression":"stateHooks.getCleanAppState().then(function(s){return JSON.stringify({privacyMode:s.metamask.preferences.privacyMode})})","awaitPromise":true,"returnByValue":true}'

# Check persisted state
mm cdp Runtime.evaluate '{"expression":"stateHooks.getPersistedState().then(function(s){return JSON.stringify({privacyMode:s.data.PreferencesController.preferences.privacyMode})})","awaitPromise":true,"returnByValue":true}'
```

## When to Use CDP

| Need                                          | Suggested CDP method                                      |
| --------------------------------------------- | --------------------------------------------------------- |
| Read a JS value / `window` property           | `Runtime.evaluate` with `{ "expression": "..." }`        |
| Inspect / traverse DOM                        | `DOM.getDocument`, `DOM.querySelector`                    |
| Capture network traffic                       | `Network.enable`                                          |
| Inject cookies or storage                     | `Network.setCookie`, `Storage.setLocalStorage*`           |
| Low-level input beyond `mm click` / `mm type` | `Input.dispatchKeyEvent`, `Input.dispatchMouseEvent`      |
