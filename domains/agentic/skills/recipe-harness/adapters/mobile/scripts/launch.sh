#!/usr/bin/env bash
set -euo pipefail

TARGET="$PWD"
PLATFORM="ios"
PREFLIGHT_MODE="${RECIPE_HARNESS_MOBILE_PREFLIGHT_MODE:-fast}"
ARTIFACTS=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --platform) PLATFORM="$2"; shift 2 ;;
    --preflight-mode|--mode) PREFLIGHT_MODE="$2"; shift 2 ;;
    --artifacts-dir) ARTIFACTS="$2"; shift 2 ;;
    --wallet-setup|--no-wallet-setup) shift ;;
    --wallet-fixture) shift 2 ;;
    -h|--help) echo "Usage: launch.sh [--target <metamask-mobile>] [--platform ios|android] [--preflight-mode fast] [--artifacts-dir <dir>]"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

case "$PLATFORM" in ios|android) ;; *) echo "Unknown --platform: $PLATFORM" >&2; exit 2 ;; esac
case "$PREFLIGHT_MODE" in fast|auto|default|rebuild-native|clean) ;; *) echo "Unknown --preflight-mode: $PREFLIGHT_MODE" >&2; exit 2 ;; esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
for _hp in "$SCRIPT_DIR/lib/harness-path.sh" "$SCRIPT_DIR/../../../scripts/lib/harness-path.sh"; do
  [ -f "$_hp" ] && { . "$_hp"; break; }
done
unset _hp
if ! command -v harness_dir >/dev/null 2>&1; then
  echo "recipe-harness: shared lib scripts/lib/harness-path.sh not found; reinstall the harness." >&2
  exit 1
fi
TARGET="$(cd "$TARGET" && pwd)"
HARNESS_DIR="$(harness_dir "$TARGET" mobile)"
RUNNER_BIN="$HARNESS_DIR/runner/bin/metamask-recipe"
ARTIFACTS="${ARTIFACTS:-$HARNESS_DIR/launch/$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p "$ARTIFACTS/logs"

if [ ! -x "$RUNNER_BIN" ]; then
  echo "Mobile recipe runner is not installed in $TARGET. Run recipe-harness mobile install --target $TARGET first." >&2
  exit 1
fi

cat > "$ARTIFACTS/mobile-launch-status.recipe.json" <<'JSON'
{
  "schema_version": 1,
  "title": "Mobile runner runtime status",
  "description": "Checks that the installed runner can read Mobile app status through the runner-owned bridge.",
  "validate": {
    "workflow": {
      "entry": "status",
      "nodes": {
        "status": { "action": "app.status", "intent": "Read Mobile app status through the runner-owned bridge", "next": "done" },
        "done": { "action": "end", "status": "pass" }
      }
    }
  }
}
JSON

status="pass"
if (
  cd "$TARGET"
  "$RUNNER_BIN" run "$ARTIFACTS/mobile-launch-status.recipe.json" --adapter mobile --project-root "$TARGET" --artifacts-dir "$ARTIFACTS/runner-status" --json
) > "$ARTIFACTS/logs/runner-status.log" 2>&1; then
  runtime_status="pass"
else
  runtime_status="fail"
  status="fail"
fi

TARGET_FOR_SUMMARY="$TARGET" ARTIFACTS_FOR_SUMMARY="$ARTIFACTS" STATUS_FOR_SUMMARY="$status" RUNTIME_STATUS="$runtime_status" PLATFORM_FOR_SUMMARY="$PLATFORM" MODE_FOR_SUMMARY="$PREFLIGHT_MODE" node <<'NODE'
const fs = require('fs');
const path = require('path');
const artifacts = process.env.ARTIFACTS_FOR_SUMMARY;
fs.writeFileSync(path.join(artifacts, 'summary.json'), `${JSON.stringify({
  adapter: 'mobile',
  action: 'launch',
  status: process.env.STATUS_FOR_SUMMARY,
  platform: process.env.PLATFORM_FOR_SUMMARY,
  preflightMode: process.env.MODE_FOR_SUMMARY,
  target: process.env.TARGET_FOR_SUMMARY,
  runtime: {
    status: process.env.RUNTIME_STATUS,
    logPath: path.join(artifacts, 'logs/runner-status.log'),
  },
  runtimePolicy: {
    nativeBuildPolicy: 'launch reuses an already-running runner/slot runtime and does not call product-local Mobile scripts or native builds',
  },
  note: 'Mobile launch no longer starts product-local harness scripts. Prepare/reuse a slot runtime, then run live/verify for recipe proof.',
  generatedAt: new Date().toISOString(),
}, null, 2)}\n`);
NODE

echo "Mobile harness launch $status: $ARTIFACTS/summary.json"
[ "$status" = "pass" ]
