---
repo: metamask-extension
parent: privacy-egress-diligence
---

# Privacy egress diligence

`app/scripts/constants/sentry-state.ts` decides what leaves the user's machine. It is
~11.7KB of per-controller masks, **116 fields currently set to `true`**, and it is edited
inside ordinary feature PRs — onboarding, swaps, rewards, the analytics controller — with
**no CODEOWNERS entry**, so no privacy reviewer is automatically tagged.

This skill reviews that egress surface the way `lavamoat-policy` reviews
capability grants: the diff is mechanical, the judgement is what each grant *means*.

## When to use

- A PR touches `app/scripts/constants/sentry-state.ts` (either mask).
- A PR adds or widens a MetaMetrics / Segment event property.
- A PR adds an error message, breadcrumb, or log line that interpolates runtime values.
- A new controller lands and its state gets a mask entry.

## Do not use when

- The change only *removes* fields or narrows a mask — that shrinks egress; note it and move on.
- The PR is a pure rename with no change to which values are copied.

## The mechanic, and the trap

`maskObject` (`shared/lib/object.utils.ts`) walks the mask:

| Mask value | Effect on the field |
|---|---|
| `true` | **the real value is copied and sent** |
| `false`, `[]`, absent | leaf replaced with its `typeof` string |
| nested object | recurse |
| `[AllProperties]` | applies to dynamic keys — **the field names are not known at review time** |

Unlisted is safe by default, so the risk direction is one-way: **a field promoted to
`true`.** That is the whole review surface, and `git diff` finds it exactly.

**The trap:** "the field is in the mask, so someone decided it was fine." The mask *is* the
decision — appearing in it is not evidence that anyone weighed it. Every `true` was typed by
someone, usually while shipping an unrelated feature. Presence proves authorship, not review.

## Procedure

1. **Extract the newly-`true` set.**

   ```bash
   git diff origin/main...HEAD -- app/scripts/constants/sentry-state.ts | grep -E '^\+.*:\s*true'
   ```

   Also flag any new `[AllProperties]`, which admits keys nobody has seen.

2. **Resolve each field to its runtime type.** The mask names a path, not a type. Find the
   controller field and read what it actually holds — the declaration, and a real value if
   the state fixtures have one:

   ```bash
   grep -rn "<fieldName>" app/scripts/controllers/ shared/ --include=*.ts
   grep -rn "<fieldName>" test/e2e/default-fixture.js app/scripts/../test/**/mock-state.json 2>/dev/null
   ```

3. **Sort into three buckets.** This is the deliverable.

   | Bucket | What it looks like | Action |
   |---|---|---|
   | **Safe** | bounded enum, boolean, count, duration, feature-flag name, error code | note the type that makes it safe |
   | **Needs narrowing** | object whose *shape* is useful but whose *leaves* are not — a tx object, a quote, a network config | propose the nested mask that keeps the shape and drops the values |
   | **Must not egress** | account address, ENS name, balance, token amount, private RPC URL, free text a user typed, anything keyed by address | propose `false`, or a derived non-identifying substitute (a count, a boolean, a hash) |

4. **Check the sibling surfaces** the same PR may have widened:
   - **Event properties** — a new MetaMetrics/Segment property carrying an address or amount
     is the same defect on a different pipe. `analytics-instrumentation` covers whether the
     event is *correct*; this covers whether its payload is *sendable*.
   - **Error strings** — `throw new Error(\`... ${someValue}\`)` reaches Sentry as the message.
     Interpolating an address or a balance leaks it regardless of the mask.

5. **Report, do not rule.** Give each field its bucket, the evidence (declaration site, an
   observed value), and a proposed mask. **Do not render an accept/reject verdict** — whether
   a given field is acceptable to collect is a call for the privacy and legal owners, and a
   confident-sounding "this is fine" from a reviewer is exactly the artifact that lets an
   unreviewed field through.

## What this does not cover

This reviews **what** a field carries. It does not review whether the send is permitted at all —
consent state, basic functionality, compliance and region gates, and what happens to data
buffered before a user decided. A correctly masked field sent without consent is the worse
failure of the two, and nothing here can see it.

That axis is reviewed separately, in the private skills repo, because naming the conditions
under which a control does not run is a different kind of document from describing the control.
Run both on a change that adds collection; either alone leaves half the question open.

## Common pitfalls

| Mistake | Correct approach |
|---|---|
| Treating mask membership as review | Presence proves someone typed it, not that anyone weighed it |
| Reading the mask path as a type | Resolve the field to its declaration; `selectedAddress` and `selectedTab` look alike in a mask |
| Ignoring `[AllProperties]` | Dynamic keys are unreviewable by construction — say so, and ask what generates them |
| Approving because a value is "usually" small | Report the worst case the type admits, not the common case |
| Rendering a verdict | Sort and evidence; the accept decision belongs to privacy/legal |
| Reviewing only `sentry-state.ts` | Event properties and interpolated error strings egress on other pipes |

## Related

- `lavamoat-policy` — same shape for capability grants; read it for the
  diff-is-mechanical-judgement-is-not pattern.
- `analytics-instrumentation` — whether an event is correctly *identified* and *gated*
  (`isOptIn`, `metaMetricsId`). This skill is about whether its payload is *sendable*.
- `supply-chain-audit` — the third diligence lane, for dependency capability.
