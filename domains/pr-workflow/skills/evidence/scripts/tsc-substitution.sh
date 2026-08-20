#!/usr/bin/env bash
#
# tsc-substitution — arm A/B against the type checker.
#
# A hand-written type that restates an authoritative source either agrees with it
# or does not, and `tsc` is the only thing that can settle which. Reading the two
# declarations side by side does not: TypeScript's assignability rules are not
# obvious by inspection, which is the entire reason the lane exists.
#
#   Arm A  baseline typecheck, errors recorded
#   Arm B  the substitution applied — the hand-written type replaced by the derived
#          one, or a cast removed — typecheck re-run, errors diffed
#
# The finding is the DIFF: error codes present in B and absent in A are what the
# hand-written type or the cast was concealing.
#
#   0  divergence surfaced   new errors in arm B    → the local type disagrees
#   1  no divergence         identical error sets   → substitution is silent
#   2  usage/env error (baseline errors are subtracted, not disqualifying)
#   3  usage/env error
#
# A silent result is NOT proof of agreement. Existing call sites may type-check
# against both shapes (indexing a `string` and a `string[]` both compile), so use
# --probe to inject a deliberately-typed sink that only one shape satisfies.
#
# Usage:
#   tsc-substitution.sh --file <path> --line <n> --replace <text>
#                       [--probe-line <n> --probe <text>] [--label <slug>]
#                       [--tsc "<command>"]
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

TSC="yarn lint:tsc"; OUT_DIR="evidence-artifacts"; LABEL=""
FILE=""; LINE=""; REPLACE=""; PROBE_LINE=""; PROBE=""
die() { printf 'tsc-substitution: %s\n' "$1" >&2; exit 3; }

while [ $# -gt 0 ]; do
  case "$1" in
    --file)       FILE="${2:-}"; shift 2 ;;
    --line)       LINE="${2:-}"; shift 2 ;;
    --replace)    REPLACE="${2:-}"; shift 2 ;;
    --probe-line) PROBE_LINE="${2:-}"; shift 2 ;;
    --probe)      PROBE="${2:-}"; shift 2 ;;
    --label)      LABEL="${2:-}"; shift 2 ;;
    --out)        OUT_DIR="${2:-}"; shift 2 ;;
    --tsc)        TSC="${2:-}"; shift 2 ;;
    -h|--help)    sed -n '2,30p' "$0"; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

[ -n "$FILE" ] || die "--file is required"
[ -f "$FILE" ] || die "file not found: $FILE"
[ -n "$LINE" ] || [ -n "$PROBE" ] || die "give --line/--replace, or --probe-line/--probe, or both"
LABEL="${LABEL:-tsc-$(basename "$FILE" | sed 's/\.[^.]*$//')}"
mkdir -p "$OUT_DIR" || die "cannot create $OUT_DIR"
STAMP="$OUT_DIR/$LABEL"

BACKUP="$(mktemp)" || die "mktemp failed"
cp "$FILE" "$BACKUP"
restore() { cp "$BACKUP" "$FILE"; rm -f "$BACKUP"; }
trap restore EXIT INT TERM

# tsc exits non-zero on any error, so the error SET is the signal, not the exit code.
errors_of() { grep -oE "error TS[0-9]+" "$1" 2>/dev/null | sort | uniq -c | sed 's/^ *//'; }

$TSC > "$STAMP-armA.log" 2>&1
# Baseline errors are subtracted, not disqualifying. A local WIP file or an
# unrelated pre-existing error must not veto the lane — the finding was always the
# DIFF, so compare error SETS and let anything already present fall out.
grep -oE "^[^ ]+\([0-9]+,[0-9]+\): error TS[0-9]+" "$STAMP-armA.log" 2>/dev/null | sort -u > "$STAMP-armA.set"
A_COUNT="$(wc -l < "$STAMP-armA.set" | tr -d ' ')"
ENVISH="$(grep -cE "error TS(2305|2307|2724)" "$STAMP-armA.log" 2>/dev/null)"; ENVISH="${ENVISH:-0}"

apply()  { awk -v n="$1" -v r="$2" 'NR==n{print r; next}{print}' "$FILE" > "$FILE.tmp" && mv "$FILE.tmp" "$FILE"; }
insert() { awk -v n="$1" -v r="$2" 'NR==n{print; print r; next}{print}' "$FILE" > "$FILE.tmp" && mv "$FILE.tmp" "$FILE"; }
if [ -n "$PROBE" ] && [ -n "$PROBE_LINE" ] && [ -n "$LINE" ] && [ "$PROBE_LINE" -gt "$LINE" ]; then
  insert "$PROBE_LINE" "$PROBE"; apply "$LINE" "$REPLACE"
else
  [ -n "$LINE" ] && apply "$LINE" "$REPLACE"
  [ -n "$PROBE" ] && [ -n "$PROBE_LINE" ] && insert "$PROBE_LINE" "$PROBE"
fi

$TSC > "$STAMP-armB.log" 2>&1
grep -oE "^[^ ]+\([0-9]+,[0-9]+\): error TS[0-9]+" "$STAMP-armB.log" 2>/dev/null | sort -u > "$STAMP-armB.set"
B_COUNT="$(wc -l < "$STAMP-armB.set" | tr -d ' ')"
restore; trap - EXIT INT TERM

NEW_ERRS="$(comm -13 "$STAMP-armA.set" "$STAMP-armB.set" | head -12)"
NEW_COUNT="$(comm -13 "$STAMP-armA.set" "$STAMP-armB.set" | wc -l | tr -d ' ')"

# TS1xxx is the syntactic family — "expression expected", "declaration expected". A
# substitution that lands on the wrong line breaks parsing and produces a pile of them,
# which reads as a large divergence and is worth nothing: the file never type-checked.
# `falsify-probe` has carried this guard since a broken mutation looked like a
# falsification; this runner shipped without it and reported six syntax errors as a
# divergence on its first CI run.
SYNTAX="$(comm -13 "$STAMP-armA.set" "$STAMP-armB.set" | grep -cE 'error TS1[0-9]{3}')"
if [ "$NEW_COUNT" -gt 0 ] && [ "$SYNTAX" -eq "$NEW_COUNT" ]; then
  VERDICT="substitution broke parsing — $NEW_COUNT syntax error(s), nothing type-checked"; CODE=2
elif [ "$NEW_COUNT" -gt 0 ]; then
  VERDICT="divergence surfaced"; CODE=0
else
  VERDICT="substitution silent"; CODE=1
fi

HEAD_SHA="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
DIRTY="$(git status --porcelain 2>/dev/null | grep -v '^??' | wc -l | tr -d ' ')"
TS_V="$(yarn tsc --version 2>/dev/null | tail -1 || echo unknown)"

cat > "$STAMP.json" <<JSON
{ "verdict": "$VERDICT", "exit": $CODE, "file": "$FILE",
  "arm_a_errors": $A_COUNT, "arm_b_errors": $B_COUNT, "new_under_substitution": $NEW_COUNT,
  "env": { "head": "$HEAD_SHA", "tracked_changes": $DIRTY, "typescript": "$TS_V" },
  "logs": ["$STAMP-armA.log", "$STAMP-armB.log"] }
JSON

{
  echo "### Authored type vs authoritative source · \`$VERDICT\`"
  echo
  echo "| Arm | Change | distinct \`tsc\` errors |"
  echo "|---|---|---|"
  echo "| A — baseline | none | $A_COUNT |"
  echo "| B — substituted | \`$FILE\`${LINE:+:$LINE}${PROBE:+ + typed sink} | $B_COUNT |"
  echo "| **new under substitution** | | **$NEW_COUNT** |"
  echo
  if [ "$NEW_COUNT" -gt 0 ]; then
    if [ "$CODE" -eq 2 ]; then
      echo "**No conclusion.** Every new error is syntactic, so arm B never type-checked —"
      echo "the substitution landed on the wrong line or produced invalid TypeScript. This is"
      echo "indistinguishable from a real divergence by error count alone."
    else
    echo "Errors present in B and absent in A — what the local type was concealing:"
    echo; echo '```'; printf '%s\n' "$NEW_ERRS"; echo '```'
    fi
  else
    echo "**Silent — this is not proof of agreement.** Existing call sites may satisfy both"
    echo "shapes; indexing and \`.match()\` compile against \`string\` and \`string[]\` alike."
    echo "Re-run with \`--probe\` to inject a sink only the authoritative type accepts."
  fi
  if [ "$A_COUNT" -gt 0 ]; then
    echo
    echo "<sub>Baseline carried $A_COUNT pre-existing error(s) (${ENVISH} module/export). These are"
    echo "subtracted, not disqualifying — only errors new under substitution are the finding.</sub>"
  fi
  echo
  echo "<sub>Produced by \`tsc-substitution.sh\`; source restored after the run. head \`$HEAD_SHA\` · $DIRTY tracked changes · $TS_V. $(capture_provenance)</sub>"
  echo
} > "$STAMP.md"

printf 'tsc-substitution: %s (exit %s)\n  %s\n  %s\n' "$VERDICT" "$CODE" "$STAMP.json" "$STAMP.md" >&2
# The limits below are identical on every run: they describe the instrument, not the
# change under review. Pasted into a PR comment they read as boilerplate to a reviewer
# who has no stake in this tooling, so they go to stderr and to the .json instead. The
# orchestrator reads them and writes ONE open question about THIS diff.
printf 'limits: the compiler answers only what the probe asks. A silent arm B means no call
site in this tree distinguishes the two shapes, which is not agreement — a divergence
reachable only at runtime, or from a caller outside this repo, will not appear here.\n' >&2
exit "$CODE"
