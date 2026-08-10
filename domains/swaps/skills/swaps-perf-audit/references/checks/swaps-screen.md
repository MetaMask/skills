# Area: swaps-screen

The main swaps surface and everything reachable from it without leaving the
quote: amount entry, quote details and quote selection, slippage configuration,
the trending tokens feed in the zero state, and the post-trade sheets.

**This is the default area.** An audit that names no area runs this one, and
must say so in the report.

Read with [`common.md`](common.md), which is always in scope. Conventions, the
check lifecycle, and the contribution procedure are in
[`../checks.md`](../checks.md).

**What shapes this area.** Everything under `BridgeView` sits inside
`BridgeQuoteDataProvider`, a context whose value is a memoized object with
fifteen dependencies. Context bypasses `React.memo` entirely: when that value
changes identity, every consumer below re-renders no matter how carefully its
props were stabilised. Several checks here approach that single fact from
different angles, because it is the thing most likely to make an otherwise
clean-looking tree expensive.

`SWAPS-R003` through `R006` were calibrated on device and are active.
Everything added since is **provisional** — derived from what the code does,
with a threshold nobody has confirmed yet. Provisional checks are advisory.
Calibrate one and promote it, recording the device and build.

## Surfaces

### quote-entry — the main swaps screen (default surface)

- **Aliases:** swaps screen, swaps page, bridge view, main swaps page, amount
  entry, quote view, input, keypad
- **Entry:** `wallet-swap-button` → wait for `bridge-view-scroll`
- **Code:** `Views/BridgeView`, `components/TokenInputArea`,
  `components/FlipQuoteButton`, `components/QuoteCountdownTimer`,
  `components/SwapsKeypad`,
  `hooks/useBridgeQuoteData/BridgeQuoteDataContext.tsx`
- **Test IDs:** `bridge-view-scroll`, `source-token-area`,
  `source-token-area-input`, `source-token-area-amount-type-toggle`,
  `dest-token-area`, `dest-token-area-input`, `token-input-area-max-button`,
  `arrow-button` (the flip control), `bridge-slippage-settings-button`,
  `bridge-confirm-button`, `bridge-confirm-button-keypad`, `bridge-no-quotes`,
  `bridge-missing-price-banner`, `bridge-fee-disclaimer`.
  `SwapsKeypad` and the underlying `Keypad` have **none**.
- **Instrument:** `BridgeViewContent`, `TokenInputArea` (source and dest),
  `FlipQuoteButton`, and either `SwapsKeypad` or the context identity counter.
  `QuoteCountdownTimer` lives inside `QuoteDetailsCard` and only exists once a
  quote has returned, so it is a `quote-details` instrument in practice.
- **Scenarios:** COMMON-S0, SWAPS-S1, S2, S3, S5, S7, COMMON-S6
- **Checks:** SWAPS-R003, R004, R005, R006, R007, R008, R009, R010, R013,
  M003, N001, N002

**Known defect shapes to look for, from a static read:**

- `selectBridgeControllerState` is a plain selector that returns the whole
  controller state object, so it yields a new reference whenever *any* field on
  that controller changes — including `quotesLastFetched` and the loading
  status. Both `BridgeViewContent` and `QuoteCountdownTimer` read through it.
  This is the most likely explanation for whatever `SWAPS-R006` measures.
- `HeaderStandard` receives `onBack={() => navigation.goBack()}` and an inline
  `endButtonIconProps` array of object literals. Both are rebuilt every render,
  so the header re-renders whenever the screen does.
- The screen's `onScroll` calls `setIsNearBottom(boolean)`. React bails out when
  the boolean is unchanged, so this should cost renders only at the threshold
  crossing — `SWAPS-R013` is what confirms the bail-out actually happens.
- Many components in this tree call `useStyles(createStyles, {})` with a fresh
  empty literal. That is `COMMON-R001`'s failure mode; it matters most in
  whatever re-renders most often.

### quote-details — expanded quote card and quote selection

- **Aliases:** quote details, quote card, quote selector, select quote, rate
  details
- **Entry:** from `quote-entry` with a quote returned, tap `rate-arrow-button`
- **Code:** `components/QuoteDetailsCard`,
  `components/QuoteDetailsRecipientKeyValueRow`, `components/QuoteSelectorView`
- **Test IDs:** `rate-arrow-button`, `edit-slippage-button`,
  `price-impact-info-button`, `bridge-rewards-row`,
  `recipient-selector-button`, `bridge-quote-details-skeleton`.
  `QuoteSelectorView`, `QuoteList` and `QuoteRowView` have **no runtime test
  IDs** — drive them positionally or add IDs first.
- **Instrument:** `QuoteDetailsCard` and one `KeyValueRow` instance
- **Scenarios:** COMMON-S0, SWAPS-S5, SWAPS-S8
- **Checks:** SWAPS-R005, R011
- **Do not use `expand-quote-details`.** It is declared in
  `tests/selectors/Bridge/QuoteView.selectors.ts` but never applied to a
  component, so it does not exist at run time. This is the exact trap the
  overlay warns about, and an earlier version of this file fell into it.
- **Note:** the card holds the countdown timer and is mounted only once a quote
  has returned, so run `SWAPS-S1` first. Neither the card nor its
  `KeyValueRow`s are memoized, so anything that re-renders the card re-renders
  every row in it.

### slippage — slippage configuration modals

- **Aliases:** slippage, slippage modal, custom slippage, default slippage,
  select slippage
- **Entry:** from `quote-entry`, tap `bridge-slippage-settings-button` (the
  header gear). With a quote on screen, `edit-slippage-button` in the quote
  card reaches the same modal. Choosing the custom option there navigates on to
  the custom slippage modal.
- **Code:** `components/SlippageModal`, `components/InputStepper`
- **Test IDs:** `bridge-slippage-settings-button`, `edit-slippage-button`,
  `input-stepper-minus-button`, `input-stepper-plus-button`,
  `input-stepper-input`. The modal screens themselves carry **no runtime test
  IDs** — only the stepper inside them does.
- **Instrument:** the modal body and the stepper
- **Scenarios:** COMMON-S0, SWAPS-S6
- **Checks:** SWAPS-R012
- **Note:** `InputStepper` calls `useStyles(inputStepperStyles, { fontSize })`
  with an inline literal, holds local pressed state for both buttons, and is a
  repeated-press control. That combination is what `SWAPS-R012` and
  `COMMON-R001` are looking for.
- **The modals are separate navigation routes**, not overlays inside
  `BridgeView`, which is why `SWAPS-R012` expects zero renders behind them.
  The Batch Sell slippage variants are a different flow and are out of scope
  here.

### trending-tokens — the discovery feed on the main screen

- **Aliases:** trending tokens, trending, token discovery, discovery feed
- **Entry:** visible on `quote-entry` in the zero state, below the inputs —
  `swap-discovery-feed` wraps `bridge-trending-tokens-section`
- **Code:** `components/SwapDiscoveryFeed`,
  `components/BridgeTrendingTokensSection`
- **Test IDs:** `swap-discovery-feed`, `bridge-trending-tokens-section`,
  `bridge-trending-price-filter`, `bridge-trending-network-filter`,
  `bridge-trending-time-filter`, `bridge-trending-show-more`
- **Instrument:** the trending section and `BridgeViewContent`
- **Scenarios:** COMMON-S0, SWAPS-S9
- **Checks:** SWAPS-R014
- **Shape:** rows are rendered with `.slice().map()`, not virtualised, twelve
  at a time. The three filters are local React state, not Redux. Changing the
  price filter sorts client-side; changing sort or network refetches.
- **It polls every five minutes.** A 10s `COMMON-S0` window will never see a
  poll, so do not read a clean baseline as proof this section is idle.

### post-trade — confirmation and post-trade sheets

- **Aliases:** post trade, confirmation sheet, transaction details, after swap
- **Entry:** from `quote-entry`, enter an amount and tap
  `bridge-confirm-button`
- **Code:** `components/PostTradeBottomSheet`, `components/TransactionDetails`,
  `components/SwapsConfirmButton`
- **Instrument:** the sheet body
- **Scenarios:** COMMON-S0, COMMON-S6
- **Checks:** none of its own yet; `common.md` applies
- **Warning:** this submits a real transaction on whatever network the wallet
  is on. Agree the account and network with the user before driving it.

### Sheets in this area with no registered surface

`BlockaidModal`, `TokenWarningModal`, `MissingPriceModal`,
`HighRateAlertModal`, `PriceImpactModal` (entry `price-impact-info-button`),
`MarketClosedBottomSheets`, `RecipientSelectorModal`, `GaslessQuickPickOptions`.
Alert and info sheets that mount briefly and hold little state. Audit one ad hoc
if a request names it, then register it if the run finds anything.

## Scenarios

`COMMON-S0` and `COMMON-S6` come from `common.md`. These are specific to this
area. `S1`, `S2`, `S3` and `S5` have been driven on device; the rest are
drafted — correct the procedure here when you first run one.

| ID | Scenario | Procedure | What it isolates | Verified |
|---|---|---|---|---|
| SWAPS-S1 | Single keystroke | Reset, `type` one character into `source-token-area-input`, wait 2s, read | Per-keystroke render and stylesheet cost | yes |
| SWAPS-S2 | Amount entry | Reset, type 5 characters one at a time, wait 2s, read | Whether cost is linear per keystroke or worse | yes |
| SWAPS-S3 | Flip | Reset, tap `arrow-button`, wait 3s, read | Re-render blast radius of a token swap | yes |
| SWAPS-S5 | Quote refresh cycle | Reset, wait one full refresh interval (~30s by default) with a quote on screen, read | Whether the 1s countdown and the 30s refresh re-render more than they should | yes |
| SWAPS-S6 | Slippage stepper | Reset, tap `bridge-slippage-settings-button`, then `input-stepper-plus-button` 5 times, wait 2s, read | Whether a modal-local control re-renders the screen behind it | no |
| SWAPS-S7 | Screen scroll | Reset, scroll `bridge-view-scroll` to the bottom and back, wait 2s, read | Whether the near-bottom scroll handler re-renders per frame or per crossing | no |
| SWAPS-S8 | Quote details expand | Reset, tap `rate-arrow-button`, wait 2s, collapse, read | Mount cost of the detail rows, and whether expanding re-renders the inputs | no |
| SWAPS-S9 | Trending filter change | Reset, tap `bridge-trending-time-filter` and pick a different value, wait 3s, read | Whether a section-local filter re-renders the swaps screen around it | no |

`mm type` clears the field before typing, so `SWAPS-S2` means five separate
single-character `type` calls, not one five-character call.

**Two facts that change how the timing scenarios are run.** The amount is held
in Redux and keystrokes normally arrive through `SwapsKeypad` — the input sets
`showSoftInputOnFocus={false}`, so it suppresses the system keyboard. `mm type`
has driven `SWAPS-S1` and `S2` successfully, but if a run finds it does not
register, drive the on-screen keypad instead and record that here. And the
countdown ticks once a second from component-local state while the controller
refreshes quotes every ~30s by default (chain overrides exist, and auto-refresh
stops after about five cycles) — so `SWAPS-S5` needs a wait sized to the
refresh, not to the countdown.

`SWAPS-S4` is retired: it drove the token selector, which now lives in
`asset-picker.md` as `PICKER-S1`.

## Index

| ID | Check | Surfaces | Scenario | Gate | Status |
|---|---|---|---|---|---|
| SWAPS-R003 | Source input renders at most twice per keystroke | quote-entry | SWAPS-S1, S2 | blocking | active |
| SWAPS-R004 | Memoized siblings do not render on unrelated input | quote-entry | SWAPS-S1, S2 | blocking | active |
| SWAPS-R005 | A quote tick re-renders only the countdown | quote-entry, quote-details | SWAPS-S5 | advisory | active |
| SWAPS-R006 | Idle churn stays bounded | quote-entry | COMMON-S0 | advisory | active |
| SWAPS-R007 | The quote context value is stable between quote updates | quote-entry | COMMON-S0, SWAPS-S1 | advisory | provisional |
| SWAPS-R008 | The keypad does not re-render the screen per press | quote-entry | SWAPS-S1, S2 | advisory | provisional |
| SWAPS-R009 | A flip has a bounded blast radius | quote-entry | SWAPS-S3 | advisory | provisional |
| SWAPS-R010 | The destination input tracks quotes, not keystrokes | quote-entry | SWAPS-S2 | advisory | provisional |
| SWAPS-R011 | Detail rows re-render only when their own value changes | quote-details | SWAPS-S5, S8 | advisory | provisional |
| SWAPS-R012 | A stepper press re-renders only the slippage modal | slippage | SWAPS-S6 | advisory | provisional |
| SWAPS-R013 | Scrolling re-renders the screen only at a threshold crossing | quote-entry | SWAPS-S7 | advisory | provisional |
| SWAPS-R014 | A trending filter re-renders only the trending section | trending-tokens | SWAPS-S9 | advisory | provisional |
| SWAPS-M003 | Quote polling and the countdown stop with the screen | quote-entry | COMMON-S6 | blocking | active |
| SWAPS-N001 | No request storm while typing | quote-entry | SWAPS-S2 | advisory | provisional |
| SWAPS-N002 | A flip fires at most one quote request | quote-entry | SWAPS-S3 | advisory | provisional |

`SWAPS-R001`, `R002`, `M001`, `M002` and `B001` are retired in this namespace:
they were universal, so they moved to `common.md` as `COMMON-*` with their
numbers unchanged. Do not reuse those five numbers here — which is why the
memory check below starts at `M003`.

## Rendering and styles

### SWAPS-R003 — Source input renders at most twice per keystroke

- **Surfaces:** quote-entry
- **Primitive:** `render` counter (`../instrumentation.md` Recipe A)
- **Scenario:** SWAPS-S1, confirmed against SWAPS-S2 for linearity
- **Measure:** `TokenInputArea.render` attributable delta ÷ keystrokes
- **Pass:** `<= 2.0`
- **Gate:** blocking · **Waivable:** yes, with a recorded reason ·
  **Status:** active
- **Baseline:** measured — iOS Simulator, dev build
- **Why the threshold is what it is:** the input is controlled, so one render
  per keystroke is required. The allowance of a second covers a follow-up pass
  from derived quote state. Three or more means the keystroke is propagating
  through state it should not touch.
- **Calibrate:** if the screen legitimately gains a second state hop, change
  this number in a PR that includes the measured before/after — do not waive
  the check repeatedly.
- **On failure:** `mms-performance` → `mm-unstable-hook-return.md`, then
  `mm-selector-memoization.md`.

### SWAPS-R004 — Memoized siblings do not render on unrelated input

- **Surfaces:** quote-entry
- **Primitive:** `render` counter (Recipe A)
- **Scenario:** SWAPS-S1 and SWAPS-S2
- **Measure:** attributable `render` delta for components whose props do not
  depend on the amount — `FlipQuoteButton` at minimum
- **Pass:** `<= 1` total across the scenario (not per keystroke)
- **Gate:** blocking · **Waivable:** yes, with a recorded reason ·
  **Status:** active
- **Baseline:** measured — iOS Simulator, dev build
- **Why:** these components are wrapped in `memo` and receive callbacks that
  are supposed to be stable. A count that scales with keystrokes means a parent
  is handing them a fresh prop each render, which is the exact defect that
  motivated this standard.
- **On failure:** stabilise the parent's callbacks with `useCallback`, and check
  that no inline arrow function is passed as a prop. If the props are provably
  stable and the component still re-renders, the cause is above it — go to
  `SWAPS-R007`, since context defeats `memo`.

### SWAPS-R005 — A quote tick re-renders only the countdown

- **Surfaces:** quote-entry, quote-details
- **Primitive:** `render` counter (Recipe A)
- **Scenario:** SWAPS-S5
- **Measure:** attributable `render` delta for every instrumented component
  other than `QuoteCountdownTimer`, across the second-by-second ticks — that
  is, the renders that are *not* explained by the ~30s quote refresh
- **Pass:** `0`
- **Gate:** advisory · **Waivable:** yes · **Status:** active
- **Baseline:** measured — iOS Simulator, dev build
- **Separate the two clocks:** the countdown owns a 1s `setInterval` and keeps
  the remaining seconds in its own `useState`, so ticks should not escape the
  timer at all. The quote refresh is a different, much slower event that
  legitimately updates quote-dependent UI. A component re-rendering thirty
  times in a cycle is following the tick; a component re-rendering once is
  following the refresh.
- **Why advisory:** a refresh-driven render is not automatically a defect. It
  is a defect when the component that re-rendered displays nothing derived from
  the quote.
- **On failure:** narrow the subscription so the per-second tick stays local to
  the timer.

### SWAPS-R006 — Idle churn stays bounded

- **Surfaces:** quote-entry
- **Primitive:** `render` counter (Recipe A)
- **Scenario:** COMMON-S0
- **Measure:** `BridgeViewContent.render` over the 10s idle window
- **Pass:** `<= 10` (roughly one per second, matching the quote countdown)
- **Gate:** advisory · **Waivable:** yes · **Status:** active
- **Baseline:** measured — iOS Simulator, dev build
- **Why:** this screen re-renders from controller polling even when untouched.
  The check exists to notice when that background rate *grows*, and to keep the
  baseline honest, since every other check subtracts it.
- **On failure:** the cause is usually a selector outside the Bridge tree
  returning a new reference. Report it, but do not treat it as a swaps defect
  without tracing the subscription.

### SWAPS-R007 — The quote context value is stable between quote updates

- **Surfaces:** quote-entry
- **Primitive:** identity counter (Recipe D) on the value passed to
  `BridgeQuoteDataContext.Provider`
- **Scenario:** COMMON-S0, then SWAPS-S1
- **Measure:** `BridgeQuoteData.value.identity` delta over the 10s idle window,
  and again per keystroke
- **Pass:** `<= 2` per countdown cycle while idle; `<= 2` per keystroke
- **Gate:** advisory · **Waivable:** yes · **Status:** provisional
- **Baseline:** not yet measured
- **Why this check earns its place:** the context value is memoized over
  fifteen dependencies. One unstable dependency makes the memo decorative, and
  because context ignores `React.memo`, the whole subtree below re-renders —
  which would show up as several other checks failing at once with no
  identifiable culprit. This is the check that names the culprit.
- **Interpreting it:** an identity change per quote refresh is correct and
  expected. An identity change per *render* of the provider is the defect. If
  the two rates are indistinguishable, add a render counter to the provider and
  compare.
- **On failure:** bisect the dependency list — each entry is either a primitive,
  a stable reference, or a suspect.

### SWAPS-R008 — The keypad does not re-render the screen per press

- **Surfaces:** quote-entry
- **Primitive:** `render` counter (Recipe A) on `SwapsKeypad` and on
  `BridgeViewContent`
- **Scenario:** SWAPS-S1, confirmed against SWAPS-S2
- **Measure:** `SwapsKeypad.render` attributable delta ÷ keystrokes
- **Pass:** `<= 2.0`
- **Gate:** advisory · **Waivable:** yes · **Status:** provisional
- **Baseline:** not yet measured
- **Why it is separate from `SWAPS-R003`:** the keypad and the input are
  different components on the same keystroke, and the keypad displays nothing
  derived from the amount. It re-rendering as often as the input means the
  keystroke is going up to a common parent and back down, which costs twice
  what it needs to.
- **Note:** the keypad is driven through a ref (`keypadRef`), so some of its
  updates deliberately bypass React. A count *lower* than the keystroke count
  is expected and fine.
- **On failure:** check whether the amount state lives above both components
  when it could live in one.

### SWAPS-R009 — A flip has a bounded blast radius

- **Surfaces:** quote-entry
- **Primitive:** `render` counter (Recipe A) on all instrumented components
- **Scenario:** SWAPS-S3
- **Measure:** attributable `render` delta per component for one flip
- **Pass:** `<= 3` per component
- **Gate:** advisory · **Waivable:** yes · **Status:** provisional
- **Baseline:** not yet measured
- **Why the allowance is 3:** a flip genuinely changes both tokens, both
  amounts and the quote, so every component here has a legitimate reason to
  re-render — twice if the token change and the quote arrival land separately.
  This check is not looking for zero, it is looking for the case where one tap
  produces a cascade of a dozen renders because state settles in stages.
- **On failure:** look for effects that respond to the flip by setting more
  state, rather than deriving from it.

### SWAPS-R010 — The destination input tracks quotes, not keystrokes

- **Surfaces:** quote-entry
- **Primitive:** `render` counter (Recipe A) on both `TokenInputArea` instances
- **Scenario:** SWAPS-S2
- **Measure:** destination `render` delta ÷ source `render` delta
- **Pass:** `<= 1.0`
- **Gate:** advisory · **Waivable:** yes · **Status:** provisional
- **Baseline:** not yet measured
- **Why a ratio rather than a count:** the destination amount is derived from
  the quote, which arrives at most twice across five debounced keystrokes, so
  in principle it should re-render far less than the source. A ratio at or
  above 1 means the destination is subscribed to the typing rather than to the
  quote — the two instances are the same component, so any shared unstable prop
  hits both equally.
- **On failure:** the shared parent is passing something that changes per
  keystroke to both instances.

### SWAPS-R011 — Detail rows re-render only when their own value changes

- **Surfaces:** quote-details
- **Primitive:** `render` counter (Recipe A) on `QuoteDetailsCard` and on one
  `KeyValueRow` instance
- **Scenario:** SWAPS-S5 for the steady state, SWAPS-S8 for mount
- **Measure:** card `render` attributable delta over one refresh cycle in which
  the quote did not change
- **Pass:** `0`
- **Gate:** advisory · **Waivable:** yes · **Status:** provisional
- **Baseline:** not yet measured
- **Measure the card, not the rows.** Neither `QuoteDetailsCard` nor the
  `KeyValueRow`s inside it are memoized, and the card builds a fresh `field`
  object literal for each row on every render. So the rows re-render exactly
  when the card does, by construction — counting them separately measures the
  same event twice. The card's own render count is the number that carries
  information.
- **Why zero:** the card is the longest-lived thing on this screen, mounted for
  as long as the user reads the quote. A render it does while the quote is
  unchanged is a render of roughly a dozen unmemoized rows for nothing.
- **On failure:** the card consumes the quote context, so start at
  `SWAPS-R007`. If the context value is stable and the card still re-renders,
  the cause is one of its own hooks — `useRewards` subscribes to a messenger
  event.

### SWAPS-R012 — A stepper press re-renders only the slippage modal

- **Surfaces:** slippage
- **Primitive:** `render` counter (Recipe A) on `InputStepper`, the modal body,
  and `BridgeViewContent`
- **Scenario:** SWAPS-S6
- **Measure:** two numbers across five stepper presses — `BridgeViewContent`
  `render` delta, and `InputStepper` `styleCreate` delta
- **Pass:** `0` renders behind the modal; `0` stylesheet creations after mount
- **Gate:** advisory · **Waivable:** yes · **Status:** provisional
- **Baseline:** not yet measured
- **Why zero renders behind:** the slippage modals are separate navigation
  routes and the value is held in the modal's own state until committed, so
  the screen behind should be inert. This half of the check is expected to
  pass; it is here to catch the value being pushed to Redux on every press.
- **The stylesheet half is the one to watch.** The stepper passes an inline
  `{ fontSize }` to `useStyles` and keeps local pressed state for both buttons,
  so a single press produces several renders of a component whose stylesheet
  memo misses every time. That is `COMMON-R001` in its most repeatable form.
- **On failure:** memoize the `vars` object; hold the value in modal state and
  commit once.

### SWAPS-R013 — Scrolling re-renders the screen only at a threshold crossing

- **Surfaces:** quote-entry
- **Primitive:** `render` counter (Recipe A) on `BridgeViewContent`
- **Scenario:** SWAPS-S7
- **Measure:** `BridgeViewContent.render` attributable delta for one scroll to
  the bottom and back
- **Pass:** `<= 4`
- **Gate:** advisory · **Waivable:** yes · **Status:** provisional
- **Baseline:** not yet measured
- **Why 4:** the scroll handler calls `setIsNearBottom` with a boolean on every
  scroll event. React bails out when the value is unchanged, so a round trip
  should cross the threshold twice and cost about two renders, with an
  allowance for a settle at each end. A count in the tens means the bail-out is
  not happening — the state is not a plain boolean, or something else in the
  handler path is setting state per frame.
- **On failure:** confirm what `setIsNearBottom` is being called with. A
  non-primitive value defeats React's bail-out silently.

### SWAPS-R014 — A trending filter re-renders only the trending section

- **Surfaces:** trending-tokens
- **Primitive:** `render` counter (Recipe A) on the trending section and on
  `BridgeViewContent`
- **Scenario:** SWAPS-S9
- **Measure:** `BridgeViewContent.render` attributable delta for one trending
  filter change
- **Pass:** `0`
- **Gate:** advisory · **Waivable:** yes · **Status:** provisional
- **Baseline:** not yet measured
- **Why:** the three trending filters are local React state inside the section,
  so changing one has no business reaching the swaps screen that hosts it. If
  it does, the filter state has been lifted higher than it needs to be and
  every filter tap re-renders the inputs and the quote card.
- **Moved from `asset-picker`:** this was `PICKER-R007` until the trending
  section turned out to be rendered by `SwapDiscoveryFeed` on the main screen
  rather than inside the token selector. The property is unchanged; only the
  neighbours it is measured against are.
- **On failure:** check whether the filter went into Redux, and what else
  subscribes to that slice.

## Lifecycle and memory

### SWAPS-M003 — Quote polling and the countdown stop with the screen

- **Surfaces:** quote-entry
- **Primitive:** balance counter (Recipe C)
- **Scenario:** COMMON-S6
- **Measure:** `balance` for each of these pairs, after the fifth cycle:
  - the countdown's `setInterval` / `clearInterval`
  - the bridge quote polling started by `updateBridgeQuoteRequestParams`
    against the `BridgeController.resetState()` in the unmount cleanup
  - the debounced quote updater's pending timer (`updateQuoteParams.cancel()`)
  - the gas fee estimate polling token (`startPolling` /
    `stopPollingByPollingToken`)
  - on `quote-details`, the `RewardsController:accountLinked` messenger
    subscription held by `useRewards`
- **Pass:** `0` for each
- **Gate:** blocking · **Waivable:** no · **Status:** active
- **Why this is separate from `COMMON-M001`:** the generic check says balances
  must be zero; this one names the pairs worth instrumenting on this surface.
  The threshold is structural, not calibrated.
- **Why it matters more here than elsewhere:** a leaked quote poll keeps
  fetching quotes and dispatching to Redux after the user has left the screen,
  so the cost is not a few kilobytes of retained memory — it is a permanent
  addition to the app's idle render rate, which then contaminates every future
  `COMMON-S0` baseline.
- **On failure:** confirm the cleanup releases the same handle the effect
  acquired, not a re-created one.

## Network

### SWAPS-N001 — No request storm while typing

- **Surfaces:** quote-entry
- **Primitive:** fetch interceptor from `mms-mobile-visual-testing`
  `references/runtime-monitoring.md`
- **Scenario:** SWAPS-S2
- **Measure:** count of quote requests in `__mmNet` across five keystrokes
- **Pass:** `<= 2`
- **Gate:** advisory · **Waivable:** yes · **Status:** provisional
- **Baseline:** not yet measured — the one attempt lost the interceptor to Fast
  Refresh and reported `SKIP`
- **Why:** quote requests are debounced. A count approaching one per keystroke
  means the debounce is being rebuilt each render and is not actually debouncing.
- **Note:** the interceptor is lost on Fast Refresh, so install it *after* the
  instrumentation edits have settled, and check its health before trusting a
  low count — zero requests because the interceptor died looks identical to
  zero requests because the debounce works.
- **On failure:** ensure the debounced function has a stable identity across
  renders.

### SWAPS-N002 — A flip fires at most one quote request

- **Surfaces:** quote-entry
- **Primitive:** fetch interceptor
- **Scenario:** SWAPS-S3
- **Measure:** count of quote requests for one flip
- **Pass:** `<= 1`
- **Gate:** advisory · **Waivable:** yes · **Status:** provisional
- **Baseline:** not yet measured
- **Why:** a flip changes the source token, the destination token and both
  amounts. If each of those independently triggers the quote effect, one tap
  costs three round trips and the user watches the quote resolve three times.
- **On failure:** the flip should produce one state transition, not a sequence
  of them.

## Candidates

Hypotheses, not checks. They carry no ID and no audit reports on them. Give one
a primitive and a scenario and it becomes a check.

- **Quote selector list.** `QuoteList` renders rows with `.map()` rather than a
  virtualised list, and the rows are memoized while the list around them is
  not. There is no runtime test ID anywhere in that view, so it cannot be
  driven yet — adding IDs is the prerequisite for a check.
- **Post-trade sheet cost.** Unmeasurable without submitting a real
  transaction, so it needs either a mocked network or a throwaway wallet.
- **Time to first quote.** From the last keystroke to the quote painting.
  A timing primitive, not a counter.
- **Header re-render cost.** `HeaderStandard` receives two inline props and so
  re-renders with the screen. Cheap in isolation; worth a number only if the
  screen's render rate stays high.
