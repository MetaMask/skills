# Runtime State Manipulation

Use `mm cdp` to read and write wallet state mid-session when fixtures and presets don't cover your scenario. All operations use `Runtime.evaluate` against the active extension page. Reads and Redux writes work on every build type. LavaMoat builds block some globals, see [LavaMoat Scuttling](#lavamoat-scuttling).

## Contents

- [CDP Basics](#cdp-basics)
- [LavaMoat Scuttling](#lavamoat-scuttling)
- [Five Operations](#five-operations)
- [Verify State After Mutation](#verify-state-after-mutation)
- [Troubleshooting](#troubleshooting)
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

## LavaMoat Scuttling

LavaMoat builds (`yarn build`, `yarn dist`, `yarn build:test`) scuttle `globalThis` on extension pages. A scuttled global throws when an expression reads it:

```
LavaMoat - property "chrome" of globalThis is inaccessible under scuttling mode.
```

- On a production build, `chrome`, `setInterval` and `MutationObserver` are scuttled. So `chrome.storage.local` calls fail (operation 4).
- Test builds (`--test`) keep `chrome` and `browser`. `setInterval` and `MutationObserver` stay scuttled.
- Builds without LavaMoat (`yarn start`, `yarn build:dev`) scuttle nothing.
- `stateHooks`, `setTimeout`, `JSON` and `Object` stay available. The store lookup in operation 3 works on every build.
- Patching `window.setTimeout` from an expression did not change app timers on a production build.
- The full list of allowed globals is `getScuttleGlobalThisExceptions` in `development/webpack/utils/plugins/LavamoatPlugin/index.ts`.

To poll from an expression, use a recursive `setTimeout` instead of `setInterval`.

## Five Operations

| Operation            | API                                  | Scope                                                    |
| -------------------- | ------------------------------------ | -------------------------------------------------------- |
| Read Redux state     | `stateHooks.getCleanAppState()`      | In-memory UI state (what the user sees)                  |
| Read persisted state | `stateHooks.getPersistedState()`     | On-disk controller state (`chrome.storage.local`)        |
| Write Redux state    | Fiber dispatch via CDP               | Instant UI update, lost on reload                        |
| Write persisted state| `chrome.storage.local.set()` via CDP | Shows only after an extension reload. Fails on production builds |
| Inject in-memory data| Fiber walk + `pushData()` via CDP    | Reaches components that bypass Redux (streams, channels) |

To change what the user sees: write Redux state.
To make changes survive a reload: write persisted state too, or change the state in the background (see operation 4).
For most visual testing: writing Redux state alone is sufficient.
If a component doesn't respond to Redux changes: it reads from an in-memory source — use operation 5.

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

Locate the Redux store via the React fiber tree and dispatch `UPDATE_METAMASK_STATE`.

The UI renders with React 18 `createRoot`. `#app-content` is the root container. It carries a `__reactContainer$<hash>` key, not `__reactFiber$<hash>`. Start from its first child, which carries the `__reactFiber$` key. Walk up `.return` to the react-redux `<Provider>` and take `memoizedProps.store`:

```bash
mm cdp Runtime.evaluate '{"expression":"(function(){var r=document.getElementById(\"app-content\").firstElementChild;var k=Object.keys(r).find(function(k){return k.startsWith(\"__reactFiber$\")});var f=r[k];var store=null;while(f){var st=f.memoizedProps&&f.memoizedProps.store;if(st&&typeof st.dispatch===\"function\"){store=st;break}f=f.return}if(!store)return\"store not found\";var next=JSON.parse(JSON.stringify(store.getState().metamask));next.preferences=Object.assign({},next.preferences,{privacyMode:true});store.dispatch({type:\"UPDATE_METAMASK_STATE\",value:next});return\"ok\"})()","returnByValue":true}'
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
- The store is a prop of the react-redux `<Provider>` (`ui/pages/index.js`), so read `memoizedProps.store`. The old `stateNode.store` check does not match it.
- `UPDATE_METAMASK_STATE` does not persist. Change is lost on reload.
- The next background state update can overwrite the change. See [Troubleshooting](#troubleshooting).
- If the walk returns `"store not found"`, check that you started from `#app-content.firstElementChild` and that the UI has rendered.

### 4. Write Persisted State

Write directly to `chrome.storage.local`. The extension uses a split format where each controller is a separate key tracked by a `manifest` array.

Limits:
- On production builds, `chrome` is scuttled and these snippets throw (see [LavaMoat Scuttling](#lavamoat-scuttling)). They work on test builds and builds without LavaMoat.
- The background reads storage only at startup. A write shows in the UI only after an extension reload (`stateHooks.reloadExtension()`).
- The running background keeps its own state. Its next persist of that controller can overwrite your write.

To change background state without a reload, call the controller in the background:
- Use the UI that already does it, for example a settings toggle. UI actions in `ui/store/actions.ts` send the call through `submitRequestToBackground`. This works on every build.
- On builds with `METAMASK_DEBUG` (`yarn start`, `yarn build:dev`), `stateHooks.submitRequestToBackground` is exposed. It takes a messenger action name and an argument array, the same as in `ui/store/actions.ts`:

  ```bash
  mm cdp Runtime.evaluate '{"expression":"stateHooks.submitRequestToBackground(\"PreferencesController:setPreference\",[\"privacyMode\",true]).then(function(){return \"ok\"})","awaitPromise":true,"returnByValue":true}'
  ```

  The background persists the change and sends the new state to the UI. `yarn build` and `yarn build:test` do not set `METAMASK_DEBUG`, so they do not expose this hook.

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

### 5. Inject Into In-Memory Data Sources (React Fiber Walk)

Some components read from in-memory caches, stream managers, or data channels that are **not in Redux state**. Dispatching `UPDATE_METAMASK_STATE` updates Redux but these components won't re-render because they subscribe to a different data source.

**How to detect this:** After a Redux dispatch, if the component still shows stale data, it reads from an in-memory source — not Redux.

#### Step 1 — Identify the data source

Read the component source to find what hook it uses:
- `useSelector(...)` → reads from Redux → use Write Redux (operation 3)
- `useSomeChannel(...)` / `useSomeStream(...)` → reads from an in-memory provider → needs fiber injection
- `useContext(SomeContext)` → reads from React context → find the provider via fiber walk

#### Step 2 — Find the object via fiber walk

Walk the React fiber tree looking for the target object by its **shape** (the methods and properties it exposes). Shape-matching is more robust than looking for named exports because it works regardless of bundling, minification, or scoping. Start from `#app-content.firstElementChild`, as in operation 3.

```bash
mm cdp Runtime.evaluate '{"expression":"(function(){var r=document.getElementById(\"app-content\").firstElementChild;var k=Object.keys(r).find(function(k){return k.startsWith(\"__reactFiber$\")});var f=r[k];var visited=0;function walk(node){if(!node||visited>500)return null;visited++;var s=node.memoizedState;while(s){if(s.queue&&s.queue.lastRenderedState){var obj=s.queue.lastRenderedState;if(obj&&typeof obj.pushData===\"function\"&&typeof obj.getCachedData===\"function\"){return obj}}s=s.next}if(node.memoizedProps){for(var pk in node.memoizedProps){var pv=node.memoizedProps[pk];if(pv&&typeof pv===\"object\"&&typeof pv.pushData===\"function\"){return pv}}}return walk(node.child)||walk(node.sibling)}var result=walk(f);return result?\"found at fiber \"+visited:\"not found after \"+visited+\" fibers\"})()","returnByValue":true}'
```

**Adapt the detection predicate** to match your target object's shape. Common predicates:

| Target type | Predicate |
|---|---|
| Data channel | `typeof obj.pushData === "function" && typeof obj.getCachedData === "function"` |
| Redux store | `typeof obj.dispatch === "function" && typeof obj.getState === "function"` |
| Stream manager | Check for named channel properties, e.g. `obj.account && typeof obj.account.pushData === "function"` |
| React context value | Match on the unique combination of properties the context provides |

The walk goes down through `.child` and `.sibling`. Context providers rendered above the first DOM element are ancestors of the start fiber, so the walk does not reach them. To find a provider value, walk up `.return` and check `memoizedProps`, as in operation 3.

#### Step 3 — Disconnect the live source

If the data source is fed by a live connection (WebSocket, polling, subscription), disconnect it first to prevent your injected data from being overwritten. TypeScript `private` fields compile to regular JS properties at runtime, so they are accessible:

```javascript
// Inside the Runtime.evaluate expression:
if (channel.unsubscribeFromSource) {
  channel.unsubscribeFromSource();
  channel.unsubscribeFromSource = null;
}
channel.isConnected = false;
```

#### Step 4 — Push data

Call the channel's update method with data matching the expected type:

```javascript
channel.pushData({
  // fields matching the component's expected data shape
});
```

`pushData` updates the internal cache AND notifies all subscribers — React components re-render immediately.

#### Complete example

Find a data channel by shape, disconnect its live source, and inject test data:

```bash
mm cdp Runtime.evaluate '{"expression":"(function(){var r=document.getElementById(\"app-content\").firstElementChild;var k=Object.keys(r).find(function(k){return k.startsWith(\"__reactFiber$\")});var f=r[k];var visited=0;function walk(n){if(!n||visited>500)return null;visited++;var s=n.memoizedState;while(s){if(s.queue&&s.queue.lastRenderedState){var obj=s.queue.lastRenderedState;if(obj&&typeof obj.pushData===\"function\"&&typeof obj.getCachedData===\"function\"){return obj}}s=s.next}var p=n.memoizedProps;if(p){for(var pk in p){var pv=p[pk];if(pv&&typeof pv===\"object\"){if(typeof pv.pushData===\"function\")return pv;for(var ck in pv){if(pv[ck]&&typeof pv[ck].pushData===\"function\")return pv[ck]}}}}return walk(n.child)||walk(n.sibling)}var ch=walk(f);if(!ch)return\"channel not found after \"+visited+\" fibers\";if(ch.unsubscribeFromSource){ch.unsubscribeFromSource();ch.unsubscribeFromSource=null}ch.isConnected=false;ch.pushData({totalBalance:\"10000.00\",unrealizedPnl:\"500.00\",marginUsed:\"2000.00\",spendableBalance:\"8000.00\",withdrawableBalance:\"8000.00\",returnOnEquity:\"0.05\"});return\"data pushed at fiber \"+visited})()","returnByValue":true}'
```

Then `mm describe-screen` and `mm screenshot` to verify the component updated.

#### When to use this vs other operations

| Symptom | Cause | Solution |
|---------|-------|----------|
| Redux dispatch updated state but component shows stale data | Component reads from in-memory source, not Redux | Fiber injection (this section) |
| Feature needs live streaming data but no preset provides it | Data comes from external service via WebSocket/polling | Disconnect source + push mock data via fiber |
| Component shows loading skeleton despite state being set | The in-memory channel's `isInitialLoading` is still true | Push data via `pushData()` — it marks the channel as loaded |

## Verify State After Mutation

```bash
# Check Redux state
mm cdp Runtime.evaluate '{"expression":"stateHooks.getCleanAppState().then(function(s){return JSON.stringify({privacyMode:s.metamask.preferences.privacyMode})})","awaitPromise":true,"returnByValue":true}'

# Check persisted state
mm cdp Runtime.evaluate '{"expression":"stateHooks.getPersistedState().then(function(s){return JSON.stringify({privacyMode:s.data.PreferencesController.preferences.privacyMode})})","awaitPromise":true,"returnByValue":true}'
```

## Troubleshooting

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| Operation 3 returns `"store not found"` | The walk started at `#app-content`. With React 18 it has only `__reactContainer$`, no `__reactFiber$` | Start at `#app-content.firstElementChild` and read `memoizedProps.store` |
| `LavaMoat - property "X" of globalThis is inaccessible under scuttling mode` | The expression reads a scuttled global (`chrome`, `setInterval`, `MutationObserver`) | Use the replacements in [LavaMoat Scuttling](#lavamoat-scuttling) |
| Injected Redux data disappears after a few seconds or after navigation | A background state update replaced the value you changed | Re-apply the data from a `store.subscribe` listener (below) |

### Keep injected Redux data across background updates

The background sends state patches to the UI after each change. The UI applies them to its current Redux state. A patch that replaces a value you changed drops your data. Example: opening a notification calls `markMetamaskNotificationsAsRead`. The background replaces `metamaskNotificationsList`, and the injected notification is gone.

Re-apply the data from a `store.subscribe` listener. This example keeps one injected notification in `metamaskNotificationsList` (find `store` as in operation 3; `n` is your notification object with an `id`):

```javascript
// Inside the Runtime.evaluate expression, after the store lookup:
var busy = false;
function ensure() {
  if (busy) return;
  var list = store.getState().metamask.metamaskNotificationsList || [];
  if (list.some(function (x) { return x.id === n.id; })) return;
  busy = true;
  try {
    var next = JSON.parse(JSON.stringify(store.getState().metamask));
    next.metamaskNotificationsList = [n].concat(list);
    store.dispatch({ type: "UPDATE_METAMASK_STATE", value: next });
  } finally {
    busy = false;
  }
}
ensure();
window.__mmPinUnsub = store.subscribe(ensure);
```

The `busy` flag stops the listener from reacting to its own dispatch.

Clean up when the test is done. Unsubscribe, then remove the injected data:

```javascript
// Inside the Runtime.evaluate expression, after the store lookup:
if (window.__mmPinUnsub) { window.__mmPinUnsub(); window.__mmPinUnsub = null; }
var next = JSON.parse(JSON.stringify(store.getState().metamask));
next.metamaskNotificationsList = (next.metamaskNotificationsList || []).filter(function (x) { return x.id !== n.id; });
store.dispatch({ type: "UPDATE_METAMASK_STATE", value: next });
```

Then read the state again to confirm that no injected items remain.

## When to Use CDP

| Need                                          | Suggested CDP method                                      |
| --------------------------------------------- | --------------------------------------------------------- |
| Read a JS value / `window` property           | `Runtime.evaluate` with `{ "expression": "..." }`        |
| Inspect / traverse DOM                        | `DOM.getDocument`, `DOM.querySelector`                    |
| Capture network traffic                       | `Network.enable`                                          |
| Inject cookies or storage                     | `Network.setCookie`, `Storage.setLocalStorage*`           |
| Low-level input beyond `mm click` / `mm type` | `Input.dispatchKeyEvent`, `Input.dispatchMouseEvent`      |
| Inject data into non-Redux in-memory sources   | Fiber walk + `pushData()` (see [operation 5](#5-inject-into-in-memory-data-sources-react-fiber-walk)) |
