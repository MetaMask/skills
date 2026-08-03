# Output templates

The shape a validation run ships in. **This file is the generator.** A correction to how a
run reads is a defect here, not in the comment it was noticed on — fix it here and regenerate,
or the same correction arrives again on the next run.

Drafting a template in a scratch directory is how that goes wrong: the comment gets better and
nothing else does.

## The template

```markdown
<!-- VALIDATION_RUN_START -->
## 🧪 Validation Run

**Verdict:** <icon> <the conclusion, in words a reviewer can act on> — **Claim:** <the
falsifiable thing under test> head `<sha>` · <YYYY-MM-DD> · <check name in words>

> [!NOTE]
> Trial run of the [MetaMask evidence skills](<link>) — feedback welcome, on the finding or
> on whether this format is useful to a reviewer. Not a review verdict; nothing here blocks
> the PR.

<one sentence: what kind of evidence follows, and how it was arranged>

<captured artifact>

<one sentence, only if a second exhibit needs a transition>

<captured artifact>

**Follows from the above**

- <a consequence of a number in an exhibit above>
- <another>

**Open for review:** <the single question this run hands to a human, about THIS change>

<!-- VALIDATION_RUN_END -->
```

## What each slot is for

**Verdict line.** The conclusion, not the topic. *"one of the two conjuncts is tested"* and
*"six renders where one would do"* are conclusions; *"tested the hash predicate"* is a topic.
Icons: `✅` proven · `⚠️` partial or scoped · `📋` measured, no verdict asserted · `❌` failed.
Never `❌` for a gap in *evidence* — that reads as a verdict on the author's work.

**Check name, in words.** *red-on-base check*, *render-count check*,
*dependency-containment check*. Never the lane id: `B3` is an address into
[evidence-catalog.md](evidence-catalog.md), which the reviewer cannot open.

**The exhibits.** Whatever the runner wrote, pasted whole and unfolded. They should outweigh
everything else in the comment; 70% is a reasonable floor. Do not summarise them above
themselves — a table of your own restating theirs turns a measurement into your word for it.

**Follows from the above.** Bullets, each traceable to a number in an exhibit. If a bullet
needs three sentences, the exhibit is not carrying its weight.

**The disclaimer sits directly under the verdict, and stays a callout.** It is the frame a
reviewer needs *before* they read a verdict on their own PR from a source they have not seen
before — where feedback goes, and that nothing here blocks them. Edited by the same rules as
prose it drifts to the foot of the page in `<sub>`, where it arrives after the reaction it
exists to shape. Check 11 tests its position, not just its presence.

**Open for review.** One question, about this change. The runners' generic limits go to stderr
and the `.json` precisely so they do not end up here three times over; read them, and write
the thing a human should actually look at.

## Assembly

Templates carry `@@TOKEN@@` placeholders, one per exhibit, substituted with the runner's `.md`
verbatim. Substitution — never retyping — is what keeps the provenance line attached to the
numbers it vouches for.

Before posting, `scripts/attest-gate.sh <file>` must exit 0.

## Worked instantiations

Three runs assembled from this template, with the reasoning behind each choice, are in
[worked-examples.md](worked-examples.md).
