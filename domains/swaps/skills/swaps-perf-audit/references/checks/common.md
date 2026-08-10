# Common — properties every area must hold

Always in scope. Read this file alongside the area file for whatever the audit
is scoped to, and report every ID here in the results table regardless of area.

Nothing lives here unless it is genuinely universal: either a static sweep that
costs seconds and covers the whole tree, or a property that holds for any
component that was instrumented. Everything narrower belongs in an area file.

Conventions, the mergeability rule, and the contribution procedure are in
[`../checks.md`](../checks.md).

## Scenarios

Two scenarios are area-independent. Area files define the rest.

| ID | Scenario | Procedure | What it isolates |
|---|---|---|---|
| COMMON-S0 | **Idle baseline** | Reset, wait 10s, read | Background churn from controller polling and quote refresh. Every other scenario subtracts this. |
| COMMON-S6 | Mount/unmount cycles | Reset once, leave the surface and return 5 times, navigate away, read | Retention — whether teardown releases what mount acquired |

`COMMON-S0` runs first in every audit. Without it there is no baseline to
subtract and no number in the report means anything.

`COMMON-S6` is the one exception to resetting counters per scenario: reset once
at its start and not between cycles. Its counters are cumulative balances, and
a mid-run reset discards the only signal they carry.

## Index

| ID | Check | Scenario | Gate | Status |
|---|---|---|---|---|
| COMMON-R001 | No stylesheet creation during interaction | any interaction scenario | blocking | active |
| COMMON-R002 | Static stylesheets never re-create after mount | COMMON-S0 | blocking | active |
| COMMON-M001 | Mount/unmount cycles leave no subscriptions behind | COMMON-S6 | blocking | active |
| COMMON-M002 | Every interval, listener and subscription has a cleanup | static | blocking | active |
| COMMON-B001 | No main-package `lodash` imports | static | blocking | active |

Every check here has a threshold of `0` or "none", which follows from the
property rather than from a measurement — see the lifecycle table in
[`../checks.md`](../checks.md) for why that makes them active and blocking
without calibration.

## Rendering and styles

### COMMON-R001 — No stylesheet creation during interaction

- **Surfaces:** all — whatever this run instrumented
- **Primitive:** `styleCreate` counter (`../instrumentation.md` Recipe B)
- **Scenario:** every interaction scenario the area defines, with `COMMON-S0`
  subtracted
- **Measure:** `<Component>.styleCreate` attributable delta, for every
  instrumented component
- **Pass:** `0` for all of them
- **Gate:** blocking · **Waivable:** no
- **Why the threshold is what it is:** `StyleSheet.create()` belongs to mount.
  Any creation during interaction means `useStyles` memoization is broken —
  usually a `vars` object literal built inline, or an unstable `styleSheet`
  identity. There is no legitimate reason for a non-zero value here, on any
  surface, which is why this lives in `common`.
- **On failure:** memoize the `vars` object on its real dependencies, or hoist
  the stylesheet. Confirm the instrumentation wrapper itself is stable before
  believing the number — see the stable-identity warning in Recipe B.

### COMMON-R002 — Static stylesheets never re-create after mount

- **Surfaces:** all — whatever this run instrumented
- **Primitive:** `styleCreate` counter (Recipe B)
- **Scenario:** COMMON-S0
- **Measure:** `styleCreate` delta over the 10s idle window, for any component
  whose stylesheet takes no `vars`
- **Pass:** `0`
- **Gate:** blocking · **Waivable:** no
- **Notes:** This doubles as the instrumentation self-test. `QuoteCountdownTimer`
  re-renders once per second by design, so if its `styleCreate` climbs while
  idle, either its stylesheet is being built in the component body or your
  wrapper is unstable. Resolve that before trusting any other number in the run.
- **On failure:** move `StyleSheet.create` to module scope.

## Lifecycle and memory

### COMMON-M001 — Mount/unmount cycles leave no subscriptions behind

- **Surfaces:** every surface with a registered entry path — anything you can
  navigate away from and back to
- **Primitive:** balance counter (`../instrumentation.md` Recipe C)
- **Scenario:** COMMON-S6
- **Measure:** `<name>.balance` after the fifth cycle, having navigated away
  from the surface
- **Pass:** `0` for every balanced pair
- **Gate:** blocking · **Waivable:** no
- **Why the threshold is exact:** a balance counter increments on setup and
  decrements on teardown, so the only correct resting value is zero. A positive
  value is a leaked interval, listener or controller subscription; a negative
  value means teardown runs more often than setup, which is its own bug.
- **On failure:** every `useEffect` that subscribes must return a cleanup that
  unsubscribes, and the cleanup must release the same handle it created.
- **Scope note:** this measures retention of JS-side subscriptions, not heap
  growth. A heap-level check needs a different primitive; see the note at the
  end of Recipe C before writing one.

### COMMON-M002 — Every interval, listener and subscription has a cleanup

- **Surfaces:** all — static, runs in every audit regardless of scope
- **Primitive:** static sweep
- **Scenario:** `static`
- **Measure:**

```bash
BR=app/components/UI/Bridge
rg -n "setInterval|setTimeout" "$BR"
rg -n "addEventListener|addListener|AppState.addEventListener" "$BR"
rg -n "\.subscribe\(" "$BR"
```

- **Pass:** every hit sits inside a `useEffect` whose returned cleanup releases
  the same handle
- **Gate:** blocking · **Waivable:** no
- **Why static:** it is cheap, it catches the leak before `COMMON-S6` has to,
  and it covers the code paths no scenario set exercises — which, given that an
  audit mounts one area, is most of the tree.
- **On failure:** `mms-performance` → `js-memory-leaks.md`.

## Bundle

### COMMON-B001 — No main-package `lodash` imports

- **Surfaces:** all — static, runs in every audit regardless of scope
- **Primitive:** static sweep
- **Scenario:** `static`
- **Measure:** `rg -n "from 'lodash'" app/components/UI/Bridge`
- **Pass:** `0` hits
- **Gate:** blocking · **Waivable:** no
- **Why:** the main package is not tree-shaken here, so one named import pulls
  the whole library into the bundle. `import debounce from 'lodash/debounce'`
  costs nothing extra to write.
- **On failure:** rewrite as a deep import per function.
