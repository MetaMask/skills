---
name: lavamoat-policy-diligence
description: Triage a LavaMoat policy change for least privilege — which newly granted capabilities can be dropped without breaking anything. Detection is delegated to `@metamaskbot update-policies` plus CI, and because the policy is generated from a real run, every grant has a call site by construction, so "each addition is justified" is a tautology and not the deliverable. Instead read each grant's use at the installed version to find its gate — a config flag nobody sets, an API nobody calls, a branch our payloads never take, an error-only path — and sort into removable / removable-at-a-cost / load-bearing, with the removal test (drop it, rebuild, run e2e) proposed for the policy owners to run. Lead with removal candidates and anything the reading turned up that bears on security; never render an accept/reject verdict, that call is the reviewer's. Hand it over untagged while the workflow is in trial. Triggers on /lavamoat-policy-diligence, or when asked about a LavaMoat policy grant, policy.json diff, capability containment, scuttling, allowScripts, or why a package needs a global/builtin. The specialized engine behind `supply-chain-audit`'s capability-containment lane.
maturity: experimental
---

# /lavamoat-policy-diligence

Detection is not the job. LavaMoat already tells you which capabilities a dependency change
grants: `@metamaskbot update-policies` regenerates the `policy.json` files from a real run of
the code, and CI's `validate-lavamoat-policies` fails the build if the committed policy drifts
from that regeneration. Re-deriving the diff by hand, or sorting the grants into
network/DOM/red-flag buckets, only re-does a machine that is already trusted.

**Finding the call site is not the job either — that search cannot fail.** The policy is
*generated from a real run*, so every grant in it corresponds to something the bundled code
did. "Each addition has a call site, therefore each is justified" is a tautology dressed as an
audit; it will report 11 of 11 justified every time, and a check that cannot come back negative
carries no information.

**The job is least privilege: which of these grants can be dropped without breaking
anything?** A grant exists because an identifier appears in bundled source. That is *not* the
same as a reachable path needing it — a capability read behind a config flag nobody sets, or in
a branch our usage never takes, is removable. So for each grant, ask what executes it under
*our* usage, and sort:

| | |
|---|---|
| **removable** | nothing on our path executes the read → candidate; propose the test |
| **removable at a cost** | only a convenience or error-detail path executes it → name the cost |
| **load-bearing** | our usage genuinely needs it → say so briefly and move on |

The lead is the first two rows plus anything the reading turned up that bears on security.
Load-bearing grants still each get a row in the capability → call-site table (step 5) — they just
don't get paragraphs.

> **Falsifier.** A grant you called load-bearing that a build with it removed still passes.
> The test is cheap and it is the only thing that settles the question: drop the grant from the
> resource, rebuild, run the relevant e2e. Propose it; the policy owners run it.

**Corollary — the reading is where the real findings come from.** Locating each call site means
reading the code that uses the capability, and that is when genuine issues surface: unbounded work
on remote input, a decode path with no size cap, a feature-detection fallback that makes a grant
droppable. Those observations are worth more than the grant inventory. Lead with them.

## Method

1. **Take the diff from LavaMoat; don't re-derive it.** The bot's `update-policies` run
   produces the authoritative delta and CI enforces it. Your input is the list of
   newly-`true` grants per package, not a hand-rolled scan. (`scripts/policy-audit.py` turns a
   base/head policy pair into that list as a worklist — it enumerates, it does not classify.)

   **When no current CI policy exists, regenerate locally — that is the fallback, not a
   competing method.** The bot hasn't run, the branch is unpushed, or a variant CI didn't
   cover: `yarn webpack:lavamoat:policy:build` (`:mv2` / `:mv3`) produces the same base/head
   pair to feed step 2. Note what changes and what doesn't: the *worklist* is equally valid,
   but its **provenance is weaker** — it reflects your node version, OS, and lockfile
   resolution rather than CI's. Say which source the diff came from when handing the
   justification over, and re-check against the bot's policy once it runs. Never regenerate
   locally *in preference to* an available CI policy; that re-does a trusted machine and
   substitutes a less reproducible artifact for a more reproducible one.

2. **Know what denial actually does before you reason about it.** An ungranted global is **absent
   from the package's endowments and reads as `undefined`** — it does not throw.
   `getEndowmentsForConfig` collects `whitelistedReads`, `makeMinimalViewOfRef` builds an object
   holding only those, and a `false` value simply keeps the path out of that list
   ([endowmentsToolkit.js](https://github.com/LavaMoat/LavaMoat/blob/f5e52ab457c16c3aea72cc8a9dd0833547dd7d2c/packages/core/src/endowmentsToolkit.js#L101-L162)).
   This is the whole basis of the analysis, so get it right: **do not confuse per-package
   `globals` policy with scuttling**, which is a separate root-realm mechanism. Asserting the
   wrong one to the LavaMoat maintainer got the reply "This is jibberish" (#45024, 2026-07-30).

   The consequence is what makes denial testable: a package that reads a global behind a
   `globalThis.X || <fallback>` guard **keeps working when denied**, because the read yields
   `undefined` and the fallback engages. A feature-detection shim is therefore evidence *for*
   removability, not against it.

3. **Read each grant's call site — then ask what executes it under our usage.** Read the
   dependency's code *at the version being installed*. Locating the use is the start, not the
   answer; the question the reading has to settle is whether anything on our path runs it. Look
   for the gate: a config flag (`BigNumber.set({CRYPTO:true})`), an API we never call
   (`.random()`), a feature-detection fallback, a branch keyed on a payload type we never send
   (`data instanceof Blob` — note this one *does* break when denied, since `instanceof undefined`
   throws), an error-only path. A gated read whose gate we never open is a removal candidate.

   Check reachability from *our* side too, not just the dependency's: does our code subscribe to
   the feed, import the subpath, take that option? A capability behind a feature we don't use is
   the cleanest removal there is — and a capability behind one we *do* use is load-bearing, which
   is worth one line and no more.

4. **Cite it at a pinned tag, not a branch head.** A permalink to `…/blob/<tag>/<file>#Ln` is
   immutable; a branch-head link drifts out from under the citation. The permalink *is* the
   evidence — a reader clicks it and lands on the code, convinced without re-running anything.
   "It needs X" retyped into a table proves nothing about provenance.

5. **Lead with removal candidates and anything security-relevant — then give the full table.**
   Open on what can be dropped and what the reading turned up, not on an inventory. But every
   grant still gets its own row in the capability → call-site table, load-bearing ones included:
   that mapping is what a reviewer came for, and a load-bearing row is one short row, not a
   reason to merge it into prose with its neighbours. **Removed grants get their names only**
   (`WebSocket` and `CustomEvent` are removed by this bump) — no table, no justification column,
   since a removal reduces capability and needs no defence. The exception is a removal that is
   itself interesting: one that was load-bearing implies a behaviour change worth a sentence.

   Target a few hundred words of *prose*; the table does not count against that and must not be
   compressed to hit it. (Violated on extension#45024, 2026-07-30 — a trim pass dissolved the
   table into paragraphs and destroyed the comment's key content.)

   **The accept/reject call belongs to the human reviewer; never write it.** No `accept`
   column, no `REJECT`, no "Verdict: safe to take", no ✅/❌. Those words do the reviewer's
   deciding for them and anchor the judgment before they have read the evidence — and if the
   call is wrong, it is wrong in a document that looks authoritative. Describing *risk* is in
   scope where it is a fact about the capability ("this reads the global on every exception
   path", "these are decode and timer primitives, no filesystem or subprocess reach"); the
   disposition is not. State findings and open questions, and let the reviewer conclude.
   (Violated on extension#45024, 2026-07-30 — 11 `accept` cells and a "Verdict" section.)

   **A grant with no locatable call site is a real finding, and rare.** On a generated policy it
   usually means the identifier is present but the generator saw it in a path you haven't found
   — say what you searched rather than implying nothing uses it.

6. **Put it where the policy is reviewed — but do not tag anyone.** Post the justification as a
   comment on the PR carrying the `policy.json` change, so it lands in front of the people who
   own the policy rather than standing as a unilateral assertion elsewhere.

   **Show the full comment body in the response before running `gh pr comment`.** The permission
   prompt renders the command, not the `--body-file` contents, so approving it blind is approving
   unseen text published under the user's name. Paste the table and prose inline first, then post.
   Naming the scratchpad path instead of showing the text is the same failure.

   **Do not add `cc @MetaMask/policy-reviewers` — or any `@`-mention — unless the user asks for
   it in this session.** Authorization to post a comment is not authorization to notify a team,
   and this step being written into the skill does not supply that authorization; editing the
   comment afterwards does not un-send the ping. Draft without the tag, post, then offer the cc
   line as a separate ready-to-paste suggestion.

   **Status as of 2026-07-30: hold the cc — this workflow is in a trial phase.** The tag is
   expected to become standard once the output has proven itself; it is being withheld for now,
   not forbidden on principle. So the rule is about *timing being the user's call*, not about
   tagging being wrong. Re-confirm before assuming trial phase still applies — and even after it
   ends, the tag goes in because the user says so, not because this line stops saying "hold".
   (Violated on extension#45024, 2026-07-30.)

7. **One reason covers the variants.** Extension builds carry several policy files
   (`lavamoat/webpack/{mv2,mv3}/{beta,experimental,flask,main}/policy.json`). When the grant
   delta is identical across them, a single justification covers all — confirm the identity
   once. A grant that appears in one variant and not others is itself a question.

## Output

**The capability → call-site table is the deliverable. Never dissolve it into prose.**
One row per grant, every grant, with its permalink and its removability in the row. A reviewer
scans the column, not paragraphs — 11 rows is denser and faster to read than three paragraphs
carrying the same 11 facts, so the table *is* the trimmed form. Prose around it is what gets cut.

```
LavaMoat grants — <package> <old> -> <new>

<one or two lines: the call-site search is tautological on a generated policy;
 the question is what can be dropped>

| capability | package | call site | can it go? |
|---|---|---|---|
| <cap> | <pkg> | <permalink, named by what the code does there> | yes — <the gate our usage never opens> |
| <cap> | <pkg> | <permalink> · <second permalink if two sites> | at a cost — <what degrades> |
| <cap> | <pkg> | <permalink> | no |
…every grant gets a row…

Test for the "yes" rows: drop the grant, rebuild, run <suite>.
Note on <cap>: <what the reading turned up that bears on security>
Removed: <cap>, <cap>.        ← names only, no table, no justification column
Loose ends: <what you could not settle>
<identity across N policy files + observation artifact link>
```

Order is the point: the lead frames the question, the table answers it, and a reviewer hits the
removable rows immediately. Post it on the PR carrying the `policy.json` change, untagged.

**Runtime claims need a runtime artifact.** "Byte-identical across all 8 policy files" is an
observation, not something a `/blob/` link witnesses — publish the check output (JSON) and link
it. The `pr-evidence-gate` hook enforces this and will block the post otherwise; it is right to.

## Worked example — extension#42867 (@sentry/browser 8.33.1 → 10.38.0)

The bump added grants across the `@sentry/*` subtree; the bot produced the diff and CI
enforced it — detection was never in question. On `mv2/main/policy.json` a reviewer questioned
two grants: *"I wonder what it's using this for. Likewise for `importScripts`."* Each was
answered with the upstream line, pinned to `10.38.0`:

- **`WebAssembly`** → the event builder's `isWebAssemblyException` check, which runs on *every*
  exception (defined L165, called on the exception path L186 and L203):
  `https://github.com/getsentry/sentry-javascript/blob/10.38.0/packages/browser/src/eventbuilder.ts#L163-L168`
- **`importScripts`** → the profiling utils' main-thread detection at module scope
  (`typeof importScripts === 'undefined'`):
  `https://github.com/getsentry/sentry-javascript/blob/10.38.0/packages/browser/src/profiling/utils.ts#L33-L34`

Both run unconditionally — the exception path and module scope — and under scuttling the read
itself throws unless excepted, so both are load-bearing with no gate to close. That is the
useful conclusion: *not* "each grant has a reason" (it always will) but "neither is removable,
and here is the unconditional path that makes it so."

**Counter-example from extension#45024, which the first pass got wrong.** That comment reported
"11 additions, 11 reasons, each resolving to a line" as its headline. Tautological — the policy
is generated from a run, so the count was guaranteed. Reading for *gates* instead surfaced the
actual findings: `crypto` on `bignumber.js` is reachable only via `BigNumber.set({CRYPTO:true})`
or `.random()`, neither of which the consumer calls, so it is a removal candidate; and the
`DecompressionStream` grant sits on a `fastAssetCtxs` decode path that inflates remote input
with no size cap. Same reading, same permalinks — the first framing hid both.

## Scope — what this skill is NOT

This covers **capability containment only**: what a dependency is *permitted to reach* under
LavaMoat, and whether each new permission has a reason. It says nothing about whether the
dependency is *known-vulnerable* or *behaving maliciously* — those are different questions with
different detectors and different falsifiers, and they live in `supply-chain-audit`:

| question | detector | skill |
|---|---|---|
| does this dep now reach a capability it didn't? | LavaMoat policy diff | **this skill** |
| is this dep version known-vulnerable? | `yarn npm audit`, advisories | `supply-chain-audit` |
| is this package behaving maliciously / newly-authored / install-scripted? | Socket Security | `supply-chain-audit` |

A clean policy diff does not mean a safe dependency, and a known CVE does not show up as a new
grant. Run the umbrella skill when the question is "is this bump safe"; run this one when the
question is "why does it need that".

## Called by supply-chain-audit and evidence

`supply-chain-audit` delegates its capability-containment lane here. `evidence` keeps
**supply-chain** as an evidence category and packages the per-grant justification (accept /
reject, each with its permalink) posted where the policy is reviewed. Engine helper:
`scripts/policy-audit.py`. Usable standalone whenever a policy grant needs a reason.
