#!/usr/bin/env bash
#
# falsify-probe — prove a test is falsifying, by mutation rather than by reading.
#
# A test is evidence only if it FAILS when the mechanism it guards is removed.
# Reading the test establishes its shape; only this establishes its power.
#
# Runs two arms against the same tree:
#   Arm A  baseline — the suite as committed
#   Arm B  mutant   — one line replaced, suite re-run, source restored
#
# Emits a captured artifact (JSON + markdown) written by this script, not
# transcribed by an operator. Exit code IS the verdict, so CI can gate on it.
#
#   0  falsifying   arm A passed, arm B failed ON ASSERTIONS → the test has power
#   1  vacuous      arm A passed, arm B ALSO passed          → the test proves nothing
#   2  broken       arm A failed, or arm B did not run       → nothing to conclude
#   3  usage/env error
#
# Arm B failing is NOT sufficient. A mutation that breaks syntax fails every test in
# the file, which looks identical to a falsification and is worth nothing: the suite
# never executed. So arm B must run the SAME number of tests as arm A and fail some of
# them. A dropped test count means the mutation broke the module, not the mechanism.
#
# Usage:
#   falsify-probe.sh --test <path> --source <path> --line <n> --replace <text>
#                    [--label <slug>] [--out <dir>] [--runner "<cmd>"]
#
# Example:
#   falsify-probe.sh \
#     --test ui/hooks/perps/coalesceBackgroundRequest.test.ts \
#     --source ui/hooks/perps/coalesceBackgroundRequest.ts \
#     --line 54 --replace '  const existing = undefined as Promise<TResult> | undefined;' \
#     --label coalesce-inflight
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

RUNNER="yarn jest"
OUT_DIR="evidence-artifacts"
LABEL=""
TEST="" SOURCE="" LINE="" REPLACE=""

die() { printf 'falsify-probe: %s\n' "$1" >&2; exit 3; }

while [ $# -gt 0 ]; do
  case "$1" in
    --test)    TEST="${2:-}"; shift 2 ;;
    --source)  SOURCE="${2:-}"; shift 2 ;;
    --line)    LINE="${2:-}"; shift 2 ;;
    --replace) REPLACE="${2:-}"; shift 2 ;;
    --label)   LABEL="${2:-}"; shift 2 ;;
    --out)     OUT_DIR="${2:-}"; shift 2 ;;
    --runner)  RUNNER="${2:-}"; shift 2 ;;
    -h|--help) sed -n '2,32p' "$0"; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

[ -n "$TEST" ]   || die "--test is required"
[ -n "$SOURCE" ] || die "--source is required"
[ -n "$LINE" ]   || die "--line is required"
[ -n "$REPLACE" ] || die "--replace is required (use '' only if deleting the line)"
[ -f "$TEST" ]   || die "test not found: $TEST"
[ -f "$SOURCE" ] || die "source not found: $SOURCE"
case "$LINE" in ''|*[!0-9]*) die "--line must be numeric: $LINE" ;; esac
[ "$LINE" -le "$(wc -l < "$SOURCE")" ] || die "--line $LINE is past the end of $SOURCE"

LABEL="${LABEL:-$(basename "$SOURCE" | sed 's/\.[^.]*$//')-L$LINE}"
mkdir -p "$OUT_DIR" || die "cannot create $OUT_DIR"
STAMP="$OUT_DIR/falsify-$LABEL"

# --- environment pin: two operators on different machines must be comparable ---
HEAD_SHA="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
DIRTY="$(git status --porcelain 2>/dev/null | grep -v '^??' | wc -l | tr -d ' ')"
NODE_V="$(node -v 2>/dev/null || echo unknown)"
LOCK_SHA="$( { sha256sum yarn.lock 2>/dev/null || shasum -a 256 yarn.lock 2>/dev/null; } | cut -c1-16)"
ORIGINAL_LINE="$(sed -n "${LINE}p" "$SOURCE")"

BACKUP="$(mktemp)" || die "mktemp failed"
cp "$SOURCE" "$BACKUP"
restore() { cp "$BACKUP" "$SOURCE"; rm -f "$BACKUP"; }
trap restore EXIT INT TERM

run_arm() { # $1=logfile ; prints "passed|failed"
  if $RUNNER "$TEST" > "$1" 2>&1; then echo passed; else echo failed; fi
}

total_tests() { sed -n 's/.*Tests:.*[^0-9]\([0-9][0-9]*\) total.*/\1/p' "$1" | head -1; }
load_failed() { grep -qiE "SyntaxError|Cannot find module|Unexpected token|Transform failed" "$1"; }

ARM_A="$(run_arm "$STAMP-armA.log")"

if [ "$ARM_A" != "passed" ]; then
  VERDICT="baseline-already-failing"; CODE=2; ARM_B="not-run"
  : > "$STAMP-armB.log"
else
  # Mutate exactly one line. `.bak` form keeps this portable across GNU/BSD sed.
  awk -v n="$LINE" -v r="$REPLACE" 'NR==n{print r; next}{print}' "$SOURCE" > "$SOURCE.tmp" \
    && mv "$SOURCE.tmp" "$SOURCE" || die "mutation failed"
  ARM_B="$(run_arm "$STAMP-armB.log")"
  restore; trap - EXIT INT TERM
  A_TOTAL="$(total_tests "$STAMP-armA.log")"; A_TOTAL="${A_TOTAL:-0}"
  B_TOTAL="$(total_tests "$STAMP-armB.log")"; B_TOTAL="${B_TOTAL:-0}"
  if [ "$ARM_B" != "failed" ]; then
    VERDICT="vacuous"; CODE=1
  elif load_failed "$STAMP-armB.log" || [ "$B_TOTAL" -lt "$A_TOTAL" ]; then
    # The suite did not execute under mutation, so nothing was falsified. Reported as
    # broken rather than falsifying: a module that will not load fails every test, which
    # is indistinguishable from a real failure by exit code alone.
    VERDICT="mutation broke the module — suite ran $B_TOTAL of $A_TOTAL tests, nothing falsified"
    CODE=2
  else
    VERDICT="falsifying"; CODE=0
  fi
fi

summarise() { grep -E '^(Tests|Test Suites):' "$1" 2>/dev/null | tr '\n' ' ' | sed 's/  */ /g'; }
A_SUM="$(summarise "$STAMP-armA.log")"
B_SUM="$(summarise "$STAMP-armB.log")"
FAILED_NAMES="$(grep -E '^\s+●[^›]*›' "$STAMP-armB.log" 2>/dev/null | sed 's/^ *//' | head -10)"

cat > "$STAMP.json" <<JSON
{
  "verdict": "$VERDICT",
  "exit": $CODE,
  "test": "$TEST",
  "mutation": { "source": "$SOURCE", "line": $LINE,
                "from": $(printf '%s' "$ORIGINAL_LINE" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))'),
                "to": $(printf '%s' "$REPLACE" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))') },
  "armA": { "result": "$ARM_A", "summary": "$A_SUM", "log": "$STAMP-armA.log" },
  "armB": { "result": "$ARM_B", "summary": "$B_SUM", "log": "$STAMP-armB.log" },
  "env": { "head": "$HEAD_SHA", "tracked_changes": $DIRTY, "node": "$NODE_V", "yarn_lock_sha256_16": "$LOCK_SHA" }
}
JSON

{
  echo "### Falsification probe — \`$VERDICT\`"
  echo
  echo "| Arm | Mutation | Result |"
  echo "|---|---|---|"
  echo "| A — baseline | none | \`$A_SUM\` |"
  echo "| B — mutant | \`$SOURCE:$LINE\` replaced | \`$B_SUM\` |"
  echo
  case "$VERDICT" in
    falsifying) echo "The suite **fails when the mechanism is removed** and passes when restored, running the same $A_TOTAL tests in both arms. The test has power." ;;
    vacuous)    echo "The suite **passes with the mechanism removed**. It does not test what it appears to test." ;;
    baseline-already-failing) echo "Arm A did not pass, so arm B was not run. No conclusion." ;;
    *)          echo "**No conclusion.** $VERDICT — a module that will not load fails every test, which an exit code cannot tell apart from a real falsification." ;;
  esac
  [ -n "$FAILED_NAMES" ] && { echo; echo "Failing under mutation:"; echo; printf '%s\n' "$FAILED_NAMES" | sed 's/^/- /'; }
  echo
  echo "<sub>Produced by \`falsify-probe.sh\` at \`$HEAD_SHA\` · node \`$NODE_V\` · yarn.lock \`$LOCK_SHA\` · $DIRTY tracked changes. $(capture_provenance)</sub>"
} > "$STAMP.md"

printf 'falsify-probe: %s (exit %s)\n  %s\n  %s\n' "$VERDICT" "$CODE" "$STAMP.json" "$STAMP.md" >&2
# The limits below are identical on every run: they describe the instrument, not the
# change under review. Pasted into a PR comment they read as boilerplate to a reviewer
# who has no stake in this tooling, so they go to stderr and to the .json instead. The
# orchestrator reads them and writes ONE open question about THIS diff.
printf 'limits: one line of one file was mutated. Says nothing about other paths into the
same mechanism, whether it is reachable in production, or whether the guarded behaviour is
correct. This probe proves the suite notices one mutated line, which is not the same as the
base-against-branch proof that a test is connected to the reported bug -- see the red-on-base
skill for that experiment.%s\n' \
  "$([ "$VERDICT" = vacuous ] && printf '\n  vacuous: the mechanism is unguarded by this suite — what else depends on it?')" >&2
exit "$CODE"
