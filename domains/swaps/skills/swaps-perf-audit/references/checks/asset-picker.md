# Area: asset-picker

The token selection surface and everything inside it: the searchable token
list and network filtering.

Read with [`common.md`](common.md), which is always in scope. Conventions, the
check lifecycle, and the contribution procedure are in
[`../checks.md`](../checks.md).

**Why this area carries the most checks.** Every cost here multiplies by list
length. The token list is a `FlashList` of `React.memo` rows, so its
performance is entirely a question of whether that memo survives contact with
the props the parent hands it — and a single unstable prop turns a 12-row
render into a 200-row render. The checks below mostly exist to detect that one
failure mode from several directions.

Most checks here are **provisional**: the property is derived from what the
code does, but the number has not been calibrated on device. Provisional checks
are advisory. Calibrate one and promote it, recording the device and build.

## Surfaces

### token-list — the token selector modal

- **Aliases:** asset picker, token selector, token list, token search, token
  picker, destination token modal, search
- **Entry:** from the swaps screen, tap `select-source-token-selector` → wait
  for `bridge-token-list`
- **Code:** `components/BridgeTokenSelector/BridgeTokenSelector.tsx`,
  `components/TokenSelectorItem.tsx`,
  `components/SwapsTokenSecurityBadge.tsx`, `components/SkeletonItem.tsx`
- **Test IDs:** `bridge-token-search-input`, `bridge-token-list`,
  `bridge-token-selector-empty-state`. Per row:
  `asset-<chainId>-<symbol>`, `token-logo-<symbol>` (or `network-logo-<symbol>`
  for natives), `token-verified-icon-<symbol>`. `SkeletonItem` has none, so a
  loading list is invisible to `describe-screen`.
- **Instrument:** the row (`BridgeTokenSelectorRow` and/or
  `TokenSelectorItem`) plus `BridgeTokenSelector` itself. Two components, no
  more — a row counter fires once per visible row and dominates everything else
  in the output.
- **Scenarios:** COMMON-S0, PICKER-S1, PICKER-S2, PICKER-S3, PICKER-S7,
  COMMON-S6
- **Checks:** PICKER-R001, R002, R003, R005, M001, N001, N002

**List shape, as of writing:** `FlashList` from `@shopify/flash-list` 2.0.2,
`data={displayData}` (memoized), `renderItem={renderToken}`, a stable
`keyExtractor`, `onScroll` with `scrollEventThrottle={16}`, and an inline
`maintainVisibleContentPosition={{ disabled: true }}`. There is **no
`getItemType`, no `estimatedItemSize`, no `extraData` and no `onEndReached`** —
pagination is driven from the scroll handler instead. `renderToken` is wrapped
in `useCallback` but depends on `selectedToken` and `tokenBalanceLayoutConfig`,
so its identity is only as stable as those. There is no section grouping: the
list is one flat array of `BridgeToken | null`, where `null` is a skeleton.

**Known defect shapes to look for, from a static read:**

- `renderToken` passes `onTokenPress={(token) => handleWatchlistTokenPress(token, index)}`
  — an arrow created per row per list render. `BridgeTokenSelectorRow` is
  wrapped in `React.memo` with no custom comparator, so this prop defeats that
  memo for every row. `PICKER-R001` and `PICKER-R002` are the measurements that
  prove or disprove it on device.
- `TokenSelectorItem` calls `useStyles(createStyles, { isSelected })` with an
  inline object literal, in three places. `useStyles` memoizes on the `vars`
  reference, so a fresh literal rebuilds the stylesheet. That is
  `COMMON-R001`'s failure mode occurring once per visible row, which is the
  worst place for it.
- `handleSearchTextChange` is a plain function, not a `useCallback`, so the
  search field receives a new handler identity on every render. Note this is
  *not* true of the debounced search itself, which is stable — see `PICKER-N001`.
- Rows that show a stock badge mount `StockBadge`, which runs its own
  `useSelector` and `new Date()` trading-hours math per row. Only some tokens
  trigger it, so its cost depends on which list you measure.

State these as hypotheses in the report until the counters agree with them.

### network-filter — network pills and the network list modal

- **Aliases:** network selector, network list, select network, chain filter,
  network pills
- **Entry:** from `token-list`, tap `network-pills-more-button` → wait for
  `network-list-modal-scroll`
- **Code:** `components/BridgeTokenSelector/NetworkPills.tsx`,
  `components/BridgeTokenSelector/NetworkListModal.tsx`,
  `components/NetworkRow.tsx`
- **Test IDs:** `network-pills-more-button`, `network-list-modal-scroll`,
  `network-option-all`, `network-option-<chainId>`,
  `bridge-watchlist-filter-watchlist`
- **Instrument:** the pills row and the modal body; add the token row for
  `PICKER-S4`, since a filter change rebuilds the list
- **Scenarios:** COMMON-S0, PICKER-S4, PICKER-S5
- **Checks:** PICKER-R004, R006, N003

**Shape:** both are `ScrollView` + `.map()`, not virtualised. The pills are
capped at `MAX_VISIBLE_PILLS = 4` plus a More button, so that row is bounded by
construction; the **modal is the unbounded one**, mapping every entry in the
chain ranking. `PICKER-R006` watches the modal for that reason. `NetworkPills`
also resolves its visible chains with a `.map()` containing a `.find()` over
the ranking list, which is quadratic in chain count but capped at four
outputs.

Neither has any `Animated` or Reanimated usage. The pills scroll the selected
chain into view with `ScrollView.scrollTo`, which is not a JS-driven animation.

## Scenarios

`COMMON-S0` and `COMMON-S6` come from `common.md`. Only `PICKER-S1` has been
driven on device; the rest are drafted from the test IDs above and need
verifying — correct the procedure here when you first run one.

| ID | Scenario | Procedure | What it isolates | Verified |
|---|---|---|---|---|
| PICKER-S1 | Selector mount | Reset, open `select-source-token-selector`, wait 2s for the list to settle, close, read | Mount cost, and whether the screen behind the modal re-renders | yes |
| PICKER-S2 | Search typing | Reset, wait for the list to settle, type 5 characters one at a time into `bridge-token-search-input`, wait 2s, read | Whether a keystroke re-renders rows whose data did not change | no |
| PICKER-S3 | List scroll | Reset, scroll `bridge-token-list` through 5 screens of rows, wait 2s, read. **Record the number of rows scrolled past.** | Row recycling — whether renders track rows on screen or rows traversed | no |
| PICKER-S4 | Network filter switch (pill) | Reset, tap a different network pill, wait 3s, read | Cost of re-deriving the list when the filter changes | no |
| PICKER-S5 | Network list modal | Reset, tap `network-pills-more-button`, wait 2s, pick `network-option-all`, wait 3s, read | Mount cost of a non-virtualised list of every chain | no |
| PICKER-S7 | Pagination | Reset, enter a search that returns more than one page, scroll to the bottom to trigger load-more, wait 3s, read | Duplicate requests and full-list re-render on append | no |

`PICKER-S6` is retired: it drove the trending tokens filters, which are not
part of this area — the section is rendered by `SwapDiscoveryFeed` on the main
swaps screen, not inside the selector. It lives in `swaps-screen.md` as
`SWAPS-S9`.

Three notes that decide whether these numbers mean anything:

- **`PICKER-S3` needs its row count recorded.** "Renders per interaction" is
  meaningless for a scroll; the divisor is rows traversed, not gestures. If you
  cannot count rows reliably, scroll a fixed number of screens and say so.
- **Let the list settle before resetting counters.** `displayData` appends
  skeleton placeholders while loading and swaps the array identity when the
  real data lands, so a scenario started mid-load measures the load, not the
  interaction.
- **Search has a three-character minimum.** Below `MIN_SEARCH_LENGTH = 3` the
  debounced search does nothing, so the first two keystrokes of `PICKER-S2` are
  local-state renders with no request behind them. Type a real token prefix and
  expect the behaviour to change at the third character.

## Index

| ID | Check | Surfaces | Scenario | Gate | Status |
|---|---|---|---|---|---|
| PICKER-R001 | Scrolling renders rows in proportion to rows on screen | token-list | PICKER-S3 | advisory | provisional |
| PICKER-R002 | A search keystroke does not re-render settled rows | token-list | PICKER-S2 | advisory | provisional |
| PICKER-R003 | Rows do not re-render when the data did not change | token-list | PICKER-S1, S2 | advisory | provisional |
| PICKER-R004 | A filter change re-renders the list once | network-filter | PICKER-S4 | advisory | provisional |
| PICKER-R005 | Loading skeletons do not churn while idle | token-list | COMMON-S0 | blocking | active |
| PICKER-R006 | The network list modal stays bounded | network-filter | PICKER-S5 | advisory | provisional |
| PICKER-M001 | The debounce timer and scroll-reset frame are released | token-list | COMMON-S6 | blocking | active |
| PICKER-N001 | Search fires one request per settled query | token-list | PICKER-S2 | advisory | provisional |
| PICKER-N002 | Load-more fires once per pagination boundary | token-list | PICKER-S7 | advisory | provisional |
| PICKER-N003 | A filter change refetches at most once | network-filter | PICKER-S4 | advisory | provisional |

## Rendering and styles

### PICKER-R001 — Scrolling renders rows in proportion to rows on screen

- **Surfaces:** token-list
- **Primitive:** `render` counter (`../instrumentation.md` Recipe A) on the row
- **Scenario:** PICKER-S3
- **Measure:** row `render` attributable delta ÷ rows scrolled past
- **Pass:** `<= 1.5`
- **Gate:** advisory · **Waivable:** yes · **Status:** provisional
- **Baseline:** not yet measured
- **Why this shape:** a recycling list renders a row when it enters the
  viewport, so roughly one render per row traversed is correct and the
  allowance covers recycling overhead. A ratio near the *visible row count*
  instead — every row re-rendering on each scroll frame — means the list is
  re-rendering wholesale, which at 60fps is the severity table's Critical band.
- **Calibrate:** run it once on a settled list, record rows traversed and the
  device, then set the number from what a healthy run actually produces.
- **On failure:** check the identity of `renderItem` and of every prop it
  passes. The per-row arrow in `onTokenPress` is the first suspect.

### PICKER-R002 — A search keystroke does not re-render settled rows

- **Surfaces:** token-list
- **Primitive:** `render` counter (Recipe A) on the row
- **Scenario:** PICKER-S2, with `COMMON-S0` subtracted
- **Measure:** row `render` attributable delta ÷ keystrokes, with the number of
  visible rows recorded
- **Pass:** `<= visible rows` for the keystrokes that change the result set,
  and `0` for keystrokes typed while the debounce has not yet fired
- **Gate:** advisory · **Waivable:** yes · **Status:** provisional
- **Baseline:** not yet measured
- **Why two thresholds:** typing is debounced, so most keystrokes should not
  reach the list at all. A row render count that rises on *every* keystroke
  means the keystroke is propagating through the list before the debounce, and
  that is a defect independent of how many rows are on screen.
- **On failure:** the search handler's identity and the debounced function's
  identity are the two things to check, in that order.

### PICKER-R003 — Rows do not re-render when the data did not change

- **Surfaces:** token-list
- **Primitive:** `render` counter (Recipe A) on the row, plus the parent
- **Scenario:** PICKER-S1 and PICKER-S2
- **Measure:** row `render` delta across a window where the parent re-rendered
  at least once but `displayData` did not change identity
- **Pass:** `0`
- **Gate:** advisory · **Waivable:** yes · **Status:** provisional
- **Baseline:** not yet measured
- **Why:** this is the direct test of whether the rows' `React.memo` is doing
  anything. Unlike `PICKER-R001` it does not depend on list length or scroll
  distance, so it is the cleanest signal of an unstable prop — but it needs a
  parent render that is not caused by data, which is why it pairs with the
  parent counter rather than standing alone.
- **On failure:** compare each prop the row receives across two renders. An
  arrow function or object literal created in `renderItem` fails this by
  construction.

### PICKER-R004 — A filter change re-renders the list once

- **Surfaces:** network-filter
- **Primitive:** `render` counter (Recipe A) on the row and the list container
- **Scenario:** PICKER-S4
- **Measure:** list container `render` attributable delta for one filter change
- **Pass:** `<= 3`
- **Gate:** advisory · **Waivable:** yes · **Status:** provisional
- **Baseline:** not yet measured
- **Why the allowance is 3:** a filter change legitimately produces a state
  update, a data re-derivation, and a settle. More than that suggests the
  filter is round-tripping through Redux more than once, or that the list is
  resetting its scroll position in a way that triggers another pass.
- **On failure:** trace how the pill selection reaches the list — it goes
  through Redux, so a selector returning a fresh reference will multiply this.

### PICKER-R005 — Loading skeletons do not churn while idle

- **Surfaces:** token-list
- **Primitive:** `render` counter (Recipe A) on the row
- **Scenario:** COMMON-S0, with the list left in its loading state
- **Measure:** row `render` delta over the 10s idle window while skeletons are
  displayed and no user input occurs
- **Pass:** `0` after the first paint
- **Gate:** blocking · **Waivable:** no · **Status:** active
- **Why the threshold is exact:** the skeleton array is rebuilt from
  `Array(n).fill(null)` whenever the loading branch is taken, so if anything
  re-evaluates that branch on a timer the whole list re-renders forever while
  the user does nothing. Zero is the only defensible resting value for a screen
  receiving no input, which is why this one is blocking without calibration.
- **On failure:** find what is re-running the loading branch — usually a
  polling selector feeding one of the loading flags.

### PICKER-R006 — The network list modal stays bounded

- **Surfaces:** network-filter
- **Primitive:** `render` counter (Recipe A) on the network row, plus a mount
  count
- **Scenario:** PICKER-S5
- **Measure:** network row `render` delta for one open/close of the modal,
  recorded alongside the number of chains in the ranking
- **Pass:** `<= 2 × chain count`
- **Gate:** advisory · **Waivable:** yes · **Status:** provisional
- **Baseline:** not yet measured
- **Why this exists at all:** the modal is `ScrollView` + `.map()`, so every
  chain mounts whether visible or not. That is fine today and stops being fine
  as chains are added. The check is a tripwire on growth, not an accusation —
  record the chain count every run so the trend is visible.
- **Not the pills:** the pill row caps at four entries, so it cannot grow with
  the chain list and is not what this measures.
- **On failure:** the fix is virtualisation, which is a real change; report the
  number and the chain count and let the team decide.

### PICKER-R007 — retired

Drove the trending tokens section, which turned out not to belong to this area:
`BridgeTrendingTokensSection` is rendered by `SwapDiscoveryFeed` on the main
swaps screen, not inside the token selector, so a check comparing it against
the token list was comparing two screens that are never mounted together. The
property is worth keeping and now lives in `swaps-screen.md` as `SWAPS-R014`.
The number stays retired here.

## Lifecycle and memory

### PICKER-M001 — The debounce timer and scroll-reset frame are released

- **Surfaces:** token-list
- **Primitive:** balance counter (`../instrumentation.md` Recipe C)
- **Scenario:** COMMON-S6
- **Measure:** `balance` for each of these pairs, after the fifth cycle:
  - the debounced search function's pending timer (`debouncedSearch` /
    `.cancel()`, cancelled on unmount in `useSearchTokens`)
  - the `requestAnimationFrame` used to reset the list scroll position
  - the popular-tokens fetch `AbortController` (`abort()` on unmount in
    `usePopularTokens`)
- **Pass:** `0` for each
- **Gate:** blocking · **Waivable:** no · **Status:** active
- **Why this is separate from `COMMON-M001`:** the generic check says balances
  must be zero; this one names the three pairs worth instrumenting on this
  surface, so an auditor does not have to rediscover them. The threshold is the
  same and is structural, not calibrated.
- **On failure:** a pending debounce that outlives the modal will fire a search
  against an unmounted screen — usually visible as a state-update warning
  before it is visible as a leak.

## Network

### PICKER-N001 — Search fires one request per settled query

- **Surfaces:** token-list
- **Primitive:** fetch interceptor (`mms-mobile-visual-testing`
  `references/runtime-monitoring.md`)
- **Scenario:** PICKER-S2
- **Measure:** count of `POST /getTokens/search` requests across five
  keystrokes typed one at a time
- **Pass:** `<= 2`
- **Gate:** advisory · **Waivable:** yes · **Status:** provisional
- **Baseline:** not yet measured
- **Why 2 rather than 1:** only the third, fourth and fifth keystrokes are
  eligible — the debounced search ignores queries under three characters — and
  the 300ms debounce may legitimately fire once mid-sequence if `mm type` is
  slower than that. Three requests is the ceiling of correct behaviour; more
  than three is impossible without something re-triggering.
- **What a failure would mean:** the debounced function is currently built in a
  `useMemo` keyed on the search hook's callbacks, so it *should* be stable and
  this check should pass. It is here to catch that stability being lost, not
  because it is suspected today.
- **Note:** the interceptor does not survive Fast Refresh. Install it after the
  instrumentation edits have settled and verify it is alive before trusting a
  low count — a dead interceptor and a working debounce both report zero.
- **On failure:** check that the debounced function is created once, not per
  render, and that the handler calling it is stable.

### PICKER-N002 — Load-more fires once per pagination boundary

- **Surfaces:** token-list
- **Primitive:** fetch interceptor
- **Scenario:** PICKER-S7
- **Measure:** count of paginated search requests carrying the same cursor
- **Pass:** `<= 1` per cursor
- **Gate:** advisory · **Waivable:** yes · **Status:** provisional
- **Baseline:** not yet measured
- **Why:** pagination is driven from `onScroll` at `scrollEventThrottle={16}`,
  so the "close to bottom" condition is evaluated up to 60 times a second while
  the user rests at the end of the list. Whether that produces one request or
  many depends entirely on the in-flight guard holding.
- **On failure:** the guard flags are the thing to look at, not the scroll
  handler.

### PICKER-N003 — A filter change refetches at most once

- **Surfaces:** network-filter
- **Primitive:** fetch interceptor
- **Scenario:** PICKER-S4
- **Measure:** count of token-fetch requests triggered by one pill tap
- **Pass:** `<= 1`
- **Gate:** advisory · **Waivable:** yes · **Status:** provisional
- **Baseline:** not yet measured
- **Why:** a filter change resets search state and re-derives the chain set. If
  both paths fetch, one tap costs two round trips and the list flickers between
  two loading states.
- **On failure:** look for a fetch in both the filter-change handler and an
  effect watching the same state.

## Candidates

Hypotheses with no measurement path yet. They carry no ID and no audit reports
on them. Give one a primitive and a scenario and it becomes a check.

- **Token images do not re-request while scrolling.** Row avatars resolve
  through `getTokenImageSource`, memoized per row. Whether recycling causes
  refetches needs an image-loading primitive this skill does not have.
- **`getItemType` would help.** The list mixes real rows and skeletons without
  telling FlashList they are different types, which defeats recycling pools.
  Measuring the difference needs a before/after change, not just a counter.
- **Sorting cost per keystroke.** Typing re-derives through several O(n log n)
  sorts — `sortAssets` in the balance hook, `filterWatchlistBridgeTokens` in
  watchlist mode. Counters cannot see this; it needs a timing primitive around
  the derivation.
- **Quadratic chain resolution.** `NetworkPills` resolves visible chains with a
  `.map()` over a `.find()`. Trivial at ten chains; measurable at a hundred.
  Needs a way to vary chain count on device.
- **Time to first row.** How long from tapping the selector to the first real
  row painting. Needs a timing primitive rather than a counter.
