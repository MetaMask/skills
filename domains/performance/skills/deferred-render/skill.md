---
name: deferred-render
maturity: experimental
description: >-
  Hold heavy below-the-fold sections out of a pushed screen's opening transition in MetaMask Mobile by gating them on the existing `useScreenTransitionComplete()` hook. Use when a pushed screen is slow to transition, navigation feels janky on open, a "Top traders"-style screen mounts expensive rows/feed during the enter animation, or you need to measure opening-transition cost before/after with the local Reassure harness. Covers when to gate, the tab/pushed-screen split, the Reassure eager/held arms, mocking the hook in tests, and TestFlight verification on iPhone. Do not write a new deferral hook or wrapper.
---

# Deferring heavy sections

Keep a pushed screen's opening transition light by mounting its heavy below-the-fold sections only after the transition ends.

## The hook

| Role                     | Path                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| Hook (already in `main`) | `app/components/hooks/useScreenTransitionComplete.ts`                                            |
| Guidance                 | `docs/performance/anti-patterns.md` ("Deferring a heavy section until the push transition ends") |
| Reference integrations   | `MoneyHomeView`, `PerpsMarketDetailsView`, `TokenDetails`, `SocialV0View`, `SocialV1View`        |

`useScreenTransitionComplete()` takes no arguments and returns `false` until the screen's opening transition ends (a non-closing `transitionEnd`), or until a 450 ms fallback on a focused screen that never emits it. Then it stays `true`. It is the same hook Card, Ramp OTP and Explore search use to open the keyboard after a push. Do not add another hook, a wrapper component or a `useDeferredRender`: a TestFlight build with this hook alone transitioned fast on a real device (Perps, TokenDetails, Top traders), so the custom `requestAnimationFrame` + `startTransition` gate was dropped.

```tsx
const isTransitionComplete = useScreenTransitionComplete(); // above any early return
// ...
{
  isTransitionComplete ? <HeavySection /> : <SectionPlaceholder />;
}
```

Screens reachable both as a pushed screen and as a tab root have no entering transition on the tab, so do not make the tab wait for the fallback:

```tsx
const isPushedScreen = route.name !== Routes.X.TAB;
const isTransitionComplete = useScreenTransitionComplete();
const isReady = !isPushedScreen || isTransitionComplete;
```

A screen with a variant that does not read the gate: `const isReady = Boolean(variant) || isTransitionComplete;` (still call the hook unconditionally).

## When to use

- A pushed screen mounts heavy sections (long lists, feed/leaderboard rows, chart panels) during the enter transition, and a trace shows the JS thread busy during the push because of that subtree.
- A tabbed/pager screen renders all pages eagerly and the pages past the first mount real content at open.
- You have (or will take) a Reassure measurement of the opening commit.

## When NOT to use

- **First paint stays eager.** Header, summary, chart, banners, tab bar and primary actions are never gated. Gating them shows a broken/empty screen.
- Tiny or cheap sections: a few `Text` rows cost a gate and gain nothing.
- Network-bound waits, or an idle gap between data-ready and content-ready: deferring only adds latency.
- **One call per screen.** Every heavy section gates on the same value. Do not call the hook again inside gated content.
- **Gate data, not `loading`.** Pass an empty constant (`const EMPTY: never[] = []`) while not ready; flipping a child's `loading` prop makes it tear down the subtree it should keep.
- Correctness bugs, list-scroll jank after mount, re-render storms: those are `mms-performance` territory.
- Tabs, modals and `animation: 'none'` screens without the `isPushedScreen` split above.

## Measuring before/after (local Reassure harness, never committed)

Write a local-only `*.perf-test.tsx` with two arms: `eager` (hook mocked to `true`, everything in the opening commit) and `held` (real hook, nothing releases inside the measured window, the cost of the opening commit). `runs: 10`, `warmupRuns: 1`. Mock `app/components/hooks/useScreenTransitionComplete` (named and default export) so `eager` returns `true` and `held` delegates to the real hook. With real timers the 450 ms fallback never fires inside a measured window, so `held` is a clean arm; do not use fake timers around it.

Run `yarn test:reassure:branch` and compare `meanDuration` per arm in `.reassure/current.perf`. The win is `eager` vs `held` on the opening scenario.

Reference numbers (opening commit, with an equivalent custom gate): MoneyHomeView 23.10→8.78 ms, PerpsMarketDetailsView 39.08→26.97 ms, TokenDetails 83.99→24.63 ms, Top traders V0 68.76→3.55 ms, V1 20.50→10.81 ms.

## Tests

- View tests (`*.view.test.tsx`): `testSetupView` already emits `transitionEnd` after a short timeout, so deferred content appears with `findBy*`.
- Unit tests with a hand-rolled navigation mock never emit `transitionEnd` and the hook calls `navigation.addListener` / `isFocused`. Mock the hook instead (`const mockUseScreenTransitionComplete = jest.fn(() => true)`), reset it to `true` in `beforeEach`, and add one test where it returns `false` and the heavy section is absent while the eager chrome is present.

## Workflow

1. Confirm the symptom: janky push, heavy sections below the fold. Measure the `eager` baseline. No number, no deferral.
2. Gate the heavy sections on one `useScreenTransitionComplete()` call, with the `isPushedScreen` split if the screen is also a tab root.
3. Re-measure (`held` vs `eager`) and record the numbers.
4. Run the screen's tests; mock the hook where navigation is hand-mocked.
5. Verify on a real iPhone through the TestFlight workflow, then delete the local harness.

## Verification checklist

- [ ] First paint (header, summary, chart, banners, tab bar) renders eagerly.
- [ ] One hook call per screen; no new deferral hook or wrapper added.
- [ ] A tab root never waits for the fallback.
- [ ] Existing screen tests green; one held-back test added.
- [ ] `eager` vs `held` improved on the opening scenario; numbers recorded before deleting the harness.
- [ ] Device check on iPhone via TestFlight; simulators do not reproduce transition jank faithfully.

## Reject

- A new `useDeferredRender`, `DeferredRender` wrapper, or `requestAnimationFrame` / `setTimeout` / `InteractionManager` delay instead of the existing hook
- Gating header, summary, chart, banners, tab bar or anything that defines first paint
- More than one call per screen, or a second gate inside gated content
- Committing the Reassure harness or its arm mocks
