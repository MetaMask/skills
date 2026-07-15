---
maturity: experimental
name: effect-anti-pattern-review
description: Review PR diffs that add or modify `useEffect` for the four systemic React effect anti-patterns
---

# Effect Anti-Pattern Review

**Scope:** Pre-merge review of PRs that add or modify `useEffect` calls. The workflow is a grep-driven checklist against the four patterns catalogued in [`effect-anti-patterns`](../../knowledge/effect-anti-patterns.md).

Applies to both `metamask-extension` and `metamask-mobile`. See overlays for repo-specific paths.

## When To Use

- Reviewing a PR that adds or modifies a `useEffect` call
- Reviewing a PR that adds `setInterval`, `setTimeout`, `fetch`, or `addEventListener` inside a component
- Investigating a "Can't perform a React state update on an unmounted component" warning

## Do Not Use When

- Reviewing selector or render-cascade issues (use [`selector-anti-pattern-review`](../selector-anti-pattern-review/skill.md))
- Reviewing non-React code (background scripts, workers, test utilities)
- Reviewing an effect that is intentionally one-shot with no async work or timers (check patterns below anyway, but most do not apply)

## Workflow

1. **List changed files with `useEffect`.** `git diff --name-only origin/main...HEAD | xargs grep -l 'useEffect'`
2. **Run the [grep checklist](#grep-checklist)** against the changed files.
3. **For each hit, map to a pattern** in [`effect-anti-patterns`](../../knowledge/effect-anti-patterns.md) and apply the fix from the knowledge file.
4. **Block on pattern 1.** `JSON.stringify` in a dependency array is always broken. Do not merge.
5. **Block on pattern 3 without cleanup.** Any `setInterval` / `setTimeout` without a matching `clearInterval` / `clearTimeout` in the cleanup function is blocking.
6. **Require cancellation for async effects.** Any `fetch` / network call inside `useEffect` must use `AbortController`.

## Grep Checklist

| Pattern | Detection | Knowledge ref |
|---|---|---|
| 1. `JSON.stringify` in deps | `grep -rnE 'useEffect.*\[.*JSON\.stringify' <source-dir>` | [§1](../../knowledge/effect-anti-patterns.md#1-jsonstringify-in-dependency-array) |
| 2. State-mirror effect | Hand review — look for `useEffect` that calls `setX` based on other state/props | [§2](../../knowledge/effect-anti-patterns.md#2-useeffect--setstate-state-mirror-pattern) |
| 3. Missing interval/timer cleanup | `grep -rnE 'setInterval\|setTimeout' <source-dir>` then check each effect returns a cleanup | [§3](../../knowledge/effect-anti-patterns.md#3-missing-intervaltimer-cleanup) |
| 4. Missing `AbortController` | `grep -rnB2 -A10 'fetch\(' <source-dir>` within `useEffect` blocks | [§4](../../knowledge/effect-anti-patterns.md#4-missing-abortcontroller-in-async-effects) |

See the repo overlay for the concrete `<source-dir>` path.

## Common Pitfalls

| Mistake | Correct approach |
|---|---|
| Accept `JSON.stringify` in deps because "the effect needs to rerun when X changes" | Destructure to primitives or `useMemo` the object — never stringify |
| Accept a state-mirror effect because "the computation is expensive" | Use `useMemo` for expensive derivations. Effects are for side effects, not state derivation |
| Let `setInterval` ship without cleanup because "the component rarely unmounts" | Cleanup is non-negotiable — unmount frequency doesn't matter, correctness does |
| Treat "can't perform state update on unmounted component" as a cosmetic warning | It is a data race. An old response can overwrite a new one |
| Add a lint rule disable on `react-hooks/exhaustive-deps` | Almost always wrong. Destructure or memoize instead |
| Refactor toward `useEffect` + `setState` because it "feels like state" | You probably do not need an effect. See [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) |
