---
name: privacy-egress-diligence
maturity: experimental
description: >-
  Triage a change to what user data leaves the device — telemetry state masks, new analytics event properties, and error or breadcrumb strings that interpolate user values. Detection is mechanical (the mask or allowlist diff), so the deliverable is not whether each field is listed but what each newly unmasked field actually holds at runtime — a bounded enum is not an account address, and the mask cannot tell them apart. Sorts findings into safe / needs-narrowing / must-not-egress with the evidence for each, and hands the accept decision to the people who own it. Use when a PR touches the telemetry mask, adds a tracked event or property, or widens what an error message includes.
---

# Privacy egress diligence

A telemetry mask decides what leaves the user's machine, and it is edited inside ordinary
feature PRs. This skill reviews that egress surface the way a capability-policy review works —
the diff is mechanical, the judgement is what each grant *means*.

## Do not use when

- The change only *removes* fields or narrows a mask. That shrinks egress; note it and move on.
- The PR is a pure rename with no change to which values are copied.

## The trap

A mask tells you a field is sent. It cannot tell you what the field holds. `true` on a field
whose runtime value is a bounded enum is not the same decision as `true` on a field that
sometimes holds an address, and the diff renders both identically.

## Output

Sort each newly-egressing field into **safe**, **needs narrowing**, or **must not egress**,
with the evidence for each. The accept decision belongs to the people who own the surface,
not to this pass.

See the repo overlay for the concrete mask file, its semantics, and the commands.
