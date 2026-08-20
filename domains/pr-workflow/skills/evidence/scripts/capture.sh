#!/usr/bin/env bash
#
# capture — turn any analysis command into a contract-compliant evidence artifact.
#
# The analysis scripts in this repo (retention-scan.py, policy-audit.py, a jest
# probe, a selector recomputation counter) all print to stdout. Printing to stdout
# means the operator is the capture device: they read it, retype some of it into a
# comment, and the result carries their provenance rather than the measurement's.
#
# This wraps any command so the ARTIFACT is written by the tool. Nothing is retyped.
#
#   capture.sh --label <slug> --lane <id> --claim "<under test>" [--verdict <word>]
#              [--open "<what this run leaves open>"]
#              [--max-log-lines N | --head-lines N --tail-lines N] -- <cmd...>
#
# --verdict is stated by the caller, never inferred from the exit code: a wrapped
# tool's exit convention is its own, and guessing prints "pass" over real findings.
#
# --open is the same discipline pointed the other way. A run succeeds by putting
# concerns in front of a reviewer, not by closing them, so what the wrapped tool
# could not reach is publishable content. Omitting it is recorded, not hidden.
#
# Emits, under --out (default evidence-artifacts/):
#   <label>.log    raw stdout+stderr of the command, unmodified
#   <label>.json   machine-readable: verdict, exit code, env pin, claim
#   <label>.md     the block to attach, quoting the log rather than summarising it
#
# Exit code is the wrapped command's own, so CI gates on it unchanged.
#
# Example:
#   capture.sh --label defi-retention --lane C9 \
#     --claim "every retention primitive this diff introduces is released" \
#     -- python3 retention-scan.py ui/store/background-connection.ts pr.patch
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

OUT_DIR="evidence-artifacts"; LABEL=""; LANE=""; CLAIM=""; MAXLOG=120; VERDICT=""; OPEN=""
HEADL=""; TAILL=""
die() { printf 'capture: %s\n' "$1" >&2; exit 3; }

while [ $# -gt 0 ]; do
  case "$1" in
    --label) LABEL="${2:-}"; shift 2 ;;
    --lane)  LANE="${2:-}"; shift 2 ;;
    --claim) CLAIM="${2:-}"; shift 2 ;;
    --verdict) VERDICT="${2:-}"; shift 2 ;;
    --open)  OPEN="${2:-}"; shift 2 ;;
    --out)   OUT_DIR="${2:-}"; shift 2 ;;
    --max-log-lines) MAXLOG="${2:-}"; shift 2 ;;
    # Two thirds head / one third tail is a guess about where the finding is. For a
    # tool that escalates at the bottom the useful split is the other way round, and
    # the caller knows which shape its tool has.
    --head-lines) HEADL="${2:-}"; shift 2 ;;
    --tail-lines) TAILL="${2:-}"; shift 2 ;;
    -h|--help) sed -n '2,26p' "$0"; exit 0 ;;
    --) shift; break ;;
    *) die "unknown argument: $1 (did you forget -- before the command?)" ;;
  esac
done

[ -n "$LABEL" ] || die "--label is required"
[ -n "$CLAIM" ] || die "--claim is required: name the falsifiable thing under test"
[ $# -gt 0 ]    || die "no command given after --"

mkdir -p "$OUT_DIR" || die "cannot create $OUT_DIR"
STAMP="$OUT_DIR/$LABEL"

HEAD_SHA="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
DIRTY="$(git status --porcelain 2>/dev/null | grep -v '^??' | wc -l | tr -d ' ')"
NODE_V="$(node -v 2>/dev/null || echo n/a)"
PY_V="$(python3 -V 2>&1 || echo n/a)"
LOCK_SHA="$( { sha256sum yarn.lock 2>/dev/null || shasum -a 256 yarn.lock 2>/dev/null; } | cut -c1-16)"
[ -n "$LOCK_SHA" ] || LOCK_SHA="n/a"
CMD_STR="$*"

# Run it. Never interpret the output — capture it verbatim.
"$@" > "$STAMP.log" 2>&1
CODE=$?

LINES="$(wc -l < "$STAMP.log" | tr -d ' ')"
# No verdict is inferred from the exit code. A wrapped tool's convention is its own —
# policy-audit.py exits 0 while listing sixteen new capability grants, so guessing here
# would print "pass" over a page of findings. The caller states the verdict or none is claimed.
[ -n "$VERDICT" ] || VERDICT="completed"

jstr() { printf '%s' "${1-}" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))'; }

cat > "$STAMP.json" <<JSON
{
  "label": $(jstr "$LABEL"),
  "lane": $(jstr "$LANE"),
  "claim": $(jstr "$CLAIM"),
  "command": $(jstr "$CMD_STR"),
  "verdict": "$VERDICT",
  "open_for_review": $(jstr "$OPEN"),
  "exit": $CODE,
  "log": "$STAMP.log",
  "log_lines": $LINES,
  "env": { "head": "$HEAD_SHA", "tracked_changes": $DIRTY,
           "node": "$NODE_V", "python": "$PY_V", "yarn_lock_sha256_16": "$LOCK_SHA" }
}
JSON

{
  if [ "$VERDICT" = "completed" ]; then
    echo "### Ran to completion (exit $CODE) — read the output, no verdict asserted"
  else
    echo "### \`$VERDICT\` (exit $CODE)"
  fi
  echo
  echo "**Claim under test:** $CLAIM"
  echo
  echo '```console'
  echo "\$ $CMD_STR"
  BUDGET=$(( ${HEADL:-0} + ${TAILL:-0} )); [ "$BUDGET" -gt 0 ] || BUDGET="$MAXLOG"
  if [ "$LINES" -gt "$BUDGET" ]; then
    # Elide the middle, never the end. A tool that escalates does it last:
    # policy-audit.py prints a per-grant worklist first and its RAISE WITH A HUMAN
    # section at the bottom, so head-truncation cuts exactly the rows that needed a
    # reader and leaves a wall of checkboxes in their place.
    H="${HEADL:-$(( MAXLOG * 2 / 3 ))}"; T="${TAILL:-$(( MAXLOG - H ))}"
    head -n "$H" "$STAMP.log"
    printf '\n… %s lines elided from the middle — full output in %s\n\n' \
      "$((LINES - BUDGET))" "${STAMP##*/}.log"
    tail -n "$T" "$STAMP.log"
  else
    cat "$STAMP.log"
  fi
  echo '```'
  echo
  echo "<sub>Produced by \`capture.sh\`, not transcribed. head \`$HEAD_SHA\` · $DIRTY tracked changes · node \`$NODE_V\` · \`$PY_V\` · yarn.lock \`$LOCK_SHA\`. $(capture_provenance)</sub>"
} > "$STAMP.md"

printf 'capture: %s (exit %s)\n  %s\n  %s\n  %s\n' "$VERDICT" "$CODE" "$STAMP.log" "$STAMP.json" "$STAMP.md" >&2
# Stated limits reach the orchestrator, not the pasted exhibit: one open question per
# comment, about this diff, beats the same sentence repeated under every block.
if [ -n "$OPEN" ]; then
  printf 'limits: %s\n' "$OPEN" >&2
else
  printf 'limits: none stated. This tool answered one question; what it does not cover was
not recorded, which is not the same as it covering everything.\n' >&2
fi
exit "$CODE"
