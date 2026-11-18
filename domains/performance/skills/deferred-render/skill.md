---
name: deferred-render
maturity: experimental
description: >-
  DeferredRender opt-in primitive that holds heavy below-the-fold sections out of a screen's opening transition in MetaMask Mobile. Use when a pushed screen is slow to transition, navigation feels janky on open, a "Top traders"-style screen mounts expensive rows/feed during the enter animation, you want to defer heavy sections with `useDeferredRender` / `<DeferredRender>`, or you need to measure opening-transition cost before/after with the local Reassure harness. Covers mode selection (transition vs paint), the isPushedScreen pattern, Reassure eager/held/flush arms, the eager-mock trick, and TestFlight verification on iPhone.
---

# DeferredRender

Use this skill to keep a screen's opening transition light by deferring heavy below-the-fold sections until one frame after the transition (or first paint).

## Canonical API

| Role | Path |
|------|------|
| Hook / component | `app/components/DeferredRender/` (`useDeferredRender`, `<DeferredRender>`) |
| Docs | `app/components/DeferredRender/README.md` |
| Origin PR | https://github.com/MetaMask/metamask-mobile/pull/38039 |
| Reference integrations | `MoneyHomeView`, `PerpsMarketDetailsView` (+ `PerpsMarketSocialTabs`), `TokenDetails`, `SocialV0View`, `SocialV1View` |

`useDeferredRender({ enabled?, mode?, fallbackMs?, screenId? })` returns `false` until the gate releases, then always `true`.

- `mode: 'transition'` (default, pushed screens): releases one frame after `transitionEnd`, with a `fallbackMs` (450 ms) safety net.
- `mode: 'paint'` (tabs / already-visible surfaces): releases one frame after mount.
- Release runs inside `startTransition`, so it cannot block an incoming tap.
- `screenId` tags a Sentry release span.
- `<DeferredRender>` wraps the hook with a placeholder when a component reads better than an inline boolean.

## When to use

- A pushed screen mounts heavy sections (long lists, feed/leaderboard rows) during the enter transition and the transition janks.
- A tabbed/pager screen renders all pages eagerly; pages past the first mount with real content at open.
- You have (or will take) a Reassure measurement showing the opening-commit cost.

## When NOT to use

- **First paint stays eager.** Header, summary, chart, banners, and the tab bar define the first paint — never gate them. Deferring them shows a broken/empty screen.
- Tiny sections — deferring a few Text rows costs a gate and gains nothing.
- **One gate per screen.** A screen has one opening transition; one `useDeferredRender` call gates all deferred sections on it.
- **No nesting.** Do not mount a `DeferredRender` inside another gate's deferred content — nested gates re-introduce the stall they removed.
- Correctness bugs, list-scroll jank after mount, or re-render storms — those are `mms-performance` territory, not a deferral problem.

## Integration pattern

Pick the mode from how the screen is reached, not from a prop drilled through:

```ts
const isPushedScreen = route.name !== Routes.X.TAB;
const showHeavy = useDeferredRender({
  mode: isPushedScreen ? 'transition' : 'paint',
  screenId: 'RouteName',
});
```

Then gate only the heavy sections:

```tsx
{showHeavy && <HeavySection />}
```

or with the component:

```tsx
<DeferredRender mode={isPushedScreen ? 'transition' : 'paint'} screenId="RouteName">
  <HeavySection />
</DeferredRender>
```

Real integrations to copy: `MoneyHomeView`, `PerpsMarketDetailsView` (gates the `PerpsMarketSocialTabs` social path), `TokenDetails`, `SocialV0View` (gates both PagerView pages), `SocialV1View` (gates `renderPage` inside `renderScene` of the TabView; header + tab bar stay eager).

## Measuring before/after (local Reassure harness — never committed)

Write a local-only `*.perf-test.tsx` with three arms:

| Arm | Gate | What it measures |
|-----|------|------------------|
| `eager` | no deferral | Baseline: everything in the opening commit |
| `held` | gate on, nothing released in the measured window | Opening-commit cost with deferral |
| `flush` | gate on, released during the scenario | Deferred-mount cost |

`runs: 10`, `warmupRuns: 1`. When the shipped screen has no arm switch, mock the DeferredRender module in the test setup so `useDeferredRender` returns `true` for the eager arm and delegates otherwise.

Run with `yarn test:reassure:branch`, then read `meanDuration` / `meanCount` per arm from `.reassure/current.perf`. The win to report is `eager` vs `held` meanDuration on the opening scenario; `flush` shows the deferred work moved out, not away.

Measured reference numbers (opening commit): MoneyHomeView 23.10→8.78 ms, PerpsMarketDetailsView 39.08→26.97 ms, Perps social 46.1→27.5 ms, TokenDetails 83.99→24.63 ms, Top traders V0 68.76→3.55 ms, V1 20.50→10.81 ms.

### Jest caveats

- `react-native-screens` is mocked as plain Views in Jest, so `transitionEnd` never fires; a `focus` event re-arms the 450 ms fallback.
- With real timers the fallback never fires inside a measured window, so `held` is a clean arm. Do not use fake timers around the fallback.

## Workflow

1. Confirm the symptom is opening-transition cost: the screen janks on push, and the heavy sections are below the fold.
2. Measure the baseline with the local Reassure harness (`eager` arm) — no number, no deferral.
3. Add one `useDeferredRender` gate per screen with the `isPushedScreen` mode choice; gate only the heavy sections.
4. Re-measure (`held` vs `eager` on the opening commit) and record the numbers.
5. Run the screen's existing unit tests; fix only deferral-caused breakage with `findBy*` / `waitFor`.
6. Verify on a real iPhone via the TestFlight workflow, then revert the local harness.

## Verification checklist

- [ ] First paint (header, summary, chart, banners, tab bar) renders eagerly — screenshot or unit-assert it.
- [ ] One gate per screen; no gate inside deferred content.
- [ ] Existing screen unit tests green — deferred content may need `findBy*` instead of `getBy*`.
- [ ] Reassure `eager` vs `held` meanDuration improved on the opening scenario; numbers recorded before reverting the local harness.
- [ ] Device check on iPhone via the TestFlight GitHub workflow (see the real-iPhone rule); simulators do not reproduce transition jank faithfully.

## Reject

- Gating header/summary/chart/banners/tab bar or anything that defines first paint
- More than one `useDeferredRender` per screen, or gates nested inside gated content
- `mode: 'paint'` on a pushed screen (transition runs first; you defer too early) or `mode: 'transition'` on a tab (no transition — gate releases on the 450 ms fallback)
- Committing the Reassure harness, arm switches, or DeferredRender mocks
- Reaching for `InteractionManager` / `setTimeout` delays instead of the primitive
