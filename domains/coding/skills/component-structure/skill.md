---
name: component-structure
description: >-
  How to structure React and React Native components and screens in
  MetaMask Mobile and Extension. Use when writing, splitting or
  refactoring a component or screen, when deciding where state, effects,
  handlers or copy belong, or when reviewing a PR that adds or reshapes
  one. Triggers include many useState calls, useReducer, useEffect with
  async work, useCallback or useMemo, and sub-components in one file.
maturity: experimental
---

# Component Structure

How a React or React Native component is laid out: what lives in the file, in what order, where state and logic go, and when manual memoization is allowed. One set of rules serves two modes: authoring or refactoring a component, and reviewing a PR that adds or reshapes one.

Rules carry stable IDs (R1–R7). Cite the ID in every suggestion and review comment.

## When To Use

- Writing a new component or screen, or splitting an existing one.
- Deciding where state, effects, handlers or derived values belong.
- Reviewing a PR that adds a component or changes its state, effects or memoization.

Rules are criteria plus signals, not thresholds. A signal (for example, more than 3 `useState`) means check the rule, not apply the fix blindly.

Out of scope, and where it goes instead:

| Need | Skill |
|---|---|
| Grep-style review of new `useEffect` in a diff | `mms-effect-antipattern-scan` |
| Fixing React Compiler bailouts | `mms-react-compiler-migration` |
| Splitting a very large file by subject | `mms-decompose-large-files` |
| Creating a new Mobile component from scratch | `mms-component-scaffold` |
| TypeScript, naming and general file layout | `mms-coding-guidelines` |

This skill does not ask for app code to be refactored outside the change being written or reviewed.

## Workflow

1. Read the whole component, not only the diff. Most findings depend on the order and grouping of hooks across the body.
2. Walk R1–R7 in order. For each finding, record file, line range, rule ID and the fix from the rule.
3. Check the rule's exceptions before reporting. A finding that matches an exception is not a finding.
4. Apply the repo overlay below (compiler scope, copy API, navigation, folder layout). It narrows R7 and names the paths for R1 and R3.
5. In review mode, use the Review Checklist. Report only lines the PR adds or reshapes, unless the user asks for a full-file audit.

Before/after snippets for every rule: [references/examples.md](references/examples.md).

### R1 — One component per file

- **Rule.** One component per file. A sub-component gets its own file in a `components/` folder next to the parent. Never declare a component, or a function that returns JSX, inside another component's body.
- **Why.** A component declared in the body is a new type on every render, so React remounts it and drops its state. A module-level sibling does not remount, but its logic cannot be found, tested or reused on its own.
- **Detect.** More than one component (exported or module-level) in a `.tsx` file. A function returning JSX declared inside a component (`renderX`, `const Row = () => <...>`), including an inline render prop (`renderIcon={() => <Icon />}`). A custom hook declared in the component's file is the same signal: move it to `use<Name>.ts`.
- **Fix.** Move the sub-component to `components/<Name>/<Name>.tsx` with its own types and test. Pass data as props. Move a same-file hook to its own `use<Name>.ts`.
- **Exceptions.** Private render helpers at module scope with no state and no hooks, under 20 lines. An inline `.map` callback that renders list items inside the JSX. Story and test files. A thin default-export wrapper that only adds a provider or router around the main component.

### R2 — Fixed body order

- **Rule.** The body follows one order: route params and context; selectors; local state; custom hooks; derived values; effects; handlers; early returns; JSX. Every derived value sits before any early return.
- **Why.** A reader finds anything by position. Derived values after an early return, or inside a `renderX` helper, are spread across the body and invisible from the top.
- **Detect.** A derived `const` after an early `return` or inside a render helper. `useState` or selectors interleaved with effects or handlers. A derived value declared after the handlers.
- **Fix.** Reorder into the sequence above. Move derived values out of render helpers to the derived block.
- **Exceptions.** Hook call order must stay valid; reordering never moves a hook below an early return. Render-time state adjustment from a previous value (`if (x !== prevX) { setPrevX(x); setY(...); }` placed right after the state it adjusts) is the React-recommended pattern, not an R2 or R4 finding.

### R3 — The component is composition

- **Rule.** The component reads state and renders. Async flows, orchestration, analytics sequencing and navigation decisions live in a colocated `use<Screen>` hook that returns `{ state, actions }`.
- **Why.** Flow logic in the body is only testable by rendering the whole screen. A hook is tested on its own, and the component shrinks to layout.
- **Detect.** A handler longer than a few lines; `try/catch` with side effects in the body; one handler that dispatches, tracks analytics and navigates; an inline JSX handler that sets several values or dispatches.
- **Fix.** Extract to `use<Screen>.ts` next to the component, with its own test. The component calls `const { state, actions } = use<Screen>()` and wires `actions.x` to props.
- **Exceptions.** Single-line handlers that call one action or one setter.

### R4 — `useEffect` only for external sync

- **Rule.** `useEffect` only syncs with an external system: subscriptions, native or DOM listeners, imperative APIs. Async reads go through TanStack Query or a dedicated hook. User-triggered logic goes in event handlers. Values computable from props or state are computed during render.
- **Why.** Effects that fetch, chain `setState` or react to one state change by setting another add renders, race on unmount and hide the cause of a change.
- **Detect.** An `async` function declared inside `useEffect`; a manual `cancelled` / `isMounted` flag; a `setState` chain in an effect; an effect that copies a prop or selector into state; an effect that fires analytics or navigation in response to state rather than to an event; a previous-value ref used to detect a change and reset state.
- **Fix.** `useQuery` for async reads. A dedicated hook for non-query async work. Event handlers for user actions. Compute derived values in render. Reset state on identity change with a `key` on the component.
- **Exceptions.** Effects that subscribe and return a cleanup (listeners, timers, native modules). A one-time mount event (for example, a page-view analytics call) when no event handler exists for it; this covers fire-and-forget calls only, not a mount effect that awaits a read and sets state. Render-time state adjustment from a previous value (see R2) is not an effect and not a finding.

### R5 — Mutually exclusive phases are one state

- **Rule.** Phases where only one can hold at a time are one state machine: a single discriminated-union `status` (`'idle' | 'resolving' | 'submitting' | 'failed'`), with phase-specific data on the matching variant. Never separate booleans.
- **Why.** Separate booleans allow impossible combinations (`isLoading && isReady`, `isSubmitting && hasError`), and every reader must work out which wins.
- **Detect.** Two or more booleans or flags where only one should be true at a time. A render that checks several of them in priority order. A setter that clears one flag while setting another. A `view` or mode enum held in state plus separate `loading` / `ready` booleans that gate the same render (the phase is split across them even though one part is already an enum). Flags that step through one transition (open, animating, closed), often with a `setTimeout` between steps.
- **Fix.** One `useState<Status>` (or a reducer whose state is the union), with an exhaustive `switch` on `status` in render.
- **Exceptions.** Values that can legitimately be true together are not phases; see R6. Form-tracking flags (`touched`, `hasSubmitted`, `validationArmed`), input values, search-panel open state and modal, sheet or dialog visibility are not phases. One-way latches (flags that only ever go from false to true) are not phases. A mode computed during render from other values is a derived value, not phase state.

### R6 — Values set together move to a reducer

- **Rule.** Independent state values that the component updates as a group (2 or more setters called together to reach one UI state) move to `useReducer`, with one named action per transition. More than 3 `useState` is a signal to check this, not a mandate.
- **Why.** Each caller must remember the full group. Missing one setter leaves stale state that no type catches.
- **Detect.** The same group of setters called together in more than one handler, effect or callback (for example, reset input, clear error and close a sheet). The groups need not be identical: overlapping subsets of the same fields across handlers count, such as a form value and its validation flags updated together in several change and blur handlers, or a pair like `isResolved` + `resolvedValue` set together at several sites.
- **Fix.** `useReducer` with typed actions (`{ type: 'reset' }`, `{ type: 'submitStarted' }`), so each transition is one `dispatch`. When the group is a form, one state object with a `reset` action is enough.
- **Exceptions.** Values that are never set together stay as separate `useState`. A group set together in only one place. A single mutually exclusive phase goes to R5, not R6: flags that step through one R5 transition are reported under R5 only, even when several handlers set them together.

### R7 — No reflexive manual memoization under React Compiler

- **Rule.** Do not add new `useMemo`, `useCallback` or `React.memo` by default in code that React Compiler compiles. Do not strip existing memoization as part of an unrelated change.
- **Why.** The compiler already memoizes compiled components. Manual memoization adds dependency lists that drift and noise that hides the logic. Removing it in passing can change behavior in files with a compiler bailout.
- **Detect.** New manual memoization in a compiled path without a stated reason. `useCallback` around a pure predicate or a handler only passed to a host element. In a full-file audit, existing manual memoization in a compiled path is also a finding: report it, with the fix applied when the file is restructured.
- **Fix.** Remove it from the new code. When the file is being restructured under R3, the extracted hook follows the same rule.
- **Exceptions.** API contracts that need stable identity (focus-effect callbacks, a debounced or throttled function, a dependency of an external subscription), including a callback whose only use is as the input of such a memo (the function passed to `debounce`); files with a logged compiler bailout; paths the compiler does not cover (see the repo overlay); a measured hot path, proven with `mms-react-render-delta`.

## Review Checklist

One yes/no check per rule. A "no" is a finding; cite the rule ID.

- [ ] **R1** Does the file hold one component, with no component or JSX-returning function declared inside another component's body?
- [ ] **R2** Does the body follow the fixed order, with every derived value before any early return?
- [ ] **R3** Are async flows, orchestration, analytics and navigation decisions in a `use<Screen>` hook rather than in the component body or inline JSX handlers?
- [ ] **R4** Does every `useEffect` sync with an external system, with no async fetch, `cancelled` flag, `setState` chain or state mirroring?
- [ ] **R5** Are mutually exclusive phases one discriminated-union `status`, not separate booleans?
- [ ] **R6** Are setters that are always called together replaced by one `useReducer` action?
- [ ] **R7** Is every new `useMemo` / `useCallback` / `React.memo` in a compiled path (every one, in a full-file audit) covered by a listed exception?

## Lint Candidates

Follow-up only. Nothing here changes ESLint config.

- R1: `react/no-unstable-nested-components` for components declared in a body; `react/no-multi-comp` for more than one component per file.
- R2: a custom rule for a derived `const` declared after an early `return`.
- R4: a custom rule for an `async` function or a `cancelled` / `isMounted` flag inside `useEffect`.
- R7: a custom rule that flags new `useCallback` / `useMemo` in compiler-covered paths, with an allow-list for focus-effect callbacks.

R3, R5 and R6 need judgment and stay review-only.

## Related Skills

- `mms-effect-antipattern-scan`: grep checklist for new `useEffect` in a diff. R4 is the structural rule; that skill is the scan.
- `mms-perf-react-compiler` and `mms-perf-hooks-effects`: performance depth behind R4 and R7.
- `mms-react-compiler-migration`: fixing bailouts; keep linter-requested memoization during that work.
- `mms-decompose-large-files`: splitting a file by subject, before or alongside R1 and R3.
- `mms-component-scaffold`: creating a new Mobile component in the folder layout R1 expects.
- `mms-coding-guidelines`: TypeScript, naming and general file layout.
