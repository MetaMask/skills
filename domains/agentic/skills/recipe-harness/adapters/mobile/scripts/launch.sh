#!/usr/bin/env bash
set -euo pipefail

TARGET="$PWD"
PLATFORM="ios"
PREFLIGHT_MODE="${RECIPE_HARNESS_MOBILE_PREFLIGHT_MODE:-fast}"
ARTIFACTS=""
WALLET_SETUP="auto"
WALLET_FIXTURE=".agent/wallet-fixture.json"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --platform) PLATFORM="$2"; shift 2 ;;
    --preflight-mode|--mode) PREFLIGHT_MODE="$2"; shift 2 ;;
    --artifacts-dir) ARTIFACTS="$2"; shift 2 ;;
    --wallet-setup) WALLET_SETUP="true"; shift ;;
    --no-wallet-setup) WALLET_SETUP="false"; shift ;;
    --wallet-fixture) WALLET_FIXTURE="$2"; shift 2 ;;
    -h|--help) echo "Usage: launch.sh [--target <metamask-mobile>] [--platform ios|android] [--preflight-mode fast|auto|default|rebuild-native|clean] [--artifacts-dir <dir>] [--wallet-setup|--no-wallet-setup]"; exit 0 ;;
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
if ! command -v harness_root >/dev/null 2>&1; then
  echo "recipe-harness: shared lib scripts/lib/harness-path.sh not found; reinstall the harness." >&2
  exit 1
fi
TARGET="$(cd "$TARGET" && pwd)"
HARNESS_DIR="$(harness_dir "$TARGET" mobile)"
ARTIFACTS="${ARTIFACTS:-$HARNESS_DIR/launch/$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p "$ARTIFACTS/logs"

if [ ! -x "$TARGET/scripts/perps/agentic/preflight.sh" ]; then
  echo "Mobile recipe harness is not installed in $TARGET. Run recipe-harness mobile install --target $TARGET first." >&2
  exit 1
fi

preflight_args=(scripts/perps/agentic/preflight.sh --platform "$PLATFORM" --mode "$PREFLIGHT_MODE")
fixture_status="MISSING_FIXTURES"
if [ -f "$TARGET/$WALLET_FIXTURE" ]; then
  fixture_status="READY"
  if [ "$WALLET_SETUP" != "false" ]; then
    preflight_args+=(--wallet-setup --wallet-fixture "$WALLET_FIXTURE")
  fi
elif [ "$WALLET_SETUP" = "true" ]; then
  echo "Requested --wallet-setup but fixture is missing: $TARGET/$WALLET_FIXTURE" >&2
  exit 1
fi

echo "Launching Mobile harness runtime: platform=$PLATFORM mode=$PREFLIGHT_MODE target=$TARGET" | tee "$ARTIFACTS/logs/launch.log"
echo "Fixture status: $fixture_status ($WALLET_FIXTURE)" | tee -a "$ARTIFACTS/logs/launch.log"
set +e
(
  cd "$TARGET"
  bash "${preflight_args[@]}"
) 2>&1 | tee -a "$ARTIFACTS/logs/launch.log"
preflight_status=${PIPESTATUS[0]}
set -e

status="pass"
if [ "$preflight_status" -ne 0 ]; then
  status="fail"
  app_state_status="skipped"
elif (
  cd "$TARGET"
  bash scripts/perps/agentic/app-state.sh status
) > "$ARTIFACTS/logs/app-state.json" 2> "$ARTIFACTS/logs/app-state.err"; then
  app_state_status="pass"
else
  app_state_status="fail"
  status="fail"
fi

TARGET_FOR_SUMMARY="$TARGET" ARTIFACTS_FOR_SUMMARY="$ARTIFACTS" STATUS_FOR_SUMMARY="$status" PREFLIGHT_STATUS="$preflight_status" APP_STATE_STATUS="$app_state_status" PLATFORM_FOR_SUMMARY="$PLATFORM" MODE_FOR_SUMMARY="$PREFLIGHT_MODE" FIXTURE_STATUS="$fixture_status" node <<'NODE'
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const target = process.env.TARGET_FOR_SUMMARY;
const artifacts = process.env.ARTIFACTS_FOR_SUMMARY;
function run(cmd) {
  try { return cp.execSync(cmd, { cwd: target, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
}
let appState = null;
try { appState = JSON.parse(fs.readFileSync(path.join(artifacts, 'logs/app-state.json'), 'utf8')); } catch {}
const watcherPort = run("bash -lc '. scripts/perps/agentic/lib/safe-env-parser.sh 2>/dev/null; load_js_env 2>/dev/null; printf \"%s\" \"${WATCHER_PORT:-8081}\"'") || '8081';
fs.writeFileSync(path.join(artifacts, 'summary.json'), `${JSON.stringify({
  adapter: 'mobile',
  action: 'launch',
  status: process.env.STATUS_FOR_SUMMARY,
  platform: process.env.PLATFORM_FOR_SUMMARY,
  preflightMode: process.env.MODE_FOR_SUMMARY,
  preflight: {
    status: Number(process.env.PREFLIGHT_STATUS) === 0 ? 'pass' : 'fail',
    exitCode: Number(process.env.PREFLIGHT_STATUS),
    logPath: path.join(artifacts, 'logs/launch.log'),
  },
  runtimePolicy: {
    nativeBuildPolicy: process.env.MODE_FOR_SUMMARY === 'fast'
      ? 'fast mode reuses an installed matching app or shared cache and fails before native rebuild; use --preflight-mode auto/default only after explicit approval'
      : 'this mode may run native build/setup work; caller must have recorded explicit approval before using it',
  },
  target,
  watcherPort,
  fixtureStatus: process.env.FIXTURE_STATUS,
  appControl: {
    status: process.env.APP_STATE_STATUS,
    route: appState?.route || null,
  },
  cleanupCommand: `recipe-harness mobile cleanup --target ${target}`,
  note: 'Launch starts/reuses the harness runtime only; it does not run a recipe or claim evidence validation.',
  generatedAt: new Date().toISOString(),
}, null, 2)}\n`);
NODE

echo "Mobile harness launch $status: $ARTIFACTS/summary.json"
[ "$status" = "pass" ]
