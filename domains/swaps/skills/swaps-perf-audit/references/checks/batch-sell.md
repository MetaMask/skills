# Area: batch-sell

The batch sell flow: multi-token selection, quote review with per-token
sliders, and the five sheets that flow renders.

This area has **no checks of its own yet** — nothing here has been measured on
device. `common.md` still applies in full, and the candidates at the bottom are
where a first audit should start.

Read with [`common.md`](common.md), which is always in scope. Conventions and
the contribution procedure are in [`../checks.md`](../checks.md).

**Treat the first audit here as a discovery run.** Two views and five modals,
no recorded navigation, and a review screen that holds one interactive slider
per selected token — expect to spend the run registering entry paths and
scenarios rather than producing findings.

**Already covered off-device:** `BatchSellTokenSelect.perf-test.tsx` measures
that screen's render cost with `reassure` (`yarn test:reassure:branch`). That
catches render-count regressions in CI against mocked data. It does not catch
anything driven by real controller state, real list lengths, or interaction on
a device, which is what this area's checks are for. Check what the reassure
test already asserts before writing a check that duplicates it.

## Surfaces

### batch-sell-token-select — multi-token selection

- **Aliases:** batch sell token select, select tokens, batch sell picker,
  multi-token select
- **Entry:** *unregistered navigation* — discover with `mm describe-screen`
- **Code:** `Views/BatchSellTokenSelect`
- **Test IDs:** `batch-sell-token-select-token-list`,
  `batch-sell-token-select-token-row`,
  `batch-sell-token-select-network-pill`,
  `batch-sell-token-select-balance-sort-button`,
  `batch-sell-token-select-next-button`,
  `batch-sell-token-select-empty-state`
- **Instrument:** the list container and `BatchSellTokenRow`
- **Scenarios:** COMMON-S0, COMMON-S6
- **Checks:** none of its own yet; `common.md` applies
- **Note:** a list with multi-select state, so each selection potentially
  re-renders every row. That is the defect shape to look for.

### batch-sell-review — quote review with per-token sliders

- **Aliases:** batch sell review, review quotes, sell review, batch review
- **Entry:** from `batch-sell-token-select`, tap
  `batch-sell-token-select-next-button` → wait for
  `batch-sell-review-container`
- **Code:** `Views/BatchSellReview`
- **Test IDs:** `batch-sell-review-container`, `batch-sell-review-token-row`,
  `batch-sell-review-token-slider`, `batch-sell-review-customize-button`,
  `batch-sell-review-remove-button`, `batch-sell-review-button`,
  `batch-sell-review-destination-token-pill`,
  `batch-sell-review-high-price-impact-tag`
- **Instrument:** `BatchSellReviewTokenRow` and the review container
- **Scenarios:** COMMON-S0, COMMON-S6
- **Checks:** none of its own yet; `common.md` applies
- **Note:** the highest-risk surface in the area. A slider is a continuous
  gesture, so a row that re-renders the whole list per drag frame is a
  per-frame cost — the severity table's Critical band.

### batch-sell-sheets — the modals this flow renders

- **Aliases:** batch sell modals, quote details modal, price impact modal,
  network fee modal, final review
- **Entry:** from `batch-sell-review`; each sheet has its own trigger, none
  recorded
- **Code:** `components/BatchSellQuoteDetailsModal`,
  `components/BatchSellFinalReviewModal`,
  `components/BatchSellDestinationTokenSelectorModal`,
  `components/BatchSellPriceImpactInfoModal`,
  `components/BatchSellMinimumReceivedInfoModal`,
  `components/BatchSellNetworkFeeInfoModal`
- **Instrument:** the sheet body of whichever sheet is under audit; one at a
  time
- **Scenarios:** COMMON-S0, COMMON-S6
- **Checks:** none of its own yet; `common.md` applies
- **Note:** `BatchSellDestinationTokenSelectorModal` is a token list and
  behaves like `asset-picker`. If a defect turns up there, check whether the
  `asset-picker` candidates describe it before writing a new one here.

## Scenarios

`COMMON-S0` and `COMMON-S6` come from `common.md`. This area has no scenarios
of its own yet — none of the surfaces has a recorded entry path, and a scenario
that cannot be driven is not worth writing down.

Register scenarios as `BATCH-S1` onward during the first discovery run, and
record their entry paths in the repo overlay at the same time. The obvious
first three, from the test IDs above:

- selecting and deselecting tokens in `batch-sell-token-select`
- dragging a `batch-sell-review-token-slider`
- opening and closing one of the info sheets

## Index

No checks yet. Everything in `common.md` applies to this area.

## Candidates

Hypotheses, not checks. They carry no ID and no audit reports on them. Measure
one, and if it holds, promote it with the numbers that showed it.

- **Selecting one token does not re-render every row.** Multi-select state
  usually lives in the parent, so this is the default failure mode of a screen
  like this. Needs a token-select scenario and a row counter.
- **A slider drag re-renders only its own row.** A continuous gesture makes
  this the most expensive plausible defect in the flow. Needs a drag scenario;
  check first whether `mm` can drive a slider at all, and say so in the report
  if it cannot.
- **Row count does not drive per-row work quadratically.** Compare a 2-token
  and a 10-token selection through the same scenario. This is the check the
  reassure test cannot make, because it runs against a fixed mock set.
- **Info sheets do not keep the review screen re-rendering while open.** Needs
  a sheet open/close scenario with the review container instrumented.
