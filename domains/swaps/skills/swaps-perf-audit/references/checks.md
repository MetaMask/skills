# Conformance checks — the living swaps performance standard

The properties the swaps flow must hold. `audit-protocol.md` is the method and
changes rarely; the files under `checks/` are the policy and are expected to
change often.

This file is the contract: how the checks are organised, what makes one
mergeable, and how results are reported. It holds no checks itself.

## Areas

The Bridge tree is split into three areas plus a shared file. An audit runs
against **one area** — the tree has more than fifteen modals, and instrumenting
them in one pass would be both slow and unreliable.

| File | Area | Covers |
|---|---|---|
| [`checks/common.md`](checks/common.md) | shared | Properties every area must hold, and the two scenarios every audit runs. Always in scope. |
| [`checks/swaps-screen.md`](checks/swaps-screen.md) | `swaps-screen` | Amount input, quote details and quote selection, slippage, post-trade sheets. **Default.** |
| [`checks/asset-picker.md`](checks/asset-picker.md) | `asset-picker` | Token list, token search, network filtering. |
| [`checks/batch-sell.md`](checks/batch-sell.md) | `batch-sell` | Batch sell token selection, quote review, and the sheets that flow renders. |

Each area file owns its surfaces, its navigation, its scenarios, and its
checks, so a contributor working on one area edits exactly one file. Adding
checks to `asset-picker` costs a `swaps-screen` run nothing — that separation
is the whole point of the split.

`common.md` is read on every run whatever the area. Everything in it is either
a static sweep that costs seconds or a property that applies to any component
that was instrumented.

`swaps-screen` is the **default** when a request does not name an area. Say so
explicitly in the report; an implicit scope that goes unstated reads like full
coverage.

### Surfaces within an area

An area contains one or more **surfaces** — individual screens or modals with
their own entry path. `swaps-screen` holds four: `quote-entry`, `quote-details`,
`slippage`, `post-trade`. A surface is the unit of navigation; the area is the
unit of scope and contribution. A request naming a single surface still runs
the area's checks, restricted to what that surface mounts.

## ID scheme

`<AREA>-<FAMILY><NNN>`, where the area prefix is `COMMON`, `SWAPS`, `PICKER` or
`BATCH`, and the family is:

| Family | Covers |
|---|---|
| `R` | Rendering and styles |
| `M` | Lifecycle and memory |
| `B` | Bundle |
| `N` | Network |

Scenarios follow the same prefix: `COMMON-S0`, `SWAPS-S1`, `PICKER-S2`. Numbers
are permanent within their prefix. Retire an ID by marking it retired in place,
never by reusing the number.

Splitting this file by area re-prefixed five checks that had been numbered
`SWAPS-*` and are now shared: `SWAPS-R001`, `R002`, `M001`, `M002` and `B001`
became `COMMON-*` with their numbers unchanged. Those five numbers stay retired
in the `SWAPS` namespace. Nothing had been reported against the old numbering.

## Mergeability rule

A check is mergeable only when it names all four of:

1. an **area and surface** it applies to, from that area's file,
2. a **measurement primitive** that `instrumentation.md` documents (or a static
   sweep command that runs as-is),
3. a **scenario** defined in that area's file (or `common.md`), or `static`,
4. an **objective pass criterion** — a number and a comparison.

"Ensure no excessive rendering" is not a check; `TokenInputArea.render` delta
per keystroke in `SWAPS-S1` is at most 2 is a check. Advice that cannot be
reduced to a number belongs in `mms-performance`, not here.

If a check needs a primitive that does not exist, add it to
`instrumentation.md` in the same PR. A check whose primitive is undocumented
reports `SKIP` forever and quietly stops being a standard.

## Check lifecycle

A check has three states, and the difference between them is what its number is
worth.

| Status | What it means | Gate |
|---|---|---|
| **candidate** | A hypothesis. No ID, no scenario, possibly no way to measure it yet. Lives in the area's Candidates section. | none |
| **provisional** | The property is real and measurable — derived from what the code does — but the threshold has never been confirmed on device. | advisory, always |
| **active** | The threshold came from a measurement on a stated device and build. | advisory or blocking |

The distinction exists because two very different numbers can appear in a
**Pass** line. A threshold of `0` derived from an invariant — a screen taking no
input must not re-render, a balanced pair must return to zero — needs no
calibration and can be `active` and blocking from the day it is written. A
threshold like "at most 2 renders per keystroke" is an empirical claim about a
particular screen, and until someone has run it, it is a guess with a number in
it. Shipping guesses as blocking checks is how a standard loses its authority
the first time it fails for no reason.

**Promoting provisional to active:** run the scenario on a healthy build,
confirm the measurement is stable across a couple of runs, correct the
threshold if the real number is not what the author assumed, and record the
device and build in the **Baseline** field. That correction is worth as much as
the original check.

A provisional check is never blocking, and its `FAIL` in a report is a prompt to
investigate, not a defect claim. Say so in the report.

## Adding a check

1. Decide which state it starts in. A check codifying a defect you measured
   starts `active` with its numbers. A property you derived from reading the
   code starts `provisional`. An idea you cannot yet measure is a candidate and
   carries no ID.
2. Open the area file the defect lives in. Pick the next free number in the
   right family for that prefix.
3. Scope it to the narrowest surface list that is true. A check placed in
   `common.md` runs in every audit forever, so put it there only when the
   property is genuinely universal.
4. Fill in every field of the template below.
5. Add the row to that file's index table and the ID to each surface it covers.

```markdown
### AREA-X00N — One-line statement of the property

- **Surfaces:** which surfaces in this area own it
- **Primitive:** which recipe or sweep produces the number
- **Scenario:** AREA-S<n> or `static`
- **Measure:** the exact expression being compared
- **Pass:** the number and comparison
- **Gate:** blocking | advisory · **Waivable:** yes | no ·
  **Status:** active | provisional
- **Baseline:** measured — device and build | not yet measured
- **Why the threshold is what it is:** the reasoning, so the next person can
  change it responsibly
- **On failure:** where to go next
```

Choose the gate honestly. `blocking` means an audit that fails it reports a
defect. `advisory` means the result needs interpretation first. A provisional
check is advisory by definition; an active one is promoted to blocking once its
threshold has held across a few audits.

Add the `Status` column to the area's index table too. A reader scanning the
index should be able to tell measured policy from derived policy without
opening each subsection.

## Adding a surface

Register one when a screen or modal needs recurring checks of its own, or when
an ad-hoc audit found something worth codifying. A surface with no checks is
still worth registering if its navigation was hard to work out — the entry path
is half the cost of an audit.

1. Add it to the area file it belongs to. Give it a kebab-case ID and the
   aliases a developer would plausibly type; the aliases are the whole
   scope-resolution mechanism.
2. Record the entry path with real test IDs, verified against a running app.
   Do not take IDs from `*.test.tsx` — most are mocks that do not exist at run
   time. Before recording or re-verifying a surface's IDs, run the freshness
   sweep in `audit-protocol.md`'s Step 1 ("Test-ID freshness") against the
   surface's `Code:` paths — a documented ID with no matching source hit is
   drift, not a candidate for a live-app search.
3. List the code it owns, so the static sweep and future scope inference can
   map a diff onto it.
4. Name at most five components to instrument. A surface needing more is
   probably two surfaces.
5. Start with `COMMON-S0` and whichever scenarios already apply.

## Adding an area

Rarely needed — three areas cover the tree. Add one only when a body of work is
large enough that its checks would otherwise drown an existing file, and it has
its own navigation root. Create `checks/<area>.md`, claim a prefix, add the row
to the table above, and list the area in `audit-protocol.md` Step 0.

## Reporting results

The results table format is in `audit-protocol.md` Step 5. Report every ID the
selected area owns, plus everything in `common.md`, with `PASS`, `FAIL`, `SKIP`
or `WAIVED` — never omit one.

Checks belonging to other areas are out of scope, not `SKIP`. `SKIP` means a
check applied and could not be measured, which is a gap worth seeing; naming
the scope is what accounts for the rest.

## Waivers

A check may be waived for a single audit when the failure is understood and out
of scope for that change. Report it as `WAIVED` with the reason and the
measured value.

Waivers are per-run and never persisted in these files. If the same check is
waived repeatedly, that is a signal to either fix the underlying issue or
change the threshold with evidence — not to keep waiving it. Checks marked
**Waivable: no** are structural: their thresholds are `0` for reasons that
cannot change without the property itself being abandoned.

## Retiring a check

Strike the row in the area's index and keep the subsection with a short note
saying when and why it was retired. Reports on older branches still cite the
ID, and a silently deleted check is indistinguishable from one that never ran.
