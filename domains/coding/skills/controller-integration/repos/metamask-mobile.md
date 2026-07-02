---
repo: metamask-mobile
parent: controller-integration
---

# Controller Integration into Engine

## 1. Path decision

| Path | When | Resolve via |
|---|---|---|
| Modular init (default) | New stateful controller | `MESSENGER_FACTORIES` + `*-init.ts`, `messengerClientsByName.<Name>` |
| Stateless service | No persisted state (e.g. an API service) | Same as modular, minus state steps |
| Wallet-owned | Name is one of: AccountsController, ApprovalController, ConnectivityController, KeyringController, NetworkController, RemoteFeatureFlagController, StorageService | `this.#wallet.getInstance('<Name>')` — never an init function |

## 2. Canonical examples (read, don't guess)

| Controller | Copy for |
|---|---|
| `app/core/Engine/controllers/config-registry-controller-init.ts` + `app/core/Engine/messengers/config-registry-controller-messenger.ts` | Default pattern: init fn, messenger + delegate, tests, selector, fixture entry |
| `app/core/Engine/controllers/money-account-upgrade-controller-init.ts` + `.../money-account-upgrade-controller-messenger.ts` | Init messenger, cross-controller delegation, remote-flag init-time gating |
| `app/features/SampleFeature/controllers/sample-petnames-controller-init.ts` | `ONLY_INCLUDE_IF(sample-feature)` fencing only — its tests/selector lag the pattern, do not copy those |

## 3. Ordered steps

| # | File | Action |
|---|---|---|
| 1 | `package.json` | `yarn add @metamask/<name>-controller` (skip if repo-local) |
| 2 | `app/core/Engine/messengers/<name>-controller-messenger.ts` | Create `getXControllerMessenger` (skeleton below). Add `getXControllerInitMessenger` too if init-time gating is needed (own namespace `<Name>Initialization`) |
| 3 | `app/core/Engine/messengers/<name>-controller-messenger.test.ts` | `expect(messenger).toBeInstanceOf(Messenger)` |
| 4 | `app/core/Engine/messengers/index.ts` | Add to `MESSENGER_FACTORIES`: `{ getMessenger, getInitMessenger: noop }` (or the real init messenger fn) |
| 5 | `app/core/Engine/types.ts` | Add to `GlobalActions`, `GlobalEvents`, `MessengerClients`, `EngineState`, `MessengerClientsToInitialize` (+ `RequiredControllers`/`OptionalControllers` if optional) |
| 6 | `app/core/Engine/controllers/<name>-controller-init.ts` | Create `MessengerClientInitFunction` (skeleton below), return `{ controller }` only |
| 7 | `app/core/Engine/controllers/<name>-controller-init.test.ts` | Use `buildMessengerClientInitRequestMock` from `app/core/Engine/utils/test-utils.ts` |
| 8 | `app/core/Engine/constants.ts` | Append `'<Name>:stateChange'` to `BACKGROUND_STATE_CHANGE_EVENT_NAMES`. ⚠️ Copy the exact event name from the package's `Events` type — some emit `:stateChanged` |
| 9 | `app/core/Engine/Engine.ts` | (a) import init fn (b) add to `initFunctions` **after** every controller it depends on — insertion order is init order (c) add to `this.context` (d) add to **both** the destructuring and return object of `get state()` |
| 10 | `app/util/test/initial-background-state.json` | Add default state (run step in §7 verify to get the exact expected value) |
| 11 | `app/selectors/<name>.ts` (+ test) | `state.engine.backgroundState.<Name> ?? getDefault<Name>State()`; derive with `createSelector` |
| 12 | `.github/CODEOWNERS` | Add glob entries for the init and messenger paths |
| 13 | `tests/feature-flags/feature-flag-registry.ts` | Register the flag key, if the controller is remote-flag gated |

### Messenger skeleton (step 2)

```ts
type AllowedActions = MessengerActions<XControllerMessenger>;
type AllowedEvents = MessengerEvents<XControllerMessenger>;

export function getXControllerMessenger(
  messenger: RootMessenger,
): XControllerMessenger {
  const controllerMessenger = new Messenger<'X', AllowedActions, AllowedEvents, RootMessenger>({
    namespace: 'X',
    parent: messenger,
  });

  messenger.delegate({
    messenger: controllerMessenger,
    actions: ['OtherController:getState'],
    events: ['OtherController:stateChange'],
  });

  return controllerMessenger;
}
```

`delegate()` is the runtime authorization — a type union alone does not allow `messenger.call(...)`.

### Init function skeleton (step 6)

```ts
export const xControllerInit: MessengerClientInitFunction<
  XController,
  XControllerMessenger
> = ({ controllerMessenger, persistedState }) => {
  const controller = new XController({
    messenger: controllerMessenger,
    state: persistedState.X,
  });
  return { controller };
};
```

## 4. Deltas

**Stateless service** — skip step 8, step 10, step 11, and the `EngineState`/state-getter parts of steps 5 and 9d. Add the name to `STATELESS_NON_CONTROLLER_NAMES` in `constants.ts`.

**Wallet-owned** — skip steps 2-4, 6-7, and the `MessengerClientsToInitialize` part of step 5. Add `app/core/Engine/wallet-init/instance-options/<name>.ts` (+ test), wire into `initializeWallet`'s `instanceOptions`. In `Engine.ts`, resolve via `this.#wallet.getInstance('<Name>')`; keep steps 5 (types), 8, 9c-d, 10.

## 5. Feature gating

| Idiom | Where | Reference |
|---|---|---|
| Init-time flag subscription | Init messenger `subscribe('RemoteFeatureFlagController:stateChange', ...)` before controller runs expensive work | `money-account-upgrade-controller-init.ts` |
| Selector gating | UI reads a selector composed from `selectRemoteFeatureFlags` | `app/selectors/configRegistry.ts` (`getIsConfigRegistryApiEnabled`) |
| Delegated `getState` | Controller checks flag itself; delegate `RemoteFeatureFlagController:getState`/`:stateChange` on its own messenger | `config-registry-controller-messenger.ts` |
| Build flag | `///: BEGIN:ONLY_INCLUDE_IF(flag)` / `END` — fence types.ts, constants.ts, messengers/index.ts, Engine.ts (import + initFunctions + context + state getter) **consistently** or the fenced build fails to typecheck | `SamplePetnamesController` |

## 6. Silent failures (no type error — verify manually)

| Mistake | Symptom |
|---|---|
| Event name missing from `BACKGROUND_STATE_CHANGE_EVENT_NAMES` | Redux gets the value once at init, then stale forever; nothing persisted; state resets every app restart |
| Wrong event name (`:stateChange` vs `:stateChanged`) | Same as above — subscription never fires |
| Controller missing from `Engine.state` getter | `UPDATE_BG_STATE` writes `undefined` into Redux for that key |
| Calling a non-delegated action | Runtime throw from `@metamask/messenger` at call time |
| Dependency read before it's initialized | `Error: Messenger client requested before it was initialized: <Name>` — move the entry later in `initFunctions` |
| Controller metadata has no `persist: true` key | Redux updates but state never survives restart (silently skipped, logged only) |

## 7. Verify

```bash
yarn jest app/core/Engine/Engine.test.ts -t 'matches initial state fixture'
yarn tsc --noEmit -p tsconfig.json
```
