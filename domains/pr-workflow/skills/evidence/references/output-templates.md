# Output templates

The shape a validation run ships in. **This file is the generator.** A correction to how a
run reads is a defect here, not in the comment it was noticed on — fix it here and regenerate,
or the same correction arrives again on the next run.

Drafting a template in a scratch directory is how that goes wrong: the comment gets better and
nothing else does.

**Scope: the PR-body section of a PR you authored, and the private record.** A comment or review on a PR is written in `/pr-comment` format instead (*"mms-evidence output uses /pr-comment format"*, 2026-11-13); the rules below on ordering, one review per subject and replies still apply to it. The private record's ids and status values are defined in [evidence-record.md](evidence-record.md); this file shapes how a run reads, not what its fields hold.

## The template

In a PR body the envelope sits as a `####` heading under the repo template's `### **After**`, inside
Screenshots/Recordings, never in a section of its own. In the private record it opens with `##`.

```markdown
<!-- VALIDATION_RUN_START -->
#### 🧪 Validation Run

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
exists to shape. Check 11 tests its position, not just its presence. The disclaimer belongs to the
PR-body section and the private record only; in a review it follows the ask, once at most
(`/pr-comment`).

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

## Inline comments post in importance order

When a run attaches findings to lines in the diff, **post them most-important-first**. GitHub
renders inline comments in file order regardless, but the posting order is what a reader
encounters in the notification stream and in the review summary, and it is the only ordering
signal the run controls.

Do not post in file order and then add a ranked index to the summary comment to compensate. The
index is a second copy of the finding list that has to be kept in sync with the first, and it
buys nothing a correctly-ordered post would not already have given.

**"File order" is not an organising principle a reader recognises.** It is an artifact of how the
diff was walked. At most it groups findings that share a file; it never signals importance, and
naming it in the prose ("the comments sit in file order, which is not their order of importance")
draws attention to a property of the tooling rather than of the change — the same defect as
publishing lane ids. Say nothing about ordering; just order it correctly.

## Every finding in a PR-body section carries a valence marker

**Scope: a body section of a PR you authored, and the private record.** A comment or review on a PR opens with its ask and the reason for it, and carries no valence marker; the only severity it states is a `nit:` prefix (`/pr-comment`).

A finding opens with a marker stating which way it cuts, and **the marker is a phrase, not a
glyph**. The emoji is a scanning aid attached to the phrase; it never carries the valence alone:

```
🔴 **Materially negative — <finding>**
⚠️ **Weakens <what> — <finding>**
ℹ️ **Neutral — <finding>**
✅ **<what was checked and held> — <finding>**
```

An emoji-only opener — `⚠️ **The allowlist admits inherited keys**` — is banned. It reads as
marked while stating nothing: the reader gets a colour and has to infer the claim, and the
author never has to write the judgement as a sentence they would have to stand behind. That
gap is the whole point of the phrase.

This applies to **every** finding in a body section, and to the items of any list in one. Not the
first one, not the ones that felt severe enough to warrant it.

The failure mode is partial application. Marking two findings out of three does not give the
reader a partial signal, it gives them a broken one: the unmarked finding reads as deliberately
unranked, and they cannot tell whether the omission means *neutral* or means *nobody decided*.
A consistently-marked set is scannable; an inconsistently-marked set is worse than none.

**`nit:` is severity, not valence, so in a body section it does not substitute.** It says how much
the finding matters and nothing about which direction it points. A nit there still takes its
marker — `ℹ️ nit: …` — because the two carry different information. In a comment or review the
`nit:` prefix is the only severity marker, and no valence marker accompanies it.

Section headings that introduce a finding take the marker too. `❓` marks a question being
handed to a human, which is a routing label rather than a valence; where a section states a
finding *and* hands over a question, the finding's marker goes on the heading and the handover
goes in the closing line.

## Declining to mark something red is a verdict too

On the lanes that forbid rendering security verdicts, the constraint is usually read as *do not
escalate*. It is symmetric. Rating a finding `⚠️` instead of `🔴` because you worked out that
the current consumer makes it inert is an exploitability analysis — the exact judgement the
constraint hands to a human — and it reaches the reader as a settled conclusion rather than as
the reasoning it actually is.

Downgrades feel safe because they look like restraint, so they escape the check that an
escalation would trigger. They are not safe: a `⚠️` on a stated-property violation tells the
reviewer it has been weighed and found minor, on your authority, using analysis you were told
not to perform.

**Mark what you established, not what you predict it leads to.** A stated security property that
does not hold is materially negative *about the property*, whatever the current downstream
consumer happens to do with it. Put the inertness in the body as a finding of its own — *the
containment lives in the consumer, not in the route* — where the reviewer can see the reasoning
and re-rate it. That sentence is worth more than the glyph it would have justified.

## Post a finding set as one review, never as N line comments

GitHub has two ways to attach a comment to a line, and they are not interchangeable.

| endpoint | result |
|---|---|
| the pull's **comments** collection | one standalone review **per call** — N calls means N review ids, N notifications, no body binding them |
| the pull's **reviews** collection, with a `comments[]` array | one review, one notification, one editable body |

Always the second. Build the payload with the review body plus a `comments` array of
`{path, line, body}` entries **in importance order**, and send it as a single call.

Nothing errors in the per-call form. The comments appear, they land on the right lines, and the
run looks finished — the defect is visible only in `pull_request_review_id`, a field nobody reads
unless they already suspect. It is also unrepairable after the fact: edits do not re-notify, so
the author has already received N separate notifications, and consolidating means deleting and
reposting, which notifies again.

The ordering rule above depends on this one. Posting order only survives inside a single review;
across N separate reviews GitHub renders in file order regardless, which silently discards the
ranking the run just spent its judgement on.

Enforced by `hooks/pr-evidence-gate.py` (`_block_unbatched_line_comment`), which blocks a POST to
the per-comment endpoint unless a marker certifies it is genuinely a lone standalone comment.
Replies are exempt — the replies sub-resource is threaded by construction.

## A reply never restates what the other person just wrote

They pasted the link, quoted the line, named the file. Reflecting it back — *"that's the phishing
hotlist ADR"*, *"you're asking whether X"*, *"as you noted, Y"* — answers nothing and spends the
reader's attention confirming they can read their own message.

Reply with the delta only: what they did not have. A question of the form "is it A?" is answered
by "no, B", not by characterising A.

The same cut applies to explaining *why* when they asked *which*, and to gratitude or context
belonging to a different thread. One thread, one question, one answer.

## Signals to ignore: `policy-bot` and `risk:*` labels

Two things on a MetaMask PR look like evidence and are not.

**`policy-bot` checks** are the approval requirement rendering as a check. A red `policy-bot`
means "not yet approved by the required reviewers", not "something is failing" — reporting it as
a failing check tells the author their code is broken when what is missing is a human. Exclude it
from any check count, and never cite it as a result.

**`risk:low` / `risk:medium` / `risk:high` labels** are triage metadata, applied by process rather
than derived from the diff. `risk:high` on a dead-code deletion is not a signal that the deletion
is dangerous, and treating it as one manufactures a finding out of a label — worse, it invites an
"open for review" question about why the label is set, which is a question about the labelling
process rather than about the change.

Neither belongs in a finding, an open question, or a check tally. Read the diff.

## Read the target's comment thread before drafting

Everything already on the pull request is prior art. Bot findings, author replies, resolved
threads. One API call, before any finding is written:

```
gh api repos/O/R/pulls/N/comments --paginate
gh api repos/O/R/issues/N/comments --paginate
```

**Author replies are constraints, not opinions.** When the author says *"we can't and don't do
rollbacks"*, rollback-safety is not a weak finding, it is not a finding — the axis does not exist
in that project. A comment contradicting an author reply is wrong rather than bold, and it reads
as not having looked.

Per finding, before it ships: does its subject already appear in the thread? Cite and extend, or
drop it. Never restate it as new. A finding a bot filed first and the author already answered is
the third instance of a settled question, and it costs the author more than it costs you.

The reason this gets skipped is that reading the thread produces *deletions* rather than findings,
and a run measured by findings-produced is maximised by not reading it.

## Never edit or delete a comment someone has engaged with

Once a comment has a reply or a reaction, it stops being solely yours. Do not edit it and do not
delete it — not for a phrasing fix, a corrected fact, or a withdrawn duplicate — unless the user
specifically directs that write.

**"Edits are silent" describes the author's cost, not the reader's.** Silence is about
notification. The cost of editing an engaged comment lands on the other party: their reply now
answers text that no longer exists, a quoted fragment can resolve to nothing, and the exchange
reads as though they misread. Deleting orphans their reply outright.

One call before any `PATCH` or `DELETE` against a comment id:

```
gh api repos/O/R/pulls/N/comments --paginate
```

Non-zero replies or reactions ends the decision. Withdraw in a *new* reply if withdrawal is
wanted, leaving the original intact so the thread still reads.

And do not let a duplicate finding become a deletion. Filing it as an extension of prior art
instead of as new is a rule about form; it is not a verdict that the finding was worthless, and
an author who has already answered it has spent attention that deleting throws away.

## Weight the rhetorical prior on a reviewer's questions

In code review, experienced engineers use questions as rebuttals, as teaching, and as Socratic
pointers far more often than the punctuation suggests. Weight that base rate higher than the naive
reading — **and no higher than that.** This is a calibration, not a default: plenty of review
questions are real, and treating them all as rhetorical is the same error mirrored.

**The discriminator is whether the asker plausibly lacks the answer.** Someone who wrote the
subsystem asking a factual question about it is making a point. Someone asking about intent, a
preference, or something outside their view is enquiring.

| reply | reading |
|---|---|
| *"do we have migrations with retry?"* — from the person who writes the migrations | rhetorical; the question **is** the refutation |
| *"is this the right ADR?"* with a link to the wrong one | genuine; he went looking and could not resolve it |
| *"would you rather X or Y?"* | genuine; preference is not derivable from the code |
| *"i don't know what this even means"* | not a question — feedback that the writing failed |
| *"I didn't know there was an API that could do that."* | acknowledgement; the finding landed |

Ask what changes if it goes unanswered, and whether the asker could have answered it themselves.
Do not queue a reply as an open item on the strength of a question mark, and do not dismiss one on
the strength of this rule either.

**When a reply says the writing was unclear, fix the writing next time rather than explaining in
the thread.** The sentence that drew *"i don't know what this even means"* was `L21 runs
unconditionally` — a bare line address plus a property, which makes the reader resolve the number
and then infer why it matters. Quote the statement and link the line:
`` `versionedData.meta.version = version` is set before any of the four early returns can skip it ``.

## Never write in the first person

These publish under a human's GitHub account. **"I did not verify the version numbers" reads as
that person personally declining to check** — when a bot wrote it. The byline is theirs; the voice
must not impersonate them. It also quietly misattributes judgement: a reader weighing "I could not
establish X" is weighing the account holder's competence, not a run's scope.

| instead of | write |
|---|---|
| I did not verify X | X was not verified here · not verified: X |
| I could not establish X | X is not established · this read could not reach X |
| I did not enumerate the call sites | the call sites were not enumerated |
| I diffed what is committed | what is committed was diffed |
| I anchored the suggestion to the write | the suggestion is anchored to the write |
| I cannot, so no block | not derivable here, so no block |
| I haven't executed the dispatch | the dispatch was not executed |

Passive voice is normally worth avoiding and is correct here: the actor genuinely is not the
person whose name is on the comment. "This read", "this run", and "not established" are the other
three forms that work.

Quoted text and code are exempt — a blockquote carries someone else's words, and a fence carries
source.

**Scope.** The ban covers the envelope and any narration of the run or the draft: what was
verified, corrections, earlier passes. A review or reply written as the poster (`/pr-comment`) may use
I or we for the poster's own stance and commitments, and an author reply that says "I'll fix" carries
the diff that fixes it.

Enforced by `attest-gate.sh` check 7, which previously named this in its own rationale ("the
byline may not be yours") while implementing only a fixed list of retraction phrases. Twelve
published comments carried first-person while it passed.

## A definite description never points across comments

Each inline comment and each body renders **alone**. A reader meets one of them with no sibling in
view, so "the durability point", "the attached comment", "the migration's one-shot behaviour" and
"the same surface" resolve to nothing — the referent lives in a different comment on a different
line, or in no comment at all.

Definite descriptions are the default way findings get cross-referenced while drafting, because at
drafting time every sibling is on screen. That is exactly the context the reader lacks.

| instead of | write |
|---|---|
| the durability point | the eviction-vs-quota finding on `persistence-manager.ts` |
| the attached comment | the version-window finding on `getAllKeys` |
| the migration's one-shot behaviour | migration 222 runs once and does not re-run |
| land on the same surface | both write to `storage.local` |

Counts have the same defect: "Five findings are attached to their lines" is unverifiable from a
comment that renders alone, and wrong the moment one finding is dropped. Name them or drop the count.

## Every identifier in the header is consumed by a sentence

A base sha, a version pin, a line range, a path declared in scope — each is either used by some
sentence in the body or cut. Verifying that it is *correct* is a separate audit from whether the
document needs it, and passing the first reads as passing the second because a checked fact looks
warranted.

A base sha earns its place only where something is diffed against it. A version pin earns its place
beside the doc quote it qualifies. Prefer wiring up to cutting when the detail is good: one clause
connecting the pin to the quoted documentation converts an inference into a quotation.

## The valence scale declares its axis and carries a visible key

A marker set with no stated axis grades different things in each comment — one finding's blast
radius, another's deploy property, a third's conditional — under one apparently-uniform scale.
"Materially negative" is not a severity until it says negative **on what**: the PR's stated goal,
users, merge-readiness.

State the axis once in the NOTE, and state what the emoji mean there too. A reader meeting a 🔴 on a
line has no key unless the comment carrying the key is the one they opened.

## Provenance a reader cannot see is not provenance

An HTML comment does not render on a GitHub page. A `passes-run` marker inside one can be entirely
honest, name only passes that genuinely ran, survive a truth audit — and reach **zero readers**.

Provenance that matters to the reader goes in visible text. HTML comments are for tooling that
locates and updates the comment, and nothing else.

## A lane sentinel is unique per PR and names the lane truthfully

Sentinels exist so tooling can locate and update a body. Two consequences the drafting step skips:

- **Uniqueness.** The same `<LANE>_DILIGENCE_START` on two PRs means anything resolving the sentinel
  can match the wrong comment. Scope it per PR.
- **Truthfulness.** `STORAGE_SWAP_DILIGENCE` on a key-enumeration PR names a lane that was not run.
  The sentinel is read by tooling, so a wrong one misfiles the artifact rather than merely reading oddly.

## Gloss the apparatus at first use

"Positive control", "falsifiers" as a countable noun, "the read" as a noun after "read at" appeared
as a participle — each is in-house vocabulary that parses instantly for whoever built the workflow
and stops a reviewer who has not met it. Six words of gloss at first use, or the audience's own term.

A pass holding the context cannot detect either defect, because it supplies the missing referent before noticing it was missing.

## Fold the evidence, never the finding

A long body collapses its *proofs*, not its *findings*. Each section keeps its heading — marker and
all — plus one line of conclusion outside the fold, and folds only the code excerpt, file listing or
permalink block that supports it. A reader who opens nothing still sees every finding and every
marker; opening a fold buys the proof.

```
### 🟢 **Worth the edit — <the finding>**

One line stating the conclusion.

<details>
<summary>Plain-text label for the evidence</summary>

...excerpt, listing, permalinks...

</details>
```

Three mechanics, measured against GitHub's renderer rather than assumed:

- `<details>` and `<summary>` go on their own lines, with a blank line after `</summary>`.
- **No markdown inside `<summary>`** — it renders literally, so `**bold**` ships as asterisks. Plain
  text, or HTML inline tags.
- Markdown in the body renders normally. The joined `<details><summary>…</summary>` form parses its
  body too; the split form is convention, not a fix for breakage.

Never folded: the headline verdict, the marker key, and the deliverable table.

`attest-gate.sh` check 15 exempts standalone HTML block tags for this reason — before that, the
hard-wrap check counted `<details>` and `<summary>` as wrapped prose, and joining them to satisfy it
is what put markdown inside the summary line.

## Markers are a triage, and the run says so

A run does not render accept/reject and does not grade exploitability — both are the reviewer's.
It does **prioritise its own flags**, and the markers carry that prioritisation, stated as the
run's own:

> Markers are this run's triage — which flags to read first, not how severe anything is and not
> whether to accept the PR.

Declining to prioritise is not neutrality. An unordered flag set hands the reviewer the same
sorting problem the run existed to solve, and "I am not qualified to rank these" is false of the
party that just read every call site.

**One glyph, one label.** The recurring defect is a marker that quietly covers two required
actions — `ℹ️` over both a deliverable and background, then `⚪` over both *housekeeping* and *no
action*. Both times the second meaning was added because the scale had no band for it.

**Never a severity gradient for dispositions.** 🔴/🟡/🟢 carries meaning the key cannot override:
🟡 reads as moderate concern while meaning *no concern*, 🟢 as *fine* while meaning *the one thing
worth doing*. Keep 🔴 for what to read first; use non-gradient glyphs for what to do.

**Order is computed, not composed.** Band first, then a recorded rank within the band — never a
proxy like capability count, and never the order the findings were written in. Six hand-orderings
on one comment left two of three flags at the bottom, because each pass moved only what the newest
correction named.

**A heading names the finding.** Not the timeline, not the SHA, not the capability list — those
belong in the lede. Headings accrete: each correction appends a qualification until the heading is
a paragraph.
