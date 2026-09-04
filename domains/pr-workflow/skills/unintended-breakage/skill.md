---
name: unintended-breakage
description: Find the things a PR breaks that it did not set out to change. Reads the description first to fix the intended scope, then reads the diff for effects outside it, then tests whether any of those effects breaks a consumer — a removed export still imported, a deleted locale key still referenced, a persisted state shape with no migration, an analytics event renamed out from under a dashboard, a default flipped. Use before merging a refactor, a re-land, a rename, or any change whose description says it preserves behaviour. Reports breakage by who it breaks and how it was detected, not by suspicion.
---

# /unintended-breakage

A change that breaks something it meant to break is a decision. A change that breaks something
it never mentions is a defect, and it is invisible to every review that starts from the diff —
because the diff looks intentional all the way through.

This skill finds the second kind.

## Read the description first — and why that is the opposite of the sibling skill

[`falsifiers-first`](../falsifiers-first/skill.md) seals the description, because letting the
author's claims choose your hypotheses produces confirmation. Here the order inverts, and the
inversion is principled rather than a matter of taste:

**"Out of scope" is not a property of code. It is a relation between code and a stated
intent.** You cannot detect a departure from an envelope you have not read. So the description
comes first, and its job is not to be tested — it is to fix the boundary that everything after
is measured against.

Do not harmonise the two skills. Different question, different order.

## Phase 1 — fix the envelope

From the description, the linked ticket and the title, write down:

- **What is meant to change**, in mechanisms and in surfaces.
- **Who is meant to notice.** Users, reviewers, a downstream package, a dashboard, nobody.
- **What is declared behaviour-preserving.** "Refactor", "re-land", "no functional change",
  "converts X to Y" — each is a promise that the observable stays put.
- **What is explicitly excluded.** A PR that says it leaves something alone has handed you a
  falsifiable statement and a boundary at once.

A description that promises preservation is the strongest input this skill takes. It converts
every behavioural difference into a finding.

## Phase 2 — enumerate effects, ignoring intent

Now read the diff and list what it *does*, with the envelope out of mind. You are building the
left side of a subtraction; judgement comes after.

The surfaces where unintended breakage actually lives, in rough order of how often they bite:

| surface | what to look for | how it breaks |
|---|---|---|
| **Removed or renamed exports** | symbols deleted from a module's public surface | an importer that was not updated |
| **Deleted files** | any file removed, including tests | something still imports it, or the only coverage of a path just left |
| **Localisation keys** | message keys removed or renamed | a lookup at runtime that now renders a key or nothing |
| **Persisted state** | controller state shape, storage keys, defaults | old state read by new code with no migration |
| **Event and property names** | analytics events, their properties, their values | a dashboard, funnel or alert keyed on the old string |
| **Public types** | a widened parameter, a narrowed return, a new required field | a consumer that compiled yesterday |
| **Defaults** | feature flags, config, optional parameters gaining a value | behaviour changes for everyone who never opted in |
| **Dependency ranges** | a bump, a peer widened, a resolution pinned | a transitive consumer resolves differently |
| **DOM and test hooks** | test ids, class names, aria roles other code selects on | an e2e suite or a sibling app's selector |

Two of these deserve special weight in a monorepo-adjacent codebase: **persisted state** and
**event names**, because both cross a boundary the type system does not see. A renamed event is
a silent break — nothing fails to compile, nothing fails a test, and a dashboard goes flat.

## Phase 3 — subtract, then test what is left

Effects minus envelope is your candidate list. Now the part that separates this from a hunch:
**every candidate has a mechanical check, and a candidate without one is not reportable.**

| candidate | the check |
|---|---|
| export removed | search the tree at head for remaining importers |
| file deleted | same, plus whether its tests covered a path nothing else does |
| locale key removed | search for the key in code and in the other locales |
| state shape changed | round-trip old persisted state through the new code; is there a migration, does it run |
| event renamed | diff the event constants between base and head, and search the analytics surface for the old name |
| type changed | typecheck a consumer against the new signature |
| default flipped | read the default at base and head, and find who reads it |
| dependency bumped | resolve the lockfile both ways and diff the resolved versions |

Run the check. Report what it returned. A candidate whose check comes back clean is still worth
one line — it says the surface was examined, which is what stops the next reviewer re-deriving
it.

**Do not report a candidate you could not check.** Say the surface exists and the check was not
available; that is honest and useful. A list of things that might break, with nothing run
against any of them, is a worry masquerading as a review.

## What counts as breaking

Breakage is defined by a consumer, so name one. "This export was removed" is not a finding.
"This export was removed and these three files still import it" is. If you cannot name who
notices, you have found a change, not a break — and changes are the author's business.

Three tiers worth distinguishing in the report:

- **Breaks now** — a consumer in this repository is already inconsistent at head.
- **Breaks on contact** — nothing in this repository consumes it, but a published surface
  changed, so a downstream consumer will find out later.
- **Breaks silently** — nothing fails; an observable moves. Renamed events, changed defaults,
  altered state shapes. These are the ones worth the most and get flagged the least.

## Report shape

Group by surface, not by file. For each finding: what changed, who consumes it, what the check
returned, and which tier. Lead with anything in the **breaks silently** tier, because it is the
tier a reviewer cannot find by reading.

Close with the surfaces you checked and found clean. A review that lists only hits reads as a
search that stopped when it found something.

## Related

- [`falsifiers-first`](../falsifiers-first/skill.md) — the mirror: seals the description,
  because it is testing whether the claims hold rather than where the change exceeds them
- [`evidence`](../evidence/skill.md) — runners for the checks in phase 3, and the gate that
  decides whether the report is publishable
- [`pr-changelog`](../pr-changelog/skill.md) — where a confirmed breaking change has to end up
  once it is established
