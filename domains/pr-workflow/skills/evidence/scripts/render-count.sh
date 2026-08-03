#!/usr/bin/env bash
#
# render-count — lane C4, the component half.
#
# `selector-recompute` answers "how often does this selector recompute". This
# answers the other C4 question: "how many times does a consumer actually
# render". A memoization claim about context or props is a claim about that
# count, and a count of call sites is not it — 149 consumers can mean 149
# avoided renders or none.
#
# Generates a probe that mounts a provider with a counting consumer, forces the
# parent to re-render N times with the memoised value unchanged, and reports the
# consumer's render count. Arm B re-runs with one line changed, so the delta is
# attributable rather than assumed.
#
# Usage:
#   render-count.sh --probe <probe.test.tsx> [--defeat <file> --defeat-line <n> --defeat-with <text>]
#                   [--arm-b <label>] [--label <slug>] [--out <dir>]
#
# Arm B is "the memo defeated" by default, which is the shape when a PR ADDS
# memoisation. When a PR is the one under suspicion the arms invert — arm B applies
# the candidate fix — and calling that "defeated" prints the reading backwards. So
# the label is caller-stated, like every other verdict word in this suite.
#
# The probe is supplied rather than generated: a provider's mount requirements
# are specific to the component, and a generated one would either be wrong or
# would need every prop passed on the command line. Write it once, keep it.
# It must print a line of the form:
#
#   RENDER_COUNT consumer=<n> parentRenders=<m>
#
#   0  measured           counts captured for both arms (or arm A alone if no --defeat)
#   1  no delta           arm B identical to arm A — the memo is not doing what is claimed
#   2  probe did not emit RENDER_COUNT
#   3  usage error
set -uo pipefail

# A run's artifact has to say whether a reader can verify it. In CI the run URL is that
# verification; locally there is none, and the artifact says so rather than leaving the
# omission for a gate to catch later.
capture_provenance() {
  if [ -n "${GITHUB_RUN_ID:-}" ]; then
    printf 'Run: %s/%s/actions/runs/%s — logs and artifacts attached there.' \
      "${GITHUB_SERVER_URL:-https://github.com}" "${GITHUB_REPOSITORY:-}" "$GITHUB_RUN_ID"
  else
    printf 'Produced on a local machine: no reader-verifiable capture. Re-run through the evidence workflow before publishing.'
  fi
}

OUT_DIR="evidence-artifacts"; LABEL=""; PROBE=""; DEFEAT=""; DEFEAT_LINE=""; DEFEAT_WITH=""
ARM_B="memo defeated"
die() { printf 'render-count: %s\n' "$1" >&2; exit 3; }

while [ $# -gt 0 ]; do
  case "$1" in
    --probe)       PROBE="${2:-}"; shift 2 ;;
    --defeat)      DEFEAT="${2:-}"; shift 2 ;;
    --defeat-line) DEFEAT_LINE="${2:-}"; shift 2 ;;
    --defeat-with) DEFEAT_WITH="${2:-}"; shift 2 ;;
    --arm-b)       ARM_B="${2:-}"; shift 2 ;;
    --label)       LABEL="${2:-}"; shift 2 ;;
    --out)         OUT_DIR="${2:-}"; shift 2 ;;
    -h|--help)     sed -n '2,30p' "$0"; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

[ -n "$PROBE" ] || die "--probe is required"
[ -f "$PROBE" ] || die "probe not found: $PROBE"
LABEL="${LABEL:-render-$(basename "$PROBE" | sed 's/\..*$//')}"
mkdir -p "$OUT_DIR" || die "cannot create $OUT_DIR"
STAMP="$OUT_DIR/$LABEL"

counts_from() { grep -o 'RENDER_COUNT .*' "$1" | head -1; }
consumer_of() { printf '%s' "$1" | sed -n 's/.*consumer=\([0-9]*\).*/\1/p'; }

yarn jest "$PROBE" > "$STAMP-armA.log" 2>&1
A_LINE="$(counts_from "$STAMP-armA.log")"
A="$(consumer_of "$A_LINE")"
[ -n "$A" ] || { printf 'render-count: probe emitted no RENDER_COUNT line\n' >&2; exit 2; }

B=""; B_LINE=""
if [ -n "$DEFEAT" ] && [ -n "$DEFEAT_LINE" ]; then
  [ -f "$DEFEAT" ] || die "defeat target not found: $DEFEAT"
  BACKUP="$(mktemp)"; cp "$DEFEAT" "$BACKUP"
  restore() { cp "$BACKUP" "$DEFEAT"; rm -f "$BACKUP"; }
  trap restore EXIT INT TERM
  awk -v n="$DEFEAT_LINE" -v r="$DEFEAT_WITH" 'NR==n{print r; next}{print}' "$DEFEAT" > "$DEFEAT.tmp" && mv "$DEFEAT.tmp" "$DEFEAT"
  yarn jest "$PROBE" > "$STAMP-armB.log" 2>&1
  B_LINE="$(counts_from "$STAMP-armB.log")"
  B="$(consumer_of "$B_LINE")"
  restore; trap - EXIT INT TERM
else
  : > "$STAMP-armB.log"
fi

if [ -n "$B" ] && [ "$B" = "$A" ]; then VERDICT="no delta — arm B changed nothing measurable"; CODE=1
elif [ -n "$B" ]; then VERDICT="delta measured: $A → $B renders with $ARM_B"; CODE=0
else VERDICT="baseline only: $A consumer renders"; CODE=0; fi

HEAD_SHA="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
DIRTY="$(git status --porcelain 2>/dev/null | grep -v '^??' | wc -l | tr -d ' ')"
NODE_V="$(node -v 2>/dev/null || echo unknown)"

cat > "$STAMP.json" <<JSON
{ "probe": "$PROBE", "verdict": "$VERDICT", "exit": $CODE,
  "consumer_renders": { "armA": ${A:-null}, "armB": ${B:-null} },
  "env": { "head": "$HEAD_SHA", "tracked_changes": $DIRTY, "node": "$NODE_V" },
  "logs": ["$STAMP-armA.log", "$STAMP-armB.log"] }
JSON

{
  echo "### Consumer render count"
  echo
  echo "**Verdict:** $VERDICT"
  echo
  echo "| Arm | Change | consumer renders |"
  echo "|---|---|---|"
  echo "| A — as committed | none | ${A:-?} |"
  [ -n "$B" ] && echo "| B — $ARM_B | \`$DEFEAT:$DEFEAT_LINE\` | $B |"
  echo
  echo '```console'
  echo "\$ git checkout --detach $HEAD_SHA && yarn jest $PROBE"
  echo "$A_LINE"
  [ -n "$B_LINE" ] && { echo "\$ yarn jest $PROBE   # $ARM_B"; echo "$B_LINE"; }
  echo '```'
  echo
  echo "This counts renders of one named consumer across a defined interaction. It is not a count"
  echo "of consumers, and a larger consumer count does not imply a larger effect."
  echo
  echo "<sub>Produced by \`render-count.sh\`; the arm-B edit is reverted after the run. head \`$HEAD_SHA\` · $DIRTY tracked changes · node \`$NODE_V\`. $(capture_provenance)</sub>"
} > "$STAMP.md"

printf 'render-count: %s\n  %s\n  %s\n' "$VERDICT" "$STAMP.json" "$STAMP.md" >&2
# The limits below are identical on every run: they describe the instrument, not the
# change under review. Pasted into a PR comment they read as boilerplate to a reviewer
# who has no stake in this tooling, so they go to stderr and to the .json instead. The
# orchestrator reads them and writes ONE open question about THIS diff.
printf 'limits: one named consumer, one interaction. Other consumers are unmeasured, and one
that renders once here may render freely under an interaction this probe does not perform.
Counts renders, not whether the output is equivalent.\n' >&2
exit "$CODE"
