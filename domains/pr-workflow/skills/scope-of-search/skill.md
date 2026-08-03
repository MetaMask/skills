---
name: scope-of-search
description: Treat a negative result as a fact about the search rather than about the thing searched — "no occurrence" means this pattern did not match, which is a much smaller claim than the one it gets read as. Publish the pattern alongside the negative, name what the pattern structurally cannot see, search for the concept before the identifier, and run a positive control before believing an absence. Use when a diff audit, grep or validation run is about to report that something is not present, when checking a PR description's claim that a category of code is absent, or when a 404, an empty result set or a quiet run is about to be published as evidence of non-existence.
---

# /scope-of-search

A negative result is a fact about the search, not about the thing searched.

"No occurrence" means: *this pattern, run over this text, matched nothing.* That is a much
smaller claim than "the thing is not there", and the gap between the two is where negatives go
wrong.

## The tell

You are about to write **no**, **none**, **nothing** or **never** about a body of code.

Whatever produced that word has a scope, and the scope belongs in the sentence.

## Why negatives need their own discipline

The consequences are asymmetric. A false positive gets investigated and dies — someone opens
the file, sees it does not say what the finding said, and the finding is gone inside a minute.
A false negative closes the question. Nobody returns to it, because there is nothing to return
to: the record says it was checked.

So a negative should cost more to publish than a positive. In practice it costs less, because a
negative is what a run produces when it does nothing.

## What this looks like when it fails

A PR body claimed the diff contained "no original/unsigned handler parameter access". A
validation run tested that claim with

```
grep -nE "sig_params|SIG_PARAMS_PARAM|searchParams[.]get|url[.]searchParams"
```

over the added lines, and reported `(no occurrence)`.

The pattern keys on the variable name `searchParams`. The claim was about the *access* — a query
parameter read before signature verification. Naming and behaviour are different things, and the
pattern only knew one of them. Two blocks later the same artifact printed five
`params.get('utm_source')`-style reads it had just declared absent. The clearest instance of all
was in a file the pattern never covered: a router handing raw URL query straight into a provider.

The forms that pattern could not see are the general shape of the problem:

- a `URLSearchParams` constructed under any other variable name — `params`, `q`, `qs`, a
  destructured field
- `.getAll(` rather than `.get(`
- destructuring, where no accessor call appears at all
- a value assembled outside the diff and passed in, so the access is real and the added lines
  only receive it

Same session, opposite direction: a link was reported broken on the strength of an anonymous
fetch returning 404. The search was scoped to anonymous access; the claim was about existence.
A private, moved, or auth-gated resource returns exactly the same 404 as one that was never
there.

Both failures have one shape. **The scope of the search was narrower than the scope of the
claim, and the report used the claim's words.**

## The rules

**Publish the pattern with the negative.** A reader cannot assess "no occurrence" without seeing
what was searched for. The pattern is part of the finding, not an implementation detail of how
it was reached. If showing it feels like clutter, that is the signal it is load-bearing — a
negative whose pattern is not worth publishing is a negative not worth believing.

**State what the search structurally cannot see.** Every pattern has a shape it misses: an
identifier-keyed pattern misses renames, a line-oriented one misses anything spanning lines, an
added-lines scan misses everything the diff merely calls. Name the blind spot yourself, in the
finding. Otherwise someone names it later, in review, at much higher cost — and by then the
negative has been relied on.

**Search for the concept, then for the name.** A pattern keyed on an identifier finds one
spelling of an idea. If the claim is about behaviour — "nothing here reads unverified input" —
then at least one search has to be about behaviour: the sinks, the call shapes, the boundary the
data crosses. Identifier searches then narrow what the behavioural search surfaced. In that
order, because the reverse only ever confirms the spelling you already guessed.

**A negative wants a positive control.** Run the same pattern against somewhere you know the
thing exists — another file, an earlier revision, a line written to bait it. If it does not match
there, the negative elsewhere means nothing; you have measured your regex, not the code. This is
what catches the entire class where the pattern was never capable of matching: wrong escaping,
wrong flags, a path filter that excluded the file set, a revision that was never checked out.

**Scope is part of the claim.** "Not in the added lines", "not in this file", "not in the
repository" and "not reachable from this entry point" are four different findings, routinely
reported in the same three words. Say which one you have. If the claim you are checking is wider
than the search you ran, report *that mismatch* — it is the real result, and it is more useful
than the negative.

## Reporting a negative

Four facts, and it need not run longer than a positive:

- **what was searched for** — the pattern, verbatim
- **where** — file set, revision, added lines versus whole tree
- **the control** — where the pattern did match, proving it can
- **the blind spot** — the forms this could not have found

Then the finding, scoped to exactly that: "no occurrence of `X` in the added lines of these four
files; control matched at `a/b.ts:31`; would not catch a renamed binding, or a value assembled
outside the diff and passed in."

If one of the four is missing, the honest report is **not checked**. That is a legitimate thing
to publish, and a better one than a negative nobody can assess.

## Related

- [`falsifiers-first`](../falsifiers-first/skill.md) — its warning that mirroring the author's
  method makes agreement uninformative is this failure in the large: their grep's blind spot
  becomes yours
- [`silent-failure`](../silent-failure/skill.md) — its "a check whose pattern cannot match the
  failure" row is this skill's whole subject, and it supplies the positive control as an
  induction: make the thing exist, then see whether the check notices
- [`unintended-breakage`](../unintended-breakage/skill.md) — "we found no regressions" is a
  negative with a scope, and the scope is usually the suite that ran
- [`evidence`](../evidence/skill.md) — where the pattern, the scope and the control get attached
  to the finding rather than discarded once the run is over
