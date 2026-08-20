#!/usr/bin/env bash
#
# selector-recompute — measure how often a reselect selector actually recomputes.
#
# Lane C4. A memoization claim ("avoids recomputation", "stops deep traversal",
# "prevents re-renders") is a claim about a COUNT. `reselect` exposes that count
# natively via `.recomputations()`, so no instrumentation and no profiler is
# needed — and no operator judgement either.
#
# Generates a throwaway probe test, runs it, captures the counter under three
# conditions, removes the probe, and writes the artifact itself.
#
#   A  identical state reference, repeated   → memoized floor (expect 1)
#   B  fresh enclosing slice, unrelated field changed → does an unrelated write cost a recompute?
#   C  a real input key perturbed            → does a relevant write cost one? (expect +1 each)
#
# B is the discriminating condition. A selector taking narrowed inputs is
# unmoved by B; one reading a whole slice recomputes on every unrelated write.
#
# Usage:
#   selector-recompute.sh --module <import path> --export <name> \
#     --fixture <json path> --slice <key> --perturb <key> [--n 5] [--label <slug>]
#
# Example:
#   selector-recompute.sh \
#     --module ui/selectors/multichain-accounts/account-tree \
#     --export getWalletsWithAccounts \
#     --fixture test/data/mock-state.json --slice metamask --perturb pinnedAccountList
#
# Exit codes — the code is the verdict, so a finding and a failure to measure differ:
#   0  measured: "narrowed" or "recomputes on unrelated writes"
#   2  no reading extracted from the probe output
#   3  usage error
#   4  VALUE UNSTABLE — correctness precondition failed, the count is not meaningful
#   5  probe-failed — the instrument produced no reading
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

N=5; OUT_DIR="evidence-artifacts"; LABEL=""; MODULE=""; EXPORT=""; FIXTURE=""; SLICE="metamask"; PERTURB=""
die() { printf 'selector-recompute: %s\n' "$1" >&2; exit 3; }

while [ $# -gt 0 ]; do
  case "$1" in
    --module)  MODULE="${2:-}"; shift 2 ;;
    --export)  EXPORT="${2:-}"; shift 2 ;;
    --fixture) FIXTURE="${2:-}"; shift 2 ;;
    --slice)   SLICE="${2:-}"; shift 2 ;;
    --perturb) PERTURB="${2:-}"; shift 2 ;;
    --n)       N="${2:-}"; shift 2 ;;
    --label)   LABEL="${2:-}"; shift 2 ;;
    --out)     OUT_DIR="${2:-}"; shift 2 ;;
    -h|--help) sed -n '2,35p' "$0"; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

[ -n "$MODULE" ]  || die "--module is required (import path, no extension)"
[ -n "$EXPORT" ]  || die "--export is required (the selector's exported name)"
[ -n "$FIXTURE" ] || die "--fixture is required (a JSON state fixture)"
[ -n "$PERTURB" ] || die "--perturb is required (an input key the selector genuinely reads)"
[ -f "$FIXTURE" ] || die "fixture not found: $FIXTURE"
[ -f "$MODULE.ts" ] || [ -f "$MODULE.js" ] || die "module not found: $MODULE.{ts,js}"

LABEL="${LABEL:-recompute-$EXPORT}"
mkdir -p "$OUT_DIR" || die "cannot create $OUT_DIR"
STAMP="$OUT_DIR/$LABEL"
PROBE="$(dirname "$MODULE")/__recompute_probe__.test.ts"

# Relative import from the probe back to the module, and up to the fixture.
MOD_BASE="./$(basename "$MODULE")"
DEPTH="$(dirname "$MODULE" | tr -cd '/' | wc -c | tr -d ' ')"
UP=""; i=0; while [ "$i" -le "$DEPTH" ]; do UP="../$UP"; i=$((i+1)); done

# The probe used to be deleted on exit, which left the exhibit quoting
# `yarn jest <generated probe>` — a command line that cannot be run, printed where a
# reader expects a reproducible one. It is kept alongside the artifact instead, and
# removed from the working tree so the repo is left clean.
KEEP_PROBE="$STAMP.probe.test.ts"
cleanup() { [ -f "$PROBE" ] && cp "$PROBE" "$KEEP_PROBE"; rm -f "$PROBE"; }
trap cleanup EXIT INT TERM

cat > "$PROBE" <<PROBEEOF
import { $EXPORT } from '$MOD_BASE';
import fixture from '$UP$FIXTURE';

describe('$EXPORT recomputation probe', () => {
  it('counts recomputations across three conditions', () => {
    const base = fixture as never as { $SLICE: Record<string, unknown> };
    const call = (s: unknown) => ($EXPORT as (x: never) => unknown)(s as never);

    ($EXPORT as unknown as { resetRecomputations: () => void }).resetRecomputations();
    const count = () => ($EXPORT as unknown as { recomputations: () => number }).recomputations();

    const seen: string[] = [];
    const snap = (v: unknown) => { try { return JSON.stringify(v); } catch { return '<unserialisable>'; } };

    for (let i = 0; i < $N; i++) seen.push(snap(call(base)));
    const a = count();
    const stableIdentical = new Set(seen).size === 1;

    const unrelatedSeen: string[] = [];
    for (let i = 0; i < $N; i++) {
      unrelatedSeen.push(snap(call({ ...base, $SLICE: { ...base.$SLICE, __unrelated__: i } })));
    }
    const b = count();
    // A write the selector does not read must not change what it returns. If it does,
    // the memoisation is not the story — the selector has an input it does not declare.
    const stableUnrelated = new Set(unrelatedSeen).size === 1 && unrelatedSeen[0] === seen[0];

    for (let i = 0; i < $N; i++) {
      call({ ...base, $SLICE: { ...base.$SLICE, $PERTURB: [\`0x\${i}\`] } });
    }
    const c = count();

    // eslint-disable-next-line no-console
    console.log(
      \`RECOMPUTE_PROBE identical=\${a} unrelated=\${b} inputChanged=\${c} n=$N\` +
      \` valueStable=\${stableIdentical && stableUnrelated}\`,
    );
    expect(c).toBeGreaterThanOrEqual(b);
    // Correctness gates the measurement: an unstable value makes the count meaningless.
    expect(stableIdentical).toBe(true);
    expect(stableUnrelated).toBe(true);
  });
});
PROBEEOF

yarn jest "$PROBE" > "$STAMP.log" 2>&1
CODE=$?
cleanup; trap - EXIT INT TERM

LINE="$(grep -o 'RECOMPUTE_PROBE .*' "$STAMP.log" | head -1)"
STABLE="$(printf '%s' "$LINE" | sed -n 's/.*valueStable=\([a-z]*\).*/\1/p')"
A="$(printf '%s' "$LINE" | sed -n 's/.*identical=\([0-9]*\).*/\1/p')"
B="$(printf '%s' "$LINE" | sed -n 's/.*unrelated=\([0-9]*\).*/\1/p')"
C="$(printf '%s' "$LINE" | sed -n 's/.*inputChanged=\([0-9]*\).*/\1/p')"

if [ -z "$A" ]; then
  VERDICT="probe-failed"
elif [ "$STABLE" = "false" ]; then
  # Correctness first. A selector whose value moves under a write it does not read has an
  # undeclared input, and no recomputation count means anything until that is resolved.
  VERDICT="VALUE UNSTABLE — breaking behaviour, count not meaningful"
elif [ "$B" -gt "$A" ]; then
  VERDICT="recomputes on unrelated writes"
else
  VERDICT="narrowed — unrelated writes cost nothing"
fi

HEAD_SHA="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
DIRTY="$(git status --porcelain 2>/dev/null | grep -v '^??' | wc -l | tr -d ' ')"
NODE_V="$(node -v 2>/dev/null || echo unknown)"

cat > "$STAMP.json" <<JSON
{ "selector": "$EXPORT", "module": "$MODULE", "verdict": "$VERDICT", "exit": $CODE,
  "n_calls_per_condition": $N,
  "recomputations": { "identical": ${A:-null}, "unrelated_write": ${B:-null}, "input_changed": ${C:-null} },
  "env": { "head": "$HEAD_SHA", "tracked_changes": $DIRTY, "node": "$NODE_V" },
  "log": "$STAMP.log" }
JSON

{
  echo "### \`$EXPORT\` recomputation count"
  echo
  echo "**Verdict:** $VERDICT"
  echo
  echo "| Condition | Calls | Recomputations |"
  echo "|---|---|---|"
  echo "| Identical state reference | $N | ${A:-?} |"
  echo "| Fresh \`$SLICE\` slice, unrelated field | $N | ${B:-?} |"
  echo "| \`$PERTURB\` changed (a real input) | $N | ${C:-?} |"
  echo
  if [ "$STABLE" = "true" ]; then
    echo "**Correctness:** the returned value is identical across all calls above, so the count"
    echo "measures memoisation rather than a change in behaviour."
  else
    echo "**Correctness: FAILED.** The returned value changed under a write the selector does not"
    echo "declare as an input. That is a behavioural difference, not a performance one, and it"
    echo "makes the recomputation count meaningless — resolve it before reading the numbers."
  fi
  echo
  echo '```console'
  echo "\$ git checkout --detach $HEAD_SHA && yarn jest $PROBE"
  # The tool's own output, not a line this script composed. A summary a script writes
  # about its own run carries the script's word; the runner's stdout carries the run's.
  grep -E "RECOMPUTE_PROBE |^Test Suites:|^Tests: |^Time: " "$STAMP.log" | head -8
  echo '```'
  echo
  echo "<sub>Produced by \`selector-recompute.sh\` via reselect's own counter; the probe is generated, run, and kept beside this artifact. head \`$HEAD_SHA\` · $DIRTY tracked changes · node \`$NODE_V\`. $(capture_provenance)</sub>"
} > "$STAMP.md"

printf 'selector-recompute: %s\n  %s\n  %s\n' "$VERDICT" "$STAMP.json" "$STAMP.md" >&2
# The limits below are identical on every run: they describe the instrument, not the
# change under review. Pasted into a PR comment they read as boilerplate to a reviewer
# who has no stake in this tooling, so they go to stderr and to the .json instead. The
# orchestrator reads them and writes ONE open question about THIS diff.
printf 'limits: one fixture, one perturbed key. A selector unmoved here can still recompute
under state this fixture does not reach, and the count says nothing about the cost of each
recomputation.\n' >&2
[ -n "$A" ] || exit 2

# The exit code is the verdict, and it has to distinguish a finding from a failure to
# measure. Both of the cases below were exit 0, so a caller gating on the exit code saw
# green on a run whose own artifact says the number is not meaningful — and the only thing
# standing between that and publication was attest-gate happening to grep the verdict
# string out of the prose.
#
#   0  a real measurement: narrowed, or recomputes on unrelated writes. A finding is not
#      a failure, and a selector that recomputes is a result, not an error.
#   4  VALUE UNSTABLE — the correctness precondition failed. The count is not meaningful,
#      so there is no measurement here to gate on.
#   5  probe-failed — the instrument did not produce a reading at all.
case "$VERDICT" in
  "VALUE UNSTABLE"*) exit 4 ;;
  "probe-failed")    exit 5 ;;
esac
exit 0
