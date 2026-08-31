# Runtime State Manipulation (Mobile Development Build)

Use `mm cdp` only for advanced runtime inspection or state manipulation of the installed app during a Metro-attached session. This capability is restricted to **development builds** on either iOS or Android. The system connects directly to the Hermes JavaScript runtime through Metro's inspector proxy using `Runtime.evaluate`. Running these commands requires the Metro bundler to be active on `MM_METRO_PORT`.

## Contents

- [CDP Basics (Mobile)](#cdp-basics-mobile)
- [Critical Rules for State Mutation](#critical-rules-for-state-mutation)
- [React Native Fiber Entry Point](#react-native-fiber-entry-point)
- [Read-Only Redux Store Evaluation](#read-only-redux-store-evaluation)
- [Safe Mutation Checklist and Templates](#safe-mutation-checklist-and-templates)
- [Last-Resort Module Discovery](#last-resort-module-discovery)
- [When to Use and Troubleshooting](#when-to-use-and-troubleshooting)

## CDP Basics (Mobile)

The `mm cdp` command sends Chrome DevTools Protocol payloads to the React Native JS thread on the running mobile device.

```bash
yarn mm cdp Runtime.evaluate '{"expression":"JSON.stringify(globalThis.__DEV__)"}'
```

**Requirements:**
- Metro must be active with `MM_METRO_PORT` configured at launch.
- Node 20 requires the `--experimental-websocket` flag passed to the daemon. Node 22 and later support WebSockets natively.

Runtime, controller, or Redux mutations may be in-memory or persisted depending on controller or storage behavior. You must assume persistence until verified and always restore the original state. Run `yarn mm describe-screen` after any mutation to re-sync the accessibility reference map.

## Critical Rules for State Mutation

Before modifying any runtime state, you must adhere to these absolute rules:

1. **Inspect before mutating**: Check current values to confirm the app is in the expected state.
2. **Capture the exact original state**: Always read and back up the original values before applying modifications.
3. **Prefer real controller methods**: Use exposed controller interfaces over direct Redux dispatches whenever possible. Real controller methods handle validation and state propagation safely.
4. **Verify after mutation**: Confirm the modification succeeded with a fresh read and run `yarn mm describe-screen`.
5. **Restore before cleanup**: Revert all changes to their original backed-up values before ending the session.
6. **Never mutate unknown wallet state**: Avoid touching keyring or account states unless your task explicitly commands it.

## React Native Fiber Entry Point

React Native lacks a DOM interface. To access the internal React component tree, query the DevTools global hook directly:

```javascript
var hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
var rid = hook.renderers.keys().next().value;
var root = hook.getFiberRoots(rid).values().next().value;
var fiber = root.current; // Start walking the fiber tree from here
```

Every React fiber node exposes `child`, `sibling`, and `return` properties for tree traversal. The properties `memoizedState` and `memoizedProps` hold the actual values and context bindings.

## Read-Only Redux Store Evaluation

This concise script walks the fiber tree to find the Redux provider and safely reads user configuration. It bypasses missing or protected properties without crashing.

```bash
yarn mm cdp Runtime.evaluate '{"expression":"(function(){var hook=globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;if(!hook)return JSON.stringify(\"hook missing\");var rid=hook.renderers.keys().next().value;var root=hook.getFiberRoots(rid).values().next().value;function find(f){if(!f)return null;if(f.memoizedProps&&f.memoizedProps.store&&typeof f.memoizedProps.store.getState===\"function\")return f.memoizedProps.store;return find(f.child)||find(f.sibling)}var store=find(root.current);if(!store)return JSON.stringify(\"store not found\");var s=store.getState();return JSON.stringify({locale:s.settings&&s.settings.locale,currency:s.settings&&s.settings.currentCurrency})})()","returnByValue":true}'
```

## Safe Mutation Checklist and Templates

When modifying runtime components, you must capture, modify, and restore the state systematically.

### Mutation Checklist
1. Query and store the original state in a temporary task-specific backup key.
2. Call the required controller method or dispatch a scoped action.
3. Query the state again to confirm the new value is active.
4. Call `yarn mm describe-screen` to refresh visual references.
5. Restore the original state using the task-specific backup key before cleanup.

### State Backup and Mutation Template (Pseudocode)
```javascript
// Pseudocode: Identify context, back up original state under a task-specific key, and mutate
(function() {
  var engine = findEngineContext(); // Custom tree search
  if (!engine) return "Engine context not found";

  // 1. Capture and back up the original value under a task-specific key
  var original = engine.<CONTROLLER_NAME>.state.<PROPERTY_NAME>;
  globalThis.__mmStateBackup = globalThis.__mmStateBackup || {};
  globalThis.__mmStateBackup["<TASK_KEY>"] = original;

  // 2. Perform the mutation via controller API
  engine.<CONTROLLER_NAME>.<METHOD_NAME>(<NEW_VALUE>);
  return "Backup created and mutation applied";
})()
```

### State Restoration Template (Pseudocode)
```javascript
// Pseudocode: Restore the original value using the task-specific backup key
(function() {
  if (!globalThis.__mmStateBackup || typeof globalThis.__mmStateBackup["<TASK_KEY>"] === "undefined") {
    return "Restore skipped: no backup found";
  }
  
  var engine = findEngineContext();
  engine.<CONTROLLER_NAME>.<METHOD_NAME>(globalThis.__mmStateBackup["<TASK_KEY>"]);
  
  // Clean up global references: delete the task key first, then delete the namespace if empty
  delete globalThis.__mmStateBackup["<TASK_KEY>"];
  if (Object.keys(globalThis.__mmStateBackup).length === 0) {
    delete globalThis.__mmStateBackup;
  }
  return "State restored successfully";
})()
```

## Last-Resort Module Discovery

Searching the internal module registry is an expensive fallback option. Do not use this as a primary approach.

- **Brute-Force modules**: Scanning `globalThis.__r` is slow and can trigger unexpected module evaluation side effects.
- **Side effects**: Importing arbitrary modules in an active session can initialize services or create conflicting listeners.
- **Guideline**: Only use module scanning if fiber tree traversal fails completely to locate the desired controller context.

## When to Use and Troubleshooting

Use these techniques only when standard UI automation cannot reach the desired test scenario.

### Recommended Operations
- Reading complex UI configuration flags.
- Simulating system settings that lack physical device controls.
- Triggering background updates during visual validation.

### Troubleshooting

| Symptom | Cause | Solution |
|---|---|---|
| UI is unresponsive after dispatching a Redux action | Direct Redux dispatches do not update the underlying controller state | Use the controller methods directly instead of direct Redux dispatch |
| The state walk fails with "hook missing" | The app is running in a production configuration where DevTools hooks are omitted | Use standard UI flows or check the development build configuration |
| The modified value reverted on its own | A background controller updated the state and overwrote your manual change | Check for ongoing sync events or pause the background controller first |
