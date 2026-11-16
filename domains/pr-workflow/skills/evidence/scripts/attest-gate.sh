#!/usr/bin/env bash
#
# attest-gate — phase 0 of /attest. Mechanical, no model, hard fails only.
#
# Everything checkable is checked before anything is asked of a model, because a
# model asked "is this good evidence?" answers from inside the frame that produced
# the text. These are greppable, so they are not a matter of judgement.
#
# Usage: attest-gate.sh <artifact.md> [--reference <showcase.html>]
#
#   0  all checks pass       → proceed to the dispatched passes
#   1  one or more failed    → BLOCKED, do not publish
#
# --target owner/repo#N is how check 12 learns where this is going. Without it the gate
# cannot tell a live review from a merged one, and the difference is the whole point.
#   2  usage error
set -uo pipefail

FILE="${1:-}"; REF=""; TARGET=""; PARENT=""; MODE="run"
shift || true
while [ $# -gt 0 ]; do
  case "$1" in
    --reference) REF="${2:-}"; shift 2 ;;
    --target)    TARGET="${2:-}"; shift 2 ;;
    --diligence) MODE="diligence"; shift ;;
    --reply)     MODE="reply"; shift ;;
    --parent)    PARENT="${2:-}"; shift 2 ;;
    --inline)    MODE="inline"; shift ;;
    *) shift ;;
  esac
done
[ -n "$FILE" ] || { echo "usage: attest-gate.sh <artifact.md> [--reference <file>] [--target <owner/repo#N>] [--diligence|--reply|--inline] [--parent <file>]" >&2; exit 2; }
[ -f "$FILE" ] || { echo "attest-gate: not found: $FILE" >&2; exit 2; }

FAILED=0
pass() { printf '  PASS  %s\n' "$1"; }
fail() { printf '  FAIL  %s\n       %s\n' "$1" "$2"; FAILED=$((FAILED+1)); }
has()  { grep -qF "$1" "$FILE"; }
hasre(){ grep -qE "$1" "$FILE"; }
hasi() { grep -qiE "$1" "$FILE"; }   # case-insensitive; a separate function because
                                     # `hasre -i '<pat>'` silently greps for "-i".

echo "attest-gate: $FILE"
echo

# A thread reply is a third artifact class. It answers a person in a conversation: no marker
# pair to replace on re-run, no canonical header, no verdict, no trial disclaimer, and it is
# not a run so it declares no reasoning passes. Handed to the default mode it fails eight
# envelope checks on shape alone and reports BLOCKED, which reads as "this gate does not apply
# here" — so it stopped being run at all, and never-submitted is indistinguishable from passed.
# --reply skips the envelope by name and keeps every content check, because those defects
# (prescriptions, process narration, unearned verdicts, dead destinations, untraceable figures,
# hard-wrapped prose) are shared across all three classes.
envelope_na() {
  [ "$MODE" = reply ] || return 1
  printf '  SKIP  %s\n' "$1 — not applicable to a thread reply"
  return 0
}

# A diligence comment (lavamoat-policy and its siblings) renders no verdict and deliberately
# does not use the Validation Run envelope — see "One comment per evidence kind" in
# references/evidence-publishing.md. That exemption used to mean it was checked by nothing at
# all: attest-gate only knew the Validation Run shape, and pr-evidence-gate.py by design does
# not trip on a body claiming no verdict. So every rule the diligence skills state about their
# own output had no execution path, and a comment shipped with an unwitnessed local `npm pack`
# result and untraceable integers. --diligence swaps the envelope checks for that contract's
# own; everything downstream of the envelope is shared, because those defects are shared.
if [ "$MODE" = reply ]; then
  envelope_na "1 marker pair"
  envelope_na "2 canonical header"
  envelope_na "3 verdict line"
elif [ "$MODE" = inline ]; then
  # An inline comment has no envelope: no marker pair (GitHub anchors it to a line, and a
  # re-run replaces by comment id, not by marker), no canonical header, no verdict line. It
  # still carries every substantive obligation — pinned citations, no process narration, no
  # "what would close it", figures tracing to an exhibit.
  #
  # Without this mode the only options were --diligence, under which a perfectly good inline
  # comment fails four to six envelope checks, or no gate at all. Seven inline comments shipped
  # ungated on #45504 for exactly that reason: a check that cannot pass teaches you to skip it.
  printf '  SKIP  %s\n' "1 marker pair — an inline comment is anchored by id, not by marker"
  printf '  SKIP  %s\n' "2 canonical header — an inline comment has no header"
  printf '  SKIP  %s\n' "3 verdict line — an inline comment carries none"

  # An inline comment opens with its ask and the reason for it, and states severity only as a
  # `nit:` prefix (/pr-comment). A valence marker opener is the Validation Run body's convention.
  hasre '^(🔴|⚠️|ℹ️|✅|🟢|🟡|🔵|🟠|⚪|🔒)[[:space:]]+(nit:[[:space:]]+)?\*\*[^*]*—' \
    && fail "3b opens with the ask" "opens with a valence marker — an inline comment leads with the ask and its reason, and severity goes only in a 'nit:' prefix" \
    || pass "3b opens with the ask"

elif [ "$MODE" = diligence ]; then
  # Any diligence lane, not only lavamoat-policy: the envelope is <LANE>_DILIGENCE_START/_END
  # with a matching _END, and the opener is a bold one-line subject. Hardcoding the lavamoat
  # strings meant every other diligence read (deeplink, privacy-egress) failed checks 1 and 2
  # for having the wrong lane name, which is not a defect in the comment.
  LANE="$(sed -n 's/.*<!--[[:space:]]*\([A-Z0-9_]\{1,\}\)_DILIGENCE_START[[:space:]]*-->.*/\1/p' "$FILE" | head -1)"
  if [ -n "$LANE" ] && has "${LANE}_DILIGENCE_END"; then
    pass "1 marker pair"
  else
    fail "1 marker pair" "no <LANE>_DILIGENCE_START/_END pair — a re-run appends a duplicate instead of replacing, and the pair must not be VALIDATION_RUN_* or an evidence re-run would eat this region"
  fi

  hasre '^\*\*[^*]+\*\*[[:space:]]*$' \
    && pass "2 canonical header" \
    || fail "2 canonical header" "no bold one-line subject opener (e.g. '**LavaMoat grants — <package> <old> -> <new>**') — the reader cannot tell what was read from what"

  printf '  SKIP  %s\n' "3 verdict line — a diligence comment renders none, by contract"

  # 3c — a body's FINDING sections carry a valence marker, exactly as inline comments do.
  # The rule ("every applicable finding, on every surface") was written the same day the
  # --inline valence check was, and enforcement landed only on the inline path — so the one
  # surface where the markers were actually dropped had nothing checking it. #45111 shipped
  # a body with three findings and zero markers while the gate reported phase 0 clean.
  #
  # Residue sections are not findings and are exempt by name; anything else headed `###`
  # is treated as a finding and must open with a marker.
  UNMARKED="$(
    grep -E '^###[[:space:]]' "$FILE" \
      | grep -vE '^###[[:space:]]*(🔴|⚠️|ℹ️|✅|❓|🟢|🟡|🔵|🟠|⚪|🔒)' \
      | grep -viE 'not established|not checked|not covered|open for review|worth coordinating|residue' \
      | head -3
  )"
  if [ -n "$UNMARKED" ]; then
    fail "3c finding sections carry a marker" "headed section with no valence marker: $(printf '%s' "$UNMARKED" | head -1) — a marked set is scannable, a partly-marked one is worse than none because the reader cannot tell neutral from undecided"
  else
    # A body whose findings are all bolded rather than headed still needs at least one.
    # A finding may head a section (### 🔴 …) or be the summary of a collapsed one
    # (<details><summary>🔴 …). Both are marked; only the pattern differed.
    if grep -qE '^(###[[:space:]]*|<details><summary>)?(🔴|⚠️|ℹ️|✅|🟢|🟡|🔵|🟠|⚪|🔒)' "$FILE"; then
      pass "3c finding sections carry a marker"
    else
      fail "3c finding sections carry a marker" "no valence marker anywhere in the body — every finding it states arrives unranked"
    fi
  fi

  # 3d — a marker set that does not say what it grades is decoration. The severity scale
  # (🔴/⚠️/ℹ️/✅) is the validation-run axis; a lane with its own dispositions has a different
  # one, and importing the scale makes the least-committal marker the residue class for
  # everything it cannot express. #45664 shipped ℹ️ on both the deliverable and on background.
  if grep -qE '(🔴|⚠️|ℹ️|✅|🟢|🟡|🔵|🟠|⚪|🔒)' "$FILE"; then
    if grep -qiE 'graded on|the axis|markers? (mean|read)|key:|— removable|scale below' "$FILE"; then
      pass "3d marker scale declares its axis and key"
    else
      fail "3d marker scale declares its axis and key" "markers are used with no stated axis and no key — a reader meeting one has nothing to resolve it against, and the same marker silently covers findings needing different actions"
    fi
  fi
else
has 'VALIDATION_RUN_START' && has 'VALIDATION_RUN_END' \
  && pass "1 marker pair" \
  || fail "1 marker pair" "no VALIDATION_RUN_START/_END — a re-run appends a duplicate instead of replacing"

hasre '^#{2,4} 🧪 Validation Run' \
  && pass "2 canonical header" \
  || fail "2 canonical header" "missing the '🧪 Validation Run' heading (## in the private record, #### under ### **After** in a PR body)"

hasre '^\*\*Verdict:\*\*.*\*\*Claim:\*\*' \
  && pass "3 verdict line" \
  || fail "3 verdict line" "no '**Verdict:** … — **Claim:** …' — valence is not legible at a glance"
fi

# A run outside the repo's toolchain pins a different thing. A browser-memory lane
# names "Firefox 153.0"; a repo lane names a head SHA and a lockfile hash. Both are
# pins, and a check that only knows the second one fails every run of the first —
# telling an author their pinned environment is unpinned.
# A diligence comment pins a read, not a run: its citations are permalinks, and the thing
# that can rot is a branch-head link drifting out from under the line it names.
if [ "$MODE" = reply ]; then
  envelope_na "4 environment pinned"
elif [ "$MODE" = diligence ] || [ "$MODE" = inline ]; then
  if grep -qE 'https://github\.com/[^ )]+/blob/(main|master|develop|HEAD)/' "$FILE"; then
    fail "4 citations pinned" "a permalink points at a branch head; it will drift off the line it cites. Pin a tag or a 40-char SHA"
  elif grep -qE 'https://github\.com/[^ )]+/blob/[^/]+/' "$FILE"; then
    pass "4 citations pinned"
  else
    fail "4 citations pinned" "no source permalink at all — the permalink IS the evidence here; a retyped 'it needs X' proves nothing about provenance"
  fi

  # 4b — check 4 is EXISTENCE (>=1 permalink anywhere); this is COVERAGE. A line-level "does
  # this line contain a URL" test is not enough: the line can carry a permalink to something
  # else entirely, which is how "the full grant table is in the policy review comment on this
  # PR" shipped on a line holding four dependency links. Strip markdown link spans first, then
  # look for the referring expression in what is left — containment, not proximity.
  DANGLING="$(
    sed 's/\[[^]]*\]([^)]*)//g' "$FILE" \
      | grep -onE '(in|see|per|from) the [a-z][a-z -]{2,30}(comment|review|body|section|table|thread)' \
      | head -2
  )"
  if [ -n "$DANGLING" ]; then
    fail "4b cross-references resolve" "a referring expression names a sibling artifact and is not itself a link: $(printf '%s' "$DANGLING" | head -1) — the reader must search for something whose URL you hold"
  else
    pass "4b cross-references resolve"
  fi
else
hasre '[Hh]ead `[0-9a-f]{7,}|sha256|node `v|yarn\.lock `|[Ff]irefox [0-9]+\.[0-9]|[Cc]hrom(e|ium) [0-9]+\.|[Ss]afari [0-9]+\.|[Nn]ode v?[0-9]+\.[0-9]' \
  && pass "4 environment pinned" \
  || fail "4 environment pinned" "no head SHA, lockfile hash, or pinned toolchain/browser version"
fi

# 5 — the one that matters, and it asks for a MEDIUM, not for better text.
#
# Every earlier version of this check tested a property of the plaintext: does it carry a
# provenance marker, does the command contain a placeholder, is the path local. Each caught
# one defect and missed the next, because every property of plaintext is forgeable by
# whatever emits the plaintext. Four runs shipped that way.
#
# So the block below is necessary but is no longer the evidence. The evidence is an image
# of the tool's own surface, a link that re-executes, or a hosted artifact the reader
# fetches without going through the author. If the artifact is small, nothing was attached.
#
# `Produced by` attests who WROTE the block, not that the block is the tool's own output.
# A script that composes a summary table and stamps itself passes on the marker alone —
# which is how a run shipped with a table the script had written, one grepped line, and a
# command reading `yarn jest <generated probe>`. A `$` line carrying a placeholder is the
# tell: it looks reproducible and cannot be run.
# An image, a re-executing link, or a hosted artifact — verification that does not route
# through the author. `Produced by` and `evidence-artifacts/` are provenance, not this.
# In diligence mode the medium is the permalink, already required by check 4 — a reader
# clicks it and lands on the line. What a permalink cannot witness is what the AUTHOR RAN,
# and that is the defect this variant catches: an `npm pack` unpacked locally, a grep over a
# tarball, a byte-comparison across policy files. Those read as properties of the package
# and are actually properties of an unwitnessed local run. State them as the search
# ("searched N files, no match") or publish the output; do not assert them as fact.
# A reply owes a capture on the same terms as a diligence comment, not on the Validation
# Run's unconditional terms: a run's job is to show a measurement, a reply's is to answer a
# person, and its fenced blocks are usually a suggested change rather than something ran.
# So the trigger is "did this artifact show a command or a run result", which is the
# diligence conditional, already reviewed. A reply that pastes terminal output still owes
# the reader something fetchable.
if [ "$MODE" = diligence ] || [ "$MODE" = inline ] || [ "$MODE" = reply ]; then
  # A permalink is the medium for a CITATION — a reader clicks it and lands on the line. It is
  # not the medium for anything you RAN. The first version of this branch tested for phrases
  # ("npm pack", "complete specifier set") and passed an artifact whose entire results section
  # was hand-typed to look like terminal output, because none of those words appeared in it.
  # That is the regression the block below already documents as having shipped four times:
  # every property of plaintext is forgeable by whatever emits the plaintext. So the test is
  # the same one, on the same terms — if the artifact shows a command or a run result, it owes
  # the reader something fetchable.
  # `/blob/` is a CITATION, never a capture — it witnesses a line in a file, not a run.
  # Excluding it matters: a permalink to `policy-override.json` ends in `.json` and satisfied
  # a naive extension test, so an artifact whose entire results section was hand-typed passed
  # on the strength of a source link.
  if hasre '^\$ |^  *\$ |\bexit [0-9]|\bexit=[0-9]' \
     && ! grep -qE 'actions/runs/[0-9]|/gist\.|!\[[^]]*\]\(https?://' "$FILE" \
     && ! grep -E 'https?://[^ )]+\.(txt|log|json)\b' "$FILE" | grep -qv '/blob/'; then
    fail "5 captured artifact" "shows a command or a run result with nothing a reader can fetch — a fenced block is your transcription, whatever produced it. Publish the log/gist/run and link it"
  else
    pass "5 captured artifact"
  fi
elif ! hasre '!\[[^]]*\]\(https?://|<img [^>]*src="https?://|actions/runs/[0-9]|/gist\.|https?://[^ )]+\.(png|jpg|jpeg|gif|svg|txt|log|json)\b'; then
  fail "5 captured artifact" "no reader-verifiable capture — an image of the tool surface, a run link, or a hosted artifact. A fenced block is the author\'s transcription, whatever produced it. A raw log or JSON dump counts only beside a link or visual that carries the verdict"
  # No separate attribution test: a hosted artifact the reader fetches is its own
  # attribution, and requiring `Produced by` on top of it only fails runs whose
  # evidence is stronger than a stamped fenced block.
elif grep -qE '^\$ .*<[a-z][a-z ._-]*>' "$FILE"; then
  fail "5 captured artifact" "a console command contains a placeholder — $(grep -m1 -oE '^\$ .*' "$FILE") is not a command a reader can run"
elif grep -qE '^\$ .*(/tmp/|/home/|/Users/)' "$FILE"; then
  # A helper script in /tmp, or any absolute local path, is unreproducible by
  # construction. `capture.sh` records the command honestly — but honestly
  # recording `bash /tmp/dup.sh` still publishes a recipe nobody else can follow.
  # Inline the commands, or ship the helper where the reader can reach it.
  fail "5 captured artifact" "a console command references a local-only path — $(grep -m1 -oE '^\$ .*(/tmp/|/home/|/Users/)[^ ]*' "$FILE") cannot be run by a reader"
elif [ "$(grep -cE '^\$ ' "$FILE")" -gt 1 ] && \
     [ "$(grep -E '^\$ ' "$FILE" | sed 's/ *#.*$//' | sort -u | wc -l)" -lt "$(grep -cE '^\$ ' "$FILE")" ]; then
  # Two identical commands shown as producing different outputs. The difference
  # came from an edit made between runs, so the block misstates its own cause:
  # running it twice reproduces the first number twice.
  fail "5 captured artifact" "two console commands are identical but shown with different output — the block does not say what actually differed between them"
else
  pass "5 captured artifact"
fi

if hasi 'what would close it|what would prove it|closing it requires'; then
  fail "6 no prescriptions" "contains a 'what would close it' section — that is an unfinished run, formatted to look finished"
elif hasre '^\s*(Run|Switch|Assert|Scroll|Compare) '; then
  fail "6 no prescriptions" "imperative-mood instructions to the reader — the artifact does not exist"
else
  pass "6 no prescriptions"
fi

# Drafting history is the author's, not the reader's: a reader who never saw the earlier
# version learns nothing from being told it existed, and the byline may not be yours.
# The list grew after a comment shipped a '### Correction:' section retracting its own
# previous revision in place — right instinct, wrong surface. Retract by restating the
# finding correctly; the account of how it changed belongs in a postmortem.
# Two separate defects, one check.
#
# (a) Drafting history is the author's, not the reader's: a reader who never saw the earlier
#     version learns nothing from being told it existed.
# (b) FIRST-PERSON AT ALL. These publish under a human's GitHub account, so "I did not verify
#     the version numbers" reads as that person personally declining to check — when a bot
#     wrote it. The byline is theirs; the voice must not impersonate them.
#
# The previous pattern named (b) in its own rationale ("the byline may not be yours") and
# implemented only (a), as a fixed list of retraction phrases. Fifteen distinct first-person
# phrases shipped across five PRs while it passed, including "I said otherwise in an earlier
# pass and that was wrong" — an instance of (a) that the enumeration still missed.
#
# Quoted text and code are exempt: a blockquote carries someone else's words, and a fence
# carries source. (b) is the run's own voice. In --inline and --reply the poster writes as
# themself, so I and we for the poster's own stance and commitments are theirs; only (a), the
# narration of the draft, applies there.
FIRSTPERSON=""
if [ "$MODE" != inline ] && [ "$MODE" != reply ]; then
  FIRSTPERSON="$(
    awk '/^[[:space:]]*```/{f=!f; next} f{next} /^[[:space:]]*>/{next} {print}' "$FILE" \
      | grep -oiE "\\b(I|I'm|I've|I'd|I'll|my|mine)\\b" | head -4 | tr '\n' ' '
  )"
fi
if [ -n "$FIRSTPERSON" ]; then
  fail "7 no first-person voice" "publishes in the first person ($FIRSTPERSON) under a human's byline — the account holder did not write this. Use \"not established\", \"this read did not\", \"not verified here\", or the passive: \"what is committed was diffed\""
elif hasi "correction to my earlier|filed by me|hard to calibrate|earlier revision|previous revision|an earlier version of this|is withdrawn|that claim was wrong|^#{1,4} *Correction[: ]|corrected below|see the correction|in an earlier pass"; then
  fail "7 no first-person voice" "narrates its own drafting history — the reader never saw the earlier draft. Retract by restating the finding correctly; the account of how it changed belongs in a postmortem"
else
  pass "7 no first-person voice"
fi

if [ "$MODE" = diligence ]; then
  printf '  SKIP  %s\n' "8 verdict is earned — no verdict rendered"
  printf '  SKIP  %s\n' "9 verdict matches artifact — no verdict rendered"
else
# `\bproven\b` and not a bare substring: "unproven" is a legal flat ending (SKILL.md) and made the
# earlier `.*proven` fail every run that said so. "not proven" is likewise a non-claim.
PROVEN_CLAIM="$(grep -iE '\*\*Verdict:\*\*.*\bproven\b' "$FILE" | grep -viE '\b(not|never)[[:space:]]+proven\b' | head -1)"
if [ -n "$PROVEN_CLAIM" ] && ! hasre 'Produced by |actions/runs|evidence-artifacts/'; then
  fail "8 verdict is earned" "claims 'proven' with no execution artifact — reading yields 'unverified'"
else
  pass "8 verdict is earned"
fi

# 9 — the wrapper's verdict must not contradict the artifact it embeds. A comment is
# assembled by hand around machine output, and the hand-written header is exactly where
# a "vacuous" result acquires a "proven" label.
HDR="$(grep -m1 '^\*\*Verdict:\*\*' "$FILE" | tr 'A-Z' 'a-z')"
BODY="$(grep -ioE 'vacuous|value unstable|no delta|nothing falsified|broke the module|substitution silent|probe-failed' "$FILE" | head -1 | tr 'A-Z' 'a-z')"
if printf '%s' "$HDR" | grep -q 'proven' && [ -n "$BODY" ]; then
  fail "9 verdict matches artifact" "header claims 'proven' while the embedded artifact reports '$BODY'"
else
  pass "9 verdict matches artifact"
fi
fi

# 10 — the positive counterpart to check 6. A run succeeds by putting concerns in front
# of a reviewer, so an artifact that floats nothing has reported only what it happened to
# measure and called that the whole picture. This is NOT satisfied by a "what would close
# it" section, which check 6 rejects: that hands the reader the run's own unfinished work,
# whereas this names a limit or a question the run is right to leave open.
#
# The vocabulary is a fixed list because this phase asks no model anything. That makes
# it blind to a limit phrased outside the list — a real run stated its limit as "what it
# does not establish" and the check called it absent. Add phrases when that happens;
# judging whether the stated limit is substantive is the dispatched passes' job.
# 17 -- a comment that ASKS for a change ships the change. Not a formatting preference:
# writing the block forces a read of the lines being changed, and prose does not. On
# 2026-09-17 a reply told an author their objection was wrong, on a mechanism read one
# field over -- `endTrace` applies `data`, `trace` applies `tags`, and the value in
# question was a tag. Four prose passes ran over that draft and none required opening the
# file; the error died the moment a diff had to name lines. Measured on the same review:
# 5 of 5 line comments carried a block, 0 of 2 replies did, and this gate had no check.
if [ "$MODE" = inline ] && grep -qiE "((^|[.!?][[:space:]]+)(let's|could we|i'd suggest))" "$FILE"; then
  if grep -qE '^```(suggestion|diff)' "$FILE"; then
    pass "17 a requested change ships as a block"
  else
    fail "17 a requested change ships as a block" \
      "this asks for a change and shows none. Write the suggestion or diff block: if it cannot be written without opening the file, that is the point of it, and a proposal you can phrase but cannot diff is one you have not checked"
  fi
fi

# 17b -- check 17 matches a FENCE, not an applicable change, and a bare `@@` elision is the
# escape hatch it leaves open. Check 17's own rationale is that "writing the block forces a
# read of the lines being changed"; an elided diff forces nothing, because `@@` is exactly
# where the unread lines were skipped. A `suggestion` block is machine-applicable and a
# complete hunk is applicable by hand; a sketch with `@@` in it can be applied by nobody and
# passes 17 all the same. Measured 2026-09-18 on review 5240312753: 3 of 5 blocks carried a
# bare `@@`, every one of them green on 17. A real unified-diff header (`@@ -12,7 +12,6 @@`)
# is not an elision and is allowed.
if grep -qE '^```diff' "$FILE"; then
  if grep -qE '^@@[[:space:]]*$' "$FILE"; then
    fail "17b a diff block is complete, not elided" \
      "a bare '@@' marks lines the block skipped, so nobody can apply it and nothing forced you to read them. Write one complete hunk with its context, or a 'suggestion' block, which GitHub applies in one click"
  else
    # The anchor decides the form (the-anchor-decides-a-review-comments-block-form): a ```diff
    # whose real hunk header lies wholly inside the line range the comment's own permalink
    # anchors (`#L10`, `#L10-L12`) is an edit a `suggestion` block applies in one click.
    INANCHOR="$(python3 - "$FILE" <<'PYEOF'
import re, sys
t = open(sys.argv[1]).read()
prose = re.sub(r'```.*?```', ' ', t, flags=re.S)
m = re.search(r'#L(\d+)(?:-L(\d+))?', prose)
if m:
    a = int(m.group(1)); b = int(m.group(2) or a)
    for blk in re.findall(r'^```diff\n(.*?)^```', t, flags=re.S | re.M):
        for h in re.finditer(r'^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@', blk, flags=re.M):
            s0 = int(h.group(1)); n = int(h.group(2) if h.group(2) is not None else 1)
            if n >= 1 and a <= s0 and s0 + n - 1 <= b:
                print("%d-%d inside L%d-L%d" % (s0, s0 + n - 1, a, b)); sys.exit(0)
PYEOF
)"
    if [ -n "$INANCHOR" ]; then
      fail "17b a diff block is complete, not elided" \
        "the diff edits lines $INANCHOR, inside the anchor its own permalink names, so a 'suggestion' block applies it in one click and a 'diff' block does not. The anchor decides the form: write a suggestion block, or move the anchor if the edit is not on those lines"
    else
      pass "17b a diff block is complete, not elided"
    fi
  fi
fi

if envelope_na "10 floats something for review"; then :
elif [ "$MODE" = inline ] && grep -qiE "(\?[[:space:]]*$)|((^|[.!?][[:space:]]+)(let's|could we|would it make sense to))" "$FILE"; then
  # An inline comment's float is its closing ask: a request ("Let's ...", "Could we ...",
  # "Would it make sense to ...") or a genuine question to the author. "Maybe" is a hedge, for when the
  # reviewer is actually unsure, and does not count as a request. Not an
  # "Open for review:" heading, which lives once on the body. Accepting only a trailing "?"
  # pushed fix requests into "Can the X ...?" closers, which read as either a request or a
  # yes/no question (2026-09-15, extension#46123).
  pass "10 floats something for review"
  # 10b -- the closing ask must read as a request. "Can the preload move ...?" puts an
  # inanimate subject under a question mark, so the author cannot tell a request from a
  # yes/no question about feasibility. "Could we", "Let's" and "Would it make sense to" are
  # unambiguous and pass. "I'd suggest" reads as a command, not a request (2026-10-26).
  # 10c -- no prose paragraph over three sentences. A GitHub body keeps each paragraph on one
  # source line, so a line-count rule never sees a wall of text; the sentence is the unit that
  # works on every surface. 2026-09-15, extension#46123.
  LONGP="$(awk '/^[[:space:]]*```/{f=!f; next} !f && NF { t=$0; gsub(/`[^`]*`/, "x", t); gsub(/\]\([^)]*\)/, "]", t); n=gsub(/[.!?]( |$)/, "&", t); if (n>3) print n": "substr($0,1,70) }' "$FILE")"
  if [ -n "$LONGP" ]; then
    fail "10c no paragraph over three sentences" "split these into a framed list or shorter paragraphs: $LONGP"
  else
    pass "10c no paragraph over three sentences"
  fi
  LAST="$(awk '/^[[:space:]]*```/{f=!f; next} !f && NF {l=$0} END{print l}' "$FILE")"
  if printf '%s' "$LAST" | grep -qE '^(nit: )?(Can|Could|Will|Would|Should) (the|this|these|that|those|it|its) '; then
    fail "10b closing ask reads as a request" "the last sentence asks whether a thing can happen, which reads as either a request or a yes/no question. Phrase it as a request: \"Could we ...\", \"Let's ...\", \"Would it make sense to ...\""
  else
    pass "10b closing ask reads as a request"
  fi
elif hasi 'open for review|raise with a human|falsifier|worth a look|left unmeasured|not covered by this run|no verdict offered|does not establish|what it does not|cannot attribute|is not established|was not measured|were not re-read|is not part of this read'; then
  pass "10 floats something for review"
else
  fail "10 floats something for review" "no limit, open question, or falsifier named — an artifact that floats nothing implies its measurement was the whole surface"
fi

# 11 — the trial-run disclaimer, and its POSITION. This is not content, it is the frame
# the reader needs before they read a verdict on their own PR from an unfamiliar source.
# Compressed and moved to the foot of the page — which is what happens when it is edited
# by the same rules as prose — it arrives after the reaction it exists to shape.
# It belongs to the PR-body section and the private record only; a review carries the
# disclaimer after its ask, once at most (/pr-comment).
if envelope_na "11 disclaimer present and early"; then DISC="skip"
elif [ "$MODE" = inline ]; then
  # Repeating the disclaimer on every inline comment is the noise the skill warns
  # about — the reviewer reads the same paragraph N times. It belongs once, on the body.
  printf '  SKIP  %s\n' "11 disclaimer — carried once by the body comment, not per inline"
else
DISC="$(grep -n -i 'trial run' "$FILE" | head -1 | cut -d: -f1)"
# An exhibit is a fenced block OR an image. Counting only fences let a run whose exhibit is a
# screenshot carry the disclaimer at the foot, after the capture it frames (O4, 2026-11-16).
FIRST_FENCE="$(grep -n '^```' "$FILE" | head -1 | cut -d: -f1)"
FIRST_IMAGE="$(grep -n '!\[[^]]*\]([^)]*)' "$FILE" | head -1 | cut -d: -f1)"
FIRST_EXHIBIT="$(printf '%s\n%s\n' "$FIRST_FENCE" "$FIRST_IMAGE" | grep -E '^[0-9]+$' | sort -n | head -1)"
if [ -z "$DISC" ]; then
  fail "11 disclaimer present and early" "no trial-run disclaimer — a reviewer cannot tell what this is or where to send feedback"
elif ! grep -qi 'trial run' "$FILE" || ! grep -q 'skills/pull/\|MetaMask/skills' "$FILE"; then
  fail "11 disclaimer present and early" "disclaimer does not link the skills PR, so feedback has nowhere to go"
elif [ -n "$FIRST_EXHIBIT" ] && [ "$DISC" -gt "$FIRST_EXHIBIT" ]; then
  fail "11 disclaimer present and early" "disclaimer is at line $DISC, after the first exhibit at line $FIRST_EXHIBIT — it frames nothing from there"
else
  pass "11 disclaimer present and early"
fi
fi

# 16 — the corrections already given on THIS artifact, as executable predicates.
# A new instruction adds constraints without clearing the earlier ones, so every established
# constraint has to be checked against new output. As prose that rule asks the author to
# remember, at the exact moment they are focused on the newest correction — and it did not fire
# once across ~20 corrections on #45664. A sidecar file makes it run instead of be recalled:
# a fix that breaks an earlier correction fails here rather than reaching the reader.
CONSTRAINTS="${FILE%.md}.constraints.py"
if [ -f "$CONSTRAINTS" ]; then
  if CONS_OUT="$(python3 "$CONSTRAINTS" "$FILE" 2>&1)"; then
    pass "16 prior corrections still hold ($(printf '%s' "$CONS_OUT" | grep -c 'PASS') checked)"
  else
    fail "16 prior corrections still hold" "a correction already given on this artifact no longer holds: $(printf '%s' "$CONS_OUT" | grep -m1 FAIL | sed 's/^ *//')"
  fi
fi

if [ -n "$REF" ] && [ -f "$REF" ]; then
  r=$(grep -coE '!\[|<img|data:image' "$REF"); c=$(grep -coE '!\[|<img|data:image|evidence-artifacts/|Produced by' "$FILE")
  echo
  printf '  ratio  reference captures: %s | this artifact: %s\n' "$r" "$c"
  [ "$c" -eq 0 ] && [ "$r" -gt 0 ] && printf '         reference is capture-led and this is prose-only — see check 5\n'
fi

# 12 — the destination. Every check above tests a property of the text, and text can be
# perfect while landing somewhere nobody will read it. Measured across one register of
# published runs: 22 of 27 comments went onto pull requests that had ALREADY merged when
# they were posted, median 22 days after the merge, one of them 178 days after. The gate
# was clean on every one. A finding delivered to a closed pull request changes nothing,
# and no property of the comment can reveal that.
echo
if [ -z "$TARGET" ]; then
  fail "12 destination is open" "no --target given, so nobody checked whether the pull request is still open. Pass --target owner/repo#N."
elif ! command -v gh >/dev/null 2>&1; then
  # Blocks rather than warns. An earlier version printed UNVERIFIED and exited 0, so on a
  # machine without `gh` — which is to say, running locally — this check announced that it
  # had not run and passed anyway. That is the shape it exists to catch, one level up.
  fail "12 destination is open" "gh not on PATH, so the destination was not checked. Unverified is not passing: install gh, or confirm the target is open and re-run."
else
  t_repo="${TARGET%%#*}"; t_num="${TARGET##*#}"
  t_state="$(gh api "repos/$t_repo/pulls/$t_num" --jq 'if .merged_at then "merged" else .state end' 2>/dev/null || echo unknown)"
  case "$t_state" in
    open)    pass "12 destination is open" ;;
    unknown) fail "12 destination is open" "could not read $TARGET — do not publish to a destination you could not check" ;;
    *)       fail "12 destination is open" "$TARGET is $t_state. A run published to a closed pull request reaches no reviewer and changes no decision." ;;
  esac
fi

# 13 — a number in the prose that appears in no exhibit. Check 9 compares verdict WORDS;
# nothing compared the figures. Measured on a demonstration artifact built to test this
# gate: the prose said "0 errors over 48 skills" directly above an exhibit reading
# "47 skill(s) checked", and named a warning class with zero instances in the output it
# was describing. Both survived every other check. Prose drifts from the exhibit it sits
# beside, and it is the most common way one of these goes wrong.
#
# Deliberately narrow, because a noisy check is an ignored check: integers of two or more
# digits only, and only those absent from every fenced block. Excluded as references
# rather than measurements — whole URLs, issue refs, version strings, dates, SHAs,
# file:line citations, hyphenated identifiers like P-256, and regex quantifiers. Every
# one of those was added after a control run flagged something that was not a figure.
#
# URLs are stripped to whitespace rather than to the first `)`. A Sentry Discover
# permalink contains `count()` and `count_unique(trace)`, so stopping at `(` left the
# whole query string in the prose, and every digit in it — project id, time window,
# per_page — was reported as a figure tracing to no exhibit. A check that fires on every
# body citing a Discover link teaches the operator to publish through it.
echo
NUM_ORPHANS="$(
  awk '/^[[:space:]]*```/{f=!f; next} f{print}' "$FILE" > "$FILE.exh" 2>/dev/null
  # A diligence lane's exhibit is a TABLE by contract ("the capability -> call-site table is the
  # deliverable"), not a fenced capture. Counting only fences failed a correct extension#45807
  # draft whose every figure sat in a table, and would push the lane toward re-typing its table
  # into a fence to pass -- the gate rewarding the weaker medium. Validation-run mode unchanged.
  [ "$MODE" = diligence ] && grep -E '^[[:space:]]*\|' "$FILE" >> "$FILE.exh"
  awk '/^[[:space:]]*```/{f=!f; next} !f{print}' "$FILE" \
    | sed -E 's#\[[^]]*\]\([^)]*\)##g' \
    | sed -E 's/`[^`]*[A-Za-z_][^`]*`//g' \
  | sed -E 's#https?://[^[:space:]]*##g' \
    | sed -E 's/#[0-9]+//g; s/\bv?[0-9]+\.[0-9]+(\.[0-9]+)?\b//g; s/\b[0-9]{4}-[0-9]{2}-[0-9]{2}\b//g; s/\b[0-9a-f]{7,}\b//g; s/:[0-9]+\b//g; s/[A-Za-z]+-[0-9]+//g; s/(Chrome|Chromium|Firefox|Edge|Safari|Node|Gecko)[[:space:]]+[0-9]+\+?//g; s/\b[0-9]+\+//g; s/\{[0-9,]+\}//g' \
    | grep -oE '\b[0-9]{2,}\b' | sort -u \
    | while read -r n; do grep -qF "$n" "$FILE.exh" || printf '%s ' "$n"; done
  rm -f "$FILE.exh"
)"
if [ -n "$NUM_ORPHANS" ]; then
  fail "13 figures trace to an exhibit" "these appear in the prose and in no exhibit: $NUM_ORPHANS — either they came from somewhere the reader cannot see, or they disagree with what is shown"
else
  pass "13 figures trace to an exhibit"
fi

# 14 — skill names stay out of reader-facing prose. A reviewer cannot use a list of internal
# passes, and a provenance comment reaches no reader at all (output-templates.md, "Provenance a
# reader cannot see is not provenance"), so no declaration is required; the check only fails a
# visible "Passes run:" line.
if envelope_na "14 no pass list in prose"; then PASSES="skip"
elif grep -qiE '^[^<]*\bpasses run:' "$FILE"; then
  fail "14 no pass list in prose" "'Passes run:' appears in reader-facing prose — internal pass names mean nothing to a reviewer"
else
  pass "14 no pass list in prose"
fi

# 15 — hard-wrapped prose. GitHub renders a single newline inside a comment body as a hard
# break, so a paragraph wrapped at ~95 columns arrives as a ragged stack of short lines. The
# bytes are correct and the defect lives entirely in the destination's semantics, which is why
# nothing in the authoring loop sees it: the file looks right in an editor and in a diff.
#
# Counts soft breaks — a non-empty line directly followed by another non-empty line — outside
# fenced code, and excluding the constructs where a newline is load-bearing: block quotes,
# tables, list items, headings, HTML comments and link-reference lines. Above 3, the body was
# authored to a column width rather than as paragraphs.
#
# A prose predicate ("median line under ~110 chars") did not prevent a repeat, so this check
# runs the rule instead of recording it. Recorded enforcement that does not exist closes the
# question, which is worse than an open one.
SOFTBREAKS="$(
  awk '
    /^[[:space:]]*```/            { f = !f; next }
    f                 { next }
    /^[[:space:]]*$/  { prev = ""; next }
    # A standalone HTML block tag is structure, not prose. GitHub REQUIRES <details> and
    # <summary> on their own lines for the markdown inside to be parsed at all — joining them
    # to satisfy this check is what shipped a comment whose code blocks rendered as plain text.
    /^[[:space:]]*(<\/?(details|summary|table|thead|tbody|tr|td|th|div|p|br|img|picture|source|kbd|sub|sup)\b|<\/?[a-z]+>[[:space:]]*$)/ { prev = ""; next }
    /^[[:space:]]*(>|\||#{1,6} |[-*+] |[0-9]+\. |<!--|\[[^]]+\]:)/ { prev = ""; next }
    # A line that is only a link or an image is a deliberate line, not wrapped prose: an
    # exhibit list puts one per line on purpose, and joining them would split a verdict
    # from the exhibits the evidence hook requires in its paragraph.
    /^[[:space:]]*!?\[[^]]*\]\([^)]*\)[[:space:]]*$/ { prev = $0; next }
    { if (prev != "") n++; prev = $0 }
    END { print n + 0 }
  ' "$FILE"
)"
if [ "${SOFTBREAKS:-0}" -gt 3 ]; then
  fail "15 prose is not hard-wrapped" "$SOFTBREAKS soft line breaks outside code — GitHub renders each as a hard break, so these paragraphs arrive as a stack of short lines. Reflow prose to one line per paragraph"
else
  pass "15 prose is not hard-wrapped"
fi

# 18. Restating the other party's own argument back to them. Every sentence is true, which is
# why it survives every other check and every read - it is the appeasing move that looks like
# rigour. It costs their reading time and implies they need corroboration from me. Detected as
# the longest verbatim prose run shared with the comment being answered, after stripping code
# spans, fences and link targets so shared identifiers do not trip it. Calibrated on a real
# instance: the echo scored 55 chars, its replacement 10.
if [ -n "$PARENT" ] && [ -f "$PARENT" ]; then
  ECHO_N="$(python3 - "$FILE" "$PARENT" <<'PYEOF'
import re, sys, difflib
def prose(t):
    t = re.sub(r'```.*?```', ' ', t, flags=re.S)
    t = re.sub(r'`[^`\n]*`', ' ', t)
    t = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', t)
    t = re.sub(r'[^a-z0-9 ]+', ' ', t.lower())
    return re.sub(r'\s+', ' ', t).strip()
a = prose(open(sys.argv[1]).read()); b = prose(open(sys.argv[2]).read())
m = difflib.SequenceMatcher(None, a, b, autojunk=False).find_longest_match(0, len(a), 0, len(b))
print(m.size); print(a[m.a:m.a+m.size])
PYEOF
)"
  ECHO_LEN="$(printf '%s' "$ECHO_N" | head -1)"
  ECHO_TXT="$(printf '%s' "$ECHO_N" | tail -1)"
  if [ "${ECHO_LEN:-0}" -ge 30 ]; then
    fail "18 no echo of the other party" "$ECHO_LEN chars restated back at the person you are answering: \"$ECHO_TXT\" — they wrote it; repeating it costs their reading time and implies they need corroboration. Cut it and keep what is yours"
  else
    pass "18 no echo of the other party"
  fi
elif [ "$MODE" = reply ]; then
  printf '  SKIP  %s\n' "18 no echo of the other party — no --parent given, so nothing checked the reply against what it answers"
fi

echo
if [ "$FAILED" -eq 0 ]; then
  echo "attest-gate: phase 0 clean — proceed to /outframe ‖ /missing ‖ /press"
  exit 0
fi
echo "attest-gate: BLOCKED — $FAILED check(s) failed. Do not publish."
exit 1
