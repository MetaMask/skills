#!/usr/bin/env bash
set -euo pipefail

TARGET="$PWD"
CDP_PORT=""
ARTIFACTS=""
PREPARE_CMD="${RECIPE_HARNESS_EXTENSION_LAUNCH_CMD:-}"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --cdp-port) CDP_PORT="$2"; shift 2 ;;
    --artifacts-dir) ARTIFACTS="$2"; shift 2 ;;
    --prepare-cmd) PREPARE_CMD="$2"; shift 2 ;;
    -h|--help) echo "Usage: launch.sh [--target <metamask-extension>] [--cdp-port <port>] [--prepare-cmd <cmd>] [--artifacts-dir <dir>]"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

TARGET="$(cd "$TARGET" && pwd)"
HARNESS_DIR="$TARGET/.agent/recipe-harness/extension"
ARTIFACTS="${ARTIFACTS:-$HARNESS_DIR/launch/$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p "$ARTIFACTS/logs"

if [ ! -f "$TARGET/.agent/recipe-harness/extension/manifest.json" ]; then
  echo "Extension recipe harness is not installed in $TARGET. Run recipe-harness extension install --target $TARGET first." >&2
  exit 1
fi

if [ -n "$PREPARE_CMD" ]; then
  echo "Launching Extension harness runtime with caller-supplied prepare command" | tee "$ARTIFACTS/logs/launch.log"
  set +e
  (
    cd "$TARGET"
    bash -lc "$PREPARE_CMD"
  ) 2>&1 | tee -a "$ARTIFACTS/logs/launch.log"
  prepare_status=${PIPESTATUS[0]}
  set -e
else
  echo "No Extension prepare command supplied; reusing existing CDP runtime if reachable." | tee "$ARTIFACTS/logs/launch.log"
  prepare_status=0
fi

status="pass"
if [ "$prepare_status" -ne 0 ]; then
  status="fail"
elif [ -z "$CDP_PORT" ]; then
  echo "Missing --cdp-port; cannot confirm Extension app-control runtime." | tee -a "$ARTIFACTS/logs/launch.log"
  status="fail"
elif node "$(dirname "$0")/extension-readiness.js" --target "$TARGET" --cdp-port "$CDP_PORT" --json > "$ARTIFACTS/logs/extension-readiness.json" 2>&1; then
  :
else
  status="fail"
fi

TARGET_FOR_SUMMARY="$TARGET" ARTIFACTS_FOR_SUMMARY="$ARTIFACTS" STATUS_FOR_SUMMARY="$status" CDP_PORT_FOR_SUMMARY="$CDP_PORT" PREPARE_SUPPLIED="$([ -n "$PREPARE_CMD" ] && echo true || echo false)" PREPARE_STATUS="$prepare_status" node <<'NODE'
const fs = require('fs');
const path = require('path');
const target = process.env.TARGET_FOR_SUMMARY;
const artifacts = process.env.ARTIFACTS_FOR_SUMMARY;
let readiness = null;
try { readiness = JSON.parse(fs.readFileSync(path.join(artifacts, 'logs/extension-readiness.json'), 'utf8')); } catch {}
const appControlStatus =
  process.env.STATUS_FOR_SUMMARY === 'pass' && readiness && readiness.status !== 'fail' ? 'pass' : 'fail';
fs.writeFileSync(path.join(artifacts, 'summary.json'), `${JSON.stringify({
  adapter: 'extension',
  action: 'launch',
  status: process.env.STATUS_FOR_SUMMARY,
  target,
  cdpPort: process.env.CDP_PORT_FOR_SUMMARY || null,
  prepare: {
    commandSupplied: process.env.PREPARE_SUPPLIED === 'true',
    status: Number(process.env.PREPARE_STATUS) === 0 ? 'pass' : 'fail',
    exitCode: Number(process.env.PREPARE_STATUS),
    logPath: path.join(artifacts, 'logs/launch.log'),
  },
  runtimePolicy: {
    runtimeReusePolicy: 'reuse a running harness-compatible CDP target when possible; caller-supplied startup commands must use cached/watch-only paths unless the human explicitly permits a rebuild',
  },
  appControl: {
    status: appControlStatus,
    readiness,
  },
  cleanupCommand: `recipe-harness extension cleanup --target ${target}`,
  note: 'Launch starts/reuses the harness runtime only; it does not run a recipe or claim evidence validation. Extension startup commands are caller-supplied so the skill does not encode local farm aliases.',
  generatedAt: new Date().toISOString(),
}, null, 2)}\n`);
NODE

echo "Extension harness launch $status: $ARTIFACTS/summary.json"
[ "$status" = "pass" ]
