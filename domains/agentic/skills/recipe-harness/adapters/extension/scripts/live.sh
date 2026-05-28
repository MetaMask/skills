#!/usr/bin/env bash
set -euo pipefail

TARGET="$PWD"
CDP_PORT=""
ARTIFACTS=""
PREPARE_CMD="${RECIPE_HARNESS_EXTENSION_LAUNCH_CMD:-}"
LAUNCH_EXISTING_DIST=false
START_TEST_WATCH=false
DIST_DIR="dist/chrome"
CHROME_USER_DATA_DIR=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --cdp-port) CDP_PORT="$2"; shift 2 ;;
    --artifacts-dir) ARTIFACTS="$2"; shift 2 ;;
    --prepare-cmd) PREPARE_CMD="$2"; shift 2 ;;
    --launch-existing-dist) LAUNCH_EXISTING_DIST=true; shift ;;
    --start-test-watch) START_TEST_WATCH=true; LAUNCH_EXISTING_DIST=true; shift ;;
    --dist-dir) DIST_DIR="$2"; shift 2 ;;
    --chrome-user-data-dir) CHROME_USER_DATA_DIR="$2"; shift 2 ;;
    -h|--help) echo "Usage: live.sh [--target <metamask-extension>] --cdp-port <port> [--launch-existing-dist|--start-test-watch|--prepare-cmd <cmd>] [--dist-dir dist/chrome] [--artifacts-dir <dir>]"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

[ -n "$CDP_PORT" ] || { echo "Missing --cdp-port for Extension live validation" >&2; exit 2; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$(cd "$TARGET" && pwd)"
ARTIFACTS="${ARTIFACTS:-$TARGET/.agent/recipe-harness/extension/live/$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p "$ARTIFACTS/logs"

if $LAUNCH_EXISTING_DIST && [ -z "$PREPARE_CMD" ]; then
  DIST_ABS="$TARGET/$DIST_DIR"
  RUNTIME_DIST_ABS="$ARTIFACTS/runtime-dist"
  PROFILE_ABS="${CHROME_USER_DATA_DIR:-$ARTIFACTS/chrome-profile}"
  mkdir -p "$PROFILE_ABS"
  quoted_dist="$(printf '%q' "$DIST_ABS")"
  quoted_runtime_dist="$(printf '%q' "$RUNTIME_DIST_ABS")"
  quoted_profile="$(printf '%q' "$PROFILE_ABS")"
  CHROME_BIN="${RECIPE_HARNESS_CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
  quoted_chrome="$(printf '%q' "$CHROME_BIN")"
  quoted_chrome_log="$(printf '%q' "$ARTIFACTS/logs/chrome.log")"
  quoted_chrome_pid="$(printf '%q' "$ARTIFACTS/logs/chrome.pid")"
  prepare_parts=()
  if $START_TEST_WATCH; then
    prepare_parts+=("mkdir -p temp/runtime")
    # Scope watcher reuse to this checkout. A machine-global pgrep can match an
    # unrelated repo and leave this target validating stale dist/chrome output.
    prepare_parts+=("watch_pid_file=temp/runtime/recipe-harness-webpack.pid; watch_log=temp/runtime/recipe-harness-webpack.log; if [ -f \"\$watch_pid_file\" ]; then watch_pid=\$(cat \"\$watch_pid_file\" 2>/dev/null || true); else watch_pid=; fi; if [ -z \"\$watch_pid\" ] || ! kill -0 \"\$watch_pid\" >/dev/null 2>&1; then rm -f \"\$watch_pid_file\"; : > \"\$watch_log\"; nohup env -u BUNDLED_DEBUGPY_PATH yarn start:test > \"\$watch_log\" 2>&1 & echo \$! > \"\$watch_pid_file\"; fi")
    prepare_parts+=("compiled=false; for i in {1..240}; do if grep -E 'MetaMask.*compiled|compiled with' temp/runtime/recipe-harness-webpack.log >/dev/null 2>&1; then compiled=true; break; fi; sleep 2; done; if [ \"\$compiled\" != true ]; then echo 'Timed out waiting for target-scoped yarn start:test compilation marker' >&2; exit 1; fi")
  fi
  prepare_parts+=("for i in {1..180}; do [ -f ${quoted_dist}/manifest.json ] && break; sleep 2; done")
  prepare_parts+=("test -f ${quoted_dist}/manifest.json")
  prepare_parts+=("rm -rf ${quoted_runtime_dist} && mkdir -p ${quoted_runtime_dist} && rsync -a --delete --exclude _metadata ${quoted_dist}/ ${quoted_runtime_dist}/")
  prepare_parts+=("node -e 'const fs=require(\"fs\"); const p=process.argv[1]; const m=JSON.parse(fs.readFileSync(p,\"utf8\")); delete m.key; fs.writeFileSync(p, JSON.stringify(m, null, 2)+\"\\\\n\")' ${quoted_runtime_dist}/manifest.json")
  chrome_launch_cmd="nohup ${quoted_chrome} --user-data-dir=${quoted_profile}"
  chrome_launch_cmd+=" --remote-debugging-address=127.0.0.1 --remote-debugging-port=${CDP_PORT}"
  chrome_launch_cmd+=" --no-first-run --disable-first-run-ui --disable-default-apps --disable-popup-blocking"
  chrome_launch_cmd+=" --disable-extensions-file-access-check --disable-features=ExtensionContentVerification"
  chrome_launch_cmd+=" --load-extension=${quoted_runtime_dist} chrome://extensions/"
  chrome_launch_cmd+=" > ${quoted_chrome_log} 2>&1 & echo \$! > ${quoted_chrome_pid}"
  prepare_parts+=("$chrome_launch_cmd")
  prepare_parts+=("for i in {1..60}; do curl -fsS --max-time 1 http://127.0.0.1:${CDP_PORT}/json/version >/dev/null 2>&1 && exit 0; sleep 1; done; exit 1")
  PREPARE_CMD="$(IFS='; '; printf '%s' "${prepare_parts[*]}")"
fi

echo "Extension live validation command:"
display_args=(recipe-harness live --cdp-port "$CDP_PORT")
$LAUNCH_EXISTING_DIST && display_args+=(--launch-existing-dist)
$START_TEST_WATCH && display_args+=(--start-test-watch)
printf '  '
printf '%q ' "${display_args[@]}"
printf '\n'
echo "Launch artifacts: $ARTIFACTS/launch"
echo "Verify artifacts: $ARTIFACTS/verify"

launch_args=(--target "$TARGET" --cdp-port "$CDP_PORT" --artifacts-dir "$ARTIFACTS/launch")
[ -n "$PREPARE_CMD" ] && launch_args+=(--prepare-cmd "$PREPARE_CMD")

set +e
"$SCRIPT_DIR/launch.sh" "${launch_args[@]}"
launch_status=$?
set -e

verify_status=1
if [ "$launch_status" -eq 0 ]; then
  set +e
  "$SCRIPT_DIR/verify.sh" --target "$TARGET" --cdp-port "$CDP_PORT" --artifacts-dir "$ARTIFACTS/verify"
  verify_status=$?
  set -e
else
  echo "Skipping Extension live verify because launch failed; see $ARTIFACTS/launch/summary.json" >&2
fi

TARGET_FOR_SUMMARY="$TARGET" ARTIFACTS_FOR_SUMMARY="$ARTIFACTS" CDP_PORT_FOR_SUMMARY="$CDP_PORT" LAUNCH_STATUS="$launch_status" VERIFY_STATUS="$verify_status" LAUNCH_EXISTING_DIST="$LAUNCH_EXISTING_DIST" START_TEST_WATCH="$START_TEST_WATCH" node <<'NODE'
const fs = require('fs');
const path = require('path');
const artifacts = process.env.ARTIFACTS_FOR_SUMMARY;
const launchSummary = path.join(artifacts, 'launch', 'summary.json');
const verifySummary = path.join(artifacts, 'verify', 'summary.json');
const launchStatus = Number(process.env.LAUNCH_STATUS);
const verifyStatus = Number(process.env.VERIFY_STATUS);
fs.writeFileSync(path.join(artifacts, 'summary.json'), `${JSON.stringify({
  adapter: 'extension',
  action: 'live',
  status: launchStatus === 0 && verifyStatus === 0 ? 'pass' : 'fail',
  target: process.env.TARGET_FOR_SUMMARY,
  cdpPort: process.env.CDP_PORT_FOR_SUMMARY,
  launchExistingDist: process.env.LAUNCH_EXISTING_DIST === 'true',
  startTestWatch: process.env.START_TEST_WATCH === 'true',
  launch: { exitCode: launchStatus, summaryPath: fs.existsSync(launchSummary) ? launchSummary : null },
  verify: { exitCode: verifyStatus, summaryPath: fs.existsSync(verifySummary) ? verifySummary : null },
  easyCommand: `<skill-dir>/scripts/recipe-harness live --cdp-port ${process.env.CDP_PORT_FOR_SUMMARY} --launch-existing-dist`,
  note: 'Runs launch then live verify so a developer can validate browser startup, CDP readiness, recipe bridge, screenshots/fallback classification, and sample recipes from one skill-owned command.',
  generatedAt: new Date().toISOString(),
}, null, 2)}\n`);
NODE

echo "Extension live validation summary: $ARTIFACTS/summary.json"
[ "$launch_status" -eq 0 ] && [ "$verify_status" -eq 0 ]
