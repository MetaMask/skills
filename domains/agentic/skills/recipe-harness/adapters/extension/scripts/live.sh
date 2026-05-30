#!/usr/bin/env bash
set -euo pipefail

TARGET="$PWD"
CDP_PORT=""
ARTIFACTS=""
OUT=".agent/recipe-harness/extension/runner/recipes"
PREPARE_CMD="${RECIPE_HARNESS_EXTENSION_LAUNCH_CMD:-}"
LAUNCH_EXISTING_DIST=false
START_WATCH=false
DIST_DIR="dist/chrome"
CHROME_USER_DATA_DIR=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --target) [ "$#" -ge 2 ] || { echo "Missing value for $1" >&2; exit 2; }; TARGET="$2"; shift 2 ;;
    --out) [ "$#" -ge 2 ] || { echo "Missing value for $1" >&2; exit 2; }; OUT="$2"; shift 2 ;;
    --cdp-port) [ "$#" -ge 2 ] || { echo "Missing value for $1" >&2; exit 2; }; CDP_PORT="$2"; shift 2 ;;
    --artifacts-dir) [ "$#" -ge 2 ] || { echo "Missing value for $1" >&2; exit 2; }; ARTIFACTS="$2"; shift 2 ;;
    --prepare-cmd) [ "$#" -ge 2 ] || { echo "Missing value for $1" >&2; exit 2; }; PREPARE_CMD="$2"; shift 2 ;;
    --launch-existing-dist) LAUNCH_EXISTING_DIST=true; shift ;;
    --start-watch|--start-test-watch) START_WATCH=true; LAUNCH_EXISTING_DIST=true; shift ;;
    --dist-dir) [ "$#" -ge 2 ] || { echo "Missing value for $1" >&2; exit 2; }; DIST_DIR="$2"; shift 2 ;;
    --chrome-user-data-dir) [ "$#" -ge 2 ] || { echo "Missing value for $1" >&2; exit 2; }; CHROME_USER_DATA_DIR="$2"; shift 2 ;;
    -h|--help) echo "Usage: live.sh [--target <metamask-extension>] [--out <.agent/recipe-harness/extension/runner/recipes>] --cdp-port <port> [--launch-existing-dist|--start-watch|--prepare-cmd <cmd>] [--dist-dir dist/chrome] [--artifacts-dir <dir>]"; exit 0 ;;
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
  WALLET_FIXTURE_ABS=""
  if [ -f "$TARGET/temp/runtime/wallet-fixture.json" ]; then
    WALLET_FIXTURE_ABS="$TARGET/temp/runtime/wallet-fixture.json"
  elif [ -f "$TARGET/.agent/wallet-fixture.json" ]; then
    WALLET_FIXTURE_ABS="$TARGET/.agent/wallet-fixture.json"
  fi
  FIXTURE_STATE_ABS="$ARTIFACTS/fixture-state.json"
  FIXTURE_VALIDATION_ABS="$ARTIFACTS/logs/fixture-account-parity.json"
  mkdir -p "$PROFILE_ABS"
  quoted_dist="$(printf '%q' "$DIST_ABS")"
  quoted_runtime_dist="$(printf '%q' "$RUNTIME_DIST_ABS")"
  quoted_profile="$(printf '%q' "$PROFILE_ABS")"
  quoted_fixture_script="$(printf '%q' "$SCRIPT_DIR/wallet-fixture-state.cjs")"
  quoted_fixture_state="$(printf '%q' "$FIXTURE_STATE_ABS")"
  quoted_fixture_validation="$(printf '%q' "$FIXTURE_VALIDATION_ABS")"
  quoted_extension_id_file="$(printf '%q' "$TARGET/temp/runtime/extension.id")"
  quoted_target="$(printf '%q' "$TARGET")"
  if [ -n "${RECIPE_HARNESS_CHROME_BIN:-}" ]; then
    CHROME_BIN="$RECIPE_HARNESS_CHROME_BIN"
    if [ ! -f "$CHROME_BIN" ] || [ ! -x "$CHROME_BIN" ]; then
      echo "[recipe-harness] RECIPE_HARNESS_CHROME_BIN is not an executable file: $CHROME_BIN" >&2
      exit 1
    fi
  else
    CHROME_BIN="$(cd "$TARGET" && node <<'NODE' || true
const fs = require('fs');

let chromium = null;
function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}
for (const pkg of ['@playwright/test', 'playwright']) {
  try {
    chromium = require(pkg).chromium;
    if (chromium) break;
  } catch (_error) {
    // Optional Playwright package unavailable; try the next package name.
  }
}
if (!chromium) {
  console.error('[recipe-harness] Playwright is not available from this checkout; install dependencies first, or set RECIPE_HARNESS_CHROME_BIN to an explicitly approved browser.');
  process.exit(1);
}

let executable = '';
try {
  executable = chromium.executablePath();
} catch (error) {
  const message = error && error.message ? error.message : String(error);
  console.error(`[recipe-harness] Could not resolve Playwright Chromium executable: ${message}. Manual approval required before installing the Playwright Chromium browser cache (no package.json changes); ask the user before running yarn exec playwright install chromium.`);
  process.exit(1);
}
if (!fs.existsSync(executable)) {
  console.error(`[recipe-harness] Playwright Chromium is not installed at ${executable}. Manual approval required before installing the Playwright Chromium browser cache (no package.json changes). Ask the user for approval; if they agree, run: cd ${shellQuote(process.cwd())} && yarn exec playwright install chromium`);
  console.error('[recipe-harness] To use a browser that is already installed, set RECIPE_HARNESS_CHROME_BIN=/path/to/chrome explicitly.');
  process.exit(1);
}

process.stdout.write(executable);
NODE
)"
    if [ -z "$CHROME_BIN" ]; then
      echo "[recipe-harness] No approved Chromium binary selected; stopping before live Extension launch." >&2
      exit 1
    fi
  fi
  quoted_chrome="$(printf '%q' "$CHROME_BIN")"
  quoted_chrome_log="$(printf '%q' "$ARTIFACTS/logs/chrome.log")"
  quoted_chrome_pid="$(printf '%q' "$ARTIFACTS/logs/chrome.pid")"
  prepare_parts=()
  if $START_WATCH; then
    prepare_parts+=("mkdir -p temp/runtime")
    # Scope watcher reuse to this checkout. A machine-global pgrep can match an
    # unrelated repo and leave this target validating stale dist/chrome output.
    prepare_parts+=("watch_pid_file=temp/runtime/recipe-harness-webpack.pid; watch_log=temp/runtime/recipe-harness-webpack.log; if [ -f \"\$watch_pid_file\" ]; then watch_pid=\$(cat \"\$watch_pid_file\" 2>/dev/null || true); else watch_pid=; fi; if [ -z \"\$watch_pid\" ] || ! kill -0 \"\$watch_pid\" >/dev/null 2>&1; then rm -f \"\$watch_pid_file\"; : > \"\$watch_log\"; echo '[recipe-harness] Starting yarn start; streaming temp/runtime/recipe-harness-webpack.log'; nohup env -u BUNDLED_DEBUGPY_PATH yarn start > \"\$watch_log\" 2>&1 & echo \$! > \"\$watch_pid_file\"; else echo \"[recipe-harness] Reusing existing yarn start pid \$watch_pid; streaming temp/runtime/recipe-harness-webpack.log\"; fi")
    prepare_parts+=("tail -n +1 -F temp/runtime/recipe-harness-webpack.log & watch_tail_pid=\$!")
    prepare_parts+=("compiled=false; for i in {1..240}; do if grep -E 'MetaMask.*compiled|compiled with|Bundle end: service worker|Bundle end:.*app-init' temp/runtime/recipe-harness-webpack.log >/dev/null 2>&1; then compiled=true; break; fi; sleep 2; done; kill \"\$watch_tail_pid\" >/dev/null 2>&1 || true; wait \"\$watch_tail_pid\" 2>/dev/null || true; if [ \"\$compiled\" != true ]; then echo 'Timed out waiting for target-scoped yarn start compilation marker' >&2; echo 'Last webpack log lines:' >&2; tail -80 temp/runtime/recipe-harness-webpack.log >&2 || true; exit 1; fi; echo '[recipe-harness] yarn start compilation marker observed'")
  fi
  prepare_parts+=("for i in {1..180}; do [ -f ${quoted_dist}/manifest.json ] && break; sleep 2; done")
  prepare_parts+=("test -f ${quoted_dist}/manifest.json")
  prepare_parts+=("rm -rf ${quoted_runtime_dist} && mkdir -p ${quoted_runtime_dist} && rsync -a --delete --exclude _metadata ${quoted_dist}/ ${quoted_runtime_dist}/")
  if [ -n "$WALLET_FIXTURE_ABS" ]; then
    quoted_wallet_fixture="$(printf '%q' "$WALLET_FIXTURE_ABS")"
    prepare_parts+=("node ${quoted_fixture_script} generate --target ${quoted_target} --fixture ${quoted_wallet_fixture} --out ${quoted_fixture_state}")
    prepare_parts+=("node ${quoted_fixture_script} prefill-profile --target ${quoted_target} --state ${quoted_fixture_state} --profile ${quoted_profile} --extension-dir ${quoted_runtime_dist} --extension-id-file ${quoted_extension_id_file}")
  fi
  chrome_launch_cmd="nohup env -u BUNDLED_DEBUGPY_PATH -u PYTHONHOME -u PYTHONPATH -u DYLD_LIBRARY_PATH -u DYLD_FALLBACK_LIBRARY_PATH -u DYLD_INSERT_LIBRARIES ${quoted_chrome} --user-data-dir=${quoted_profile}"
  chrome_launch_cmd+=" --remote-debugging-address=127.0.0.1 --remote-debugging-port=${CDP_PORT}"
  chrome_launch_cmd+=" --no-first-run --disable-first-run-ui --disable-default-apps --disable-popup-blocking"
  chrome_launch_cmd+=" --disable-extensions-file-access-check --disable-extensions-content-verification"
  chrome_launch_cmd+=" --disable-features=ExtensionContentVerification,DisableLoadExtensionCommandLineSwitch"
  chrome_launch_cmd+=" --disable-extensions-except=${quoted_runtime_dist}"
  chrome_launch_cmd+=" --load-extension=${quoted_runtime_dist} chrome://extensions/"
  chrome_launch_cmd+=" > ${quoted_chrome_log} 2>&1 & echo \$! > ${quoted_chrome_pid}"
  prepare_parts+=("$chrome_launch_cmd")
  prepare_parts+=("for i in {1..60}; do curl -fsS --max-time 1 http://127.0.0.1:${CDP_PORT}/json/version >/dev/null 2>&1 && break; sleep 1; done; curl -fsS --max-time 1 http://127.0.0.1:${CDP_PORT}/json/version >/dev/null")
  if [ -n "$WALLET_FIXTURE_ABS" ]; then
    prepare_parts+=("node ${quoted_fixture_script} seed-cdp --target ${quoted_target} --fixture ${quoted_wallet_fixture} --state ${quoted_fixture_state} --cdp-port ${CDP_PORT} --extension-dir ${quoted_runtime_dist} --extension-id-file ${quoted_extension_id_file} --out ${quoted_fixture_validation}")
  fi
  PREPARE_CMD="$(IFS='; '; printf '%s' "${prepare_parts[*]}")"
fi

echo "Extension live validation command:"
display_args=(recipe-harness live --cdp-port "$CDP_PORT")
$LAUNCH_EXISTING_DIST && display_args+=(--launch-existing-dist)
$START_WATCH && display_args+=(--start-watch)
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
  "$SCRIPT_DIR/verify.sh" --target "$TARGET" --out "$OUT" --cdp-port "$CDP_PORT" --artifacts-dir "$ARTIFACTS/verify"
  verify_status=$?
  set -e
else
  echo "Skipping Extension live verify because launch failed; see $ARTIFACTS/launch/summary.json" >&2
fi

TARGET_FOR_SUMMARY="$TARGET" ARTIFACTS_FOR_SUMMARY="$ARTIFACTS" CDP_PORT_FOR_SUMMARY="$CDP_PORT" LAUNCH_STATUS="$launch_status" VERIFY_STATUS="$verify_status" LAUNCH_EXISTING_DIST="$LAUNCH_EXISTING_DIST" START_WATCH="$START_WATCH" node <<'NODE'
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
  startWatch: process.env.START_WATCH === 'true',
  launch: { exitCode: launchStatus, summaryPath: fs.existsSync(launchSummary) ? launchSummary : null },
  verify: { exitCode: verifyStatus, summaryPath: fs.existsSync(verifySummary) ? verifySummary : null },
  easyCommand: `<skill-dir>/scripts/recipe-harness live --cdp-port ${process.env.CDP_PORT_FOR_SUMMARY} --launch-existing-dist`,
  note: 'Runs launch then live verify so a developer can validate browser startup, CDP readiness, recipe bridge, screenshots/fallback classification, and sample recipes from one skill-owned command.',
  generatedAt: new Date().toISOString(),
}, null, 2)}\n`);
NODE

echo "Extension live validation summary: $ARTIFACTS/summary.json"
[ "$launch_status" -eq 0 ] && [ "$verify_status" -eq 0 ]
