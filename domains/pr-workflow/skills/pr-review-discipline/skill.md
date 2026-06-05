---
maturity: experimental
name: pr-review-discipline
description: Discipline for reviewing PRs — verify the mechanism before judging, triage findings before drafting comments, don't overcorrect after being wrong, challenge workarounds
---

# PR Review Discipline

## When To Use

- Reviewing a PR before drafting review comments
- Evaluating a bot / automated finding (Bugbot, cursor[bot])
- Deciding whether a flagged issue is real

## Do Not Use When

- Authoring your own PR (see `pr-description`, `commit-discipline`)
- The change is trivial / docs-only

## Principles

### Verify the mechanism before judging
Don't conflate similar-sounding entities. Enumerate the distinct things, state what each does, **then** evaluate. (Failure mode: dismiss a finding by pattern-matching names, then overcorrect into an unnecessary fix — both from skipping this step.)

### Don't overcorrect after being wrong
Being wrong about a mechanism doesn't mean the opposite fix is needed. (1) update understanding, (2) evaluate whether the corrected understanding implies a real **runtime** problem, (3) only then propose a fix.

### Triage before drafting comments
After a full review, present a triaged list (worth raising vs not) and let the author confirm before drafting full comments with suggestions. Unfiltered findings add noise.

### Challenge workarounds before accepting them
Question the premise of a workaround (e.g. a test-config exclusion) — it may be masking a deeper issue that doesn't need the workaround at all.

## Common Pitfalls

| Mistake | Correct approach |
|---|---|
| Pattern-match on names, then dismiss/accept a finding | Enumerate distinct entities first, then judge |
| Propose the opposite fix after being wrong | Re-evaluate whether a real problem exists at runtime |
| Draft every finding as a comment | Triage first; confirm what's worth raising |
| Accept a workaround as necessary | Challenge the premise — is it masking the real issue? |
