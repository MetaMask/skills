#!/usr/bin/env bash
set -euo pipefail

TARGET="$PWD"
OUT="temp/agentic/recipes"
CDP_PORT=""
ARTIFACTS=""
STATIC_ONLY=false
while [ "$#" -gt 0 ]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --cdp-port) CDP_PORT="$2"; shift 2 ;;
    --artifacts-dir) ARTIFACTS="$2"; shift 2 ;;
    --static-only) STATIC_ONLY=true; shift ;;
    -h|--help) echo "Usage: verify.sh [--target <metamask-extension>] [--out <temp/agentic/recipes>] [--cdp-port <port>] [--static-only]"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/path.sh"
TARGET="$(cd "$TARGET" && pwd)"
HARNESS_DIR="$TARGET/.agent/recipe-harness/extension"
if ! OUT_ABS="$(resolve_harness_out "$TARGET" "$OUT")"; then
  echo "Refusing extension harness verify outside target: $OUT" >&2
  exit 1
fi
ARTIFACTS="${ARTIFACTS:-$HARNESS_DIR/verify/$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p "$ARTIFACTS/logs"

status="pass"
checks=()

check_file() {
  local rel="$1"
  if [ -e "$TARGET/$rel" ]; then
    checks+=("{\"name\":\"$rel\",\"status\":\"pass\"}")
  else
    checks+=("{\"name\":\"$rel\",\"status\":\"fail\"}")
    status="fail"
  fi
}

check_file ".agent/recipe-harness/extension/manifest.json"
check_file "$OUT/validate-recipe.sh"
check_file "$OUT/validate-recipe.js"
check_file "$OUT/lib/workflow.js"

live_mode="static-only"
if [ "$STATIC_ONLY" = false ]; then
  if [ -z "$CDP_PORT" ]; then
    echo "Live extension verify requires --cdp-port. Static checks may pass, but runtime proof is missing." > "$ARTIFACTS/logs/live-missing-cdp.log"
    checks+=("{\"name\":\"live runtime CDP port\",\"status\":\"fail\",\"detail\":\"missing --cdp-port\"}")
    status="fail"
    live_mode="missing-cdp"
  else
    live_mode="live"
    if (
      cd "$TARGET"
      bash "$OUT/validate-recipe.sh" "$OUT/domains/browser-features/recipes/service-worker-smoke.json" --cdp-port "$CDP_PORT" --artifacts-dir "$ARTIFACTS/non-ui"
    ) > "$ARTIFACTS/logs/non-ui-sample.log" 2>&1; then
      checks+=("{\"name\":\"live non-ui service-worker sample\",\"status\":\"pass\"}")
    else
      checks+=("{\"name\":\"live non-ui service-worker sample\",\"status\":\"fail\"}")
      status="fail"
    fi

    if (
      cd "$TARGET"
      bash "$OUT/validate-recipe.sh" "$OUT/domains/browser-features/recipes/target-inspect-smoke.json" --cdp-port "$CDP_PORT" --artifacts-dir "$ARTIFACTS/ui"
    ) > "$ARTIFACTS/logs/ui-browser-sample.log" 2>&1; then
      checks+=("{\"name\":\"live UI/browser target-inspect sample\",\"status\":\"pass\"}")
    else
      checks+=("{\"name\":\"live UI/browser target-inspect sample\",\"status\":\"fail\"}")
      status="fail"
    fi
  fi
fi

if git -C "$TARGET" rev-parse --git-dir >/dev/null 2>&1; then
  git -C "$TARGET" status --short -- . ":(exclude).agent/recipe-harness" ":(exclude)$OUT" > "$ARTIFACTS/logs/product-diff-excluding-harness.log" 2>&1 || true
fi

RECIPE_HARNESS_LIVE_MODE="$live_mode" node - "$ARTIFACTS" "$status" "${checks[@]}" <<'NODE'
const fs = require('fs');
const path = require('path');
const [artifacts, status, ...checks] = process.argv.slice(2);
const parsedChecks = checks.map((entry) => JSON.parse(entry));
const liveMode = process.env.RECIPE_HARNESS_LIVE_MODE || 'unknown';
fs.writeFileSync(path.join(artifacts, 'summary.json'), `${JSON.stringify({
  adapter: 'extension',
  status,
  liveMode,
  checks: parsedChecks,
  generatedAt: new Date().toISOString(),
}, null, 2)}\n`);
fs.writeFileSync(path.join(artifacts, 'artifact-manifest.json'), `${JSON.stringify({
  artifacts: fs.readdirSync(artifacts).map((name) => ({ path: name })),
}, null, 2)}\n`);
NODE

echo "Extension harness verify $status: $ARTIFACTS/summary.json"
[ "$status" = "pass" ]
