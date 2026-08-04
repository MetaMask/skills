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

FILE="${1:-}"; REF=""; TARGET=""; MODE="run"
shift || true
while [ $# -gt 0 ]; do
  case "$1" in
    --reference) REF="${2:-}"; shift 2 ;;
    --target)    TARGET="${2:-}"; shift 2 ;;
    --diligence) MODE="diligence"; shift ;;
    *) shift ;;
  esac
done
[ -n "$FILE" ] || { echo "usage: attest-gate.sh <artifact.md> [--reference <file>] [--target <owner/repo#N>] [--diligence]" >&2; exit 2; }
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

# A diligence comment (lavamoat-policy and its siblings) renders no verdict and deliberately
# does not use the Validation Run envelope — see "One comment per evidence kind" in
# references/evidence-publishing.md. That exemption used to mean it was checked by nothing at
# all: attest-gate only knew the Validation Run shape, and pr-evidence-gate.py by design does
# not trip on a body claiming no verdict. So every rule the diligence skills state about their
# own output had no execution path, and a comment shipped with an unwitnessed local `npm pack`
# result and untraceable integers. --diligence swaps the envelope checks for that contract's
# own; everything downstream of the envelope is shared, because those defects are shared.
if [ "$MODE" = diligence ]; then
  has 'LAVAMOAT_DILIGENCE_START' && has 'LAVAMOAT_DILIGENCE_END' \
    && pass "1 marker pair" \
    || fail "1 marker pair" "no LAVAMOAT_DILIGENCE_START/_END — a re-run appends a duplicate instead of replacing, and the pair must not be VALIDATION_RUN_* or an evidence re-run would eat this region"

  hasre '^\*\*LavaMoat grants|^LavaMoat grants' \
    && pass "2 canonical header" \
    || fail "2 canonical header" "missing the 'LavaMoat grants — <package> <old> -> <new>' opener"

  printf '  SKIP  %s\n' "3 verdict line — a diligence comment renders none, by contract"
else
has 'VALIDATION_RUN_START' && has 'VALIDATION_RUN_END' \
  && pass "1 marker pair" \
  || fail "1 marker pair" "no VALIDATION_RUN_START/_END — a re-run appends a duplicate instead of replacing"

has '## 🧪 Validation Run' \
  && pass "2 canonical header" \
  || fail "2 canonical header" "missing '## 🧪 Validation Run'"

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
if [ "$MODE" = diligence ]; then
  if grep -qE 'https://github\.com/[^ )]+/blob/(main|master|develop|HEAD)/' "$FILE"; then
    fail "4 citations pinned" "a permalink points at a branch head; it will drift off the line it cites. Pin a tag or a 40-char SHA"
  elif grep -qE 'https://github\.com/[^ )]+/blob/[^/]+/' "$FILE"; then
    pass "4 citations pinned"
  else
    fail "4 citations pinned" "no source permalink at all — the permalink IS the evidence here; a retyped 'it needs X' proves nothing about provenance"
  fi
else
hasre 'head `[0-9a-f]{7,}|sha256|node `v|yarn\.lock `|[Ff]irefox [0-9]+\.[0-9]|[Cc]hrom(e|ium) [0-9]+\.|[Ss]afari [0-9]+\.|[Nn]ode v?[0-9]+\.[0-9]' \
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
if [ "$MODE" = diligence ]; then
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
  fail "5 captured artifact" "no reader-verifiable capture — an image of the tool surface, a run link, or a hosted artifact. A fenced block is the author\'s transcription, whatever produced it"
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

if hasi "I originally|correction to my earlier|filed by me|hard to calibrate|I withdraw|my earlier comment"; then
  fail "7 no process narration" "contains first-person process commentary — the reader did not see the earlier draft, and the byline may not be yours"
else
  pass "7 no process narration"
fi

if [ "$MODE" = diligence ]; then
  printf '  SKIP  %s\n' "8 verdict is earned — no verdict rendered"
  printf '  SKIP  %s\n' "9 verdict matches artifact — no verdict rendered"
else
if hasi '\*\*Verdict:\*\*.*proven' && ! hasre 'Produced by |actions/runs|evidence-artifacts/'; then
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
if hasi 'open for review|raise with a human|falsifier|worth a look|left unmeasured|not covered by this run|no verdict offered|does not establish|what it does not|cannot attribute'; then
  pass "10 floats something for review"
else
  fail "10 floats something for review" "no limit, open question, or falsifier named — an artifact that floats nothing implies its measurement was the whole surface"
fi

# 11 — the trial-run disclaimer, and its POSITION. This is not content, it is the frame
# the reader needs before they read a verdict on their own PR from an unfamiliar source.
# Compressed and moved to the foot of the page — which is what happens when it is edited
# by the same rules as prose — it arrives after the reaction it exists to shape.
DISC="$(grep -n -i 'trial run' "$FILE" | head -1 | cut -d: -f1)"
FIRST_EXHIBIT="$(grep -n '^```' "$FILE" | head -1 | cut -d: -f1)"
if [ -z "$DISC" ]; then
  fail "11 disclaimer present and early" "no trial-run disclaimer — a reviewer cannot tell what this is or where to send feedback"
elif ! grep -qi 'trial run' "$FILE" || ! grep -q 'skills/pull/\|MetaMask/skills' "$FILE"; then
  fail "11 disclaimer present and early" "disclaimer does not link the skills PR, so feedback has nowhere to go"
elif [ -n "$FIRST_EXHIBIT" ] && [ "$DISC" -gt "$FIRST_EXHIBIT" ]; then
  fail "11 disclaimer present and early" "disclaimer is at line $DISC, after the first exhibit at line $FIRST_EXHIBIT — it frames nothing from there"
else
  pass "11 disclaimer present and early"
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
echo
NUM_ORPHANS="$(
  awk '/^```/{f=!f; next} f{print}' "$FILE" > "$FILE.exh" 2>/dev/null
  awk '/^```/{f=!f; next} !f{print}' "$FILE" \
    | sed -E 's#https?://[^ )]*##g' \
    | sed -E 's/#[0-9]+//g; s/\bv?[0-9]+\.[0-9]+(\.[0-9]+)?\b//g; s/\b[0-9]{4}-[0-9]{2}-[0-9]{2}\b//g; s/\b[0-9a-f]{7,}\b//g; s/:[0-9]+\b//g; s/[A-Za-z]+-[0-9]+//g; s/\{[0-9,]+\}//g' \
    | grep -oE '\b[0-9]{2,}\b' | sort -u \
    | while read -r n; do grep -qF "$n" "$FILE.exh" || printf '%s ' "$n"; done
  rm -f "$FILE.exh"
)"
if [ -n "$NUM_ORPHANS" ]; then
  fail "13 figures trace to an exhibit" "these appear in the prose and in no exhibit: $NUM_ORPHANS — either they came from somewhere the reader cannot see, or they disagree with what is shown"
else
  pass "13 figures trace to an exhibit"
fi

echo
if [ "$FAILED" -eq 0 ]; then
  echo "attest-gate: phase 0 clean — proceed to /outframe ‖ /missing ‖ /press"
  exit 0
fi
echo "attest-gate: BLOCKED — $FAILED check(s) failed. Do not publish."
exit 1
