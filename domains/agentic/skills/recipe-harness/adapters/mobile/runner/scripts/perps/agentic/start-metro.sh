#!/bin/bash
# Start Metro bundler — or attach to an already-running instance.
# Optionally launches the app on a booted simulator/emulator.
#
# Behavior:
#   1. Probe http://localhost:$PORT/status to detect a running Metro.
#   2. If running: print a message and exit 0 (caller can tail .agent/metro.log).
#   3. If not running: start Metro in background, tee to .agent/metro.log,
#      write PID to .agent/metro.pid, wait for the ready signal.
#   4. If --launch flag is passed: after Metro is ready, launch the app via
#      deep link — app auto-connects to Metro.
#
# Usage:
#   scripts/perps/agentic/start-metro.sh            # Metro only
#   scripts/perps/agentic/start-metro.sh --launch   # Metro + launch app
#
# Sources WATCHER_PORT, SIM_UDID, ANDROID_DEVICE, PLATFORM from .js.env (default port: 8081).

set -euo pipefail

cd "$(dirname "$0")/../../.."
# Source .js.env but only for vars not already set, so caller env takes precedence.
# shellcheck source=lib/safe-env-parser.sh
. "$(dirname "$0")/lib/safe-env-parser.sh"
load_js_env

PORT="${WATCHER_PORT:-8081}"
# Bound Metro transform worker fanout. MetaMask Mobile bundles can retain GBs
# per worker after first transform; uncapped Expo defaults to CPU count and can
# consume tens of GB across mm-* slots. Override when intentionally benchmarking.
METRO_MAX_WORKERS="${METRO_MAX_WORKERS:-2}"
[[ "$PORT" =~ ^[0-9]+$ ]] || { echo "ERROR: WATCHER_PORT must be numeric (got: $PORT)" >&2; exit 1; }
LOGFILE=".agent/metro.log"
PIDFILE=".agent/metro.pid"
TIMEOUT=60
LAUNCH_APP=false

# ── Platform detection ─────────────────────────────────────────────
detect_platform() {
  if [ -n "${PLATFORM:-}" ]; then echo "$PLATFORM"; return; fi
  if [ -n "${SIM_UDID:-}" ]; then echo "ios"; return; fi
  if [ -n "${ANDROID_DEVICE:-}" ]; then echo "android"; return; fi
  # Default to ios on macOS, android otherwise
  if [ "$(uname)" = "Darwin" ]; then echo "ios"; else echo "android"; fi
}
PLAT=$(detect_platform)

# ── Platform-specific constants ────────────────────────────────────
if [ "$PLAT" = "ios" ]; then
  BUNDLE_ID="io.metamask.MetaMask"
  SIM_TARGET="${SIM_UDID:-${IOS_SIMULATOR:-booted}}"
else
  PACKAGE_ID="io.metamask"
  ADB_TARGET=$(adb devices 2>/dev/null | awk '/\tdevice$/{print $1; exit}' || true)
  ADB_CMD="adb"
  [ -n "$ADB_TARGET" ] && ADB_CMD="adb -s $ADB_TARGET"
fi

# Parse flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --launch) LAUNCH_APP=true; shift ;;
    --platform) PLATFORM="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# Re-detect platform if --platform was passed after initial detection
if [ -n "${PLATFORM:-}" ] && [ "$PLAT" != "$PLATFORM" ]; then
  PLAT="$PLATFORM"
  if [ "$PLAT" = "ios" ]; then
    BUNDLE_ID="io.metamask.MetaMask"
    SIM_TARGET="${SIM_UDID:-${IOS_SIMULATOR:-booted}}"
  else
    PACKAGE_ID="io.metamask"
    ADB_TARGET=$(adb devices 2>/dev/null | awk '/\tdevice$/{print $1; exit}' || true)
    ADB_CMD="adb"
    [ -n "$ADB_TARGET" ] && ADB_CMD="adb -s $ADB_TARGET"
  fi
fi

# ── Launch helpers ─────────────────────────────────────────────────

# Suppress the Expo dev launcher onboarding popup (first-launch "developer menu" modal).
# Sets a native preference so the popup never appears — clean for video recording.
suppress_expo_dev_menu_ios() {
  xcrun simctl spawn "$SIM_TARGET" defaults write "$BUNDLE_ID" EXDevMenuIsOnboardingFinished -bool YES 2>/dev/null || true
}
suppress_expo_dev_menu_android() {
  local PREFS_DIR="/data/data/$PACKAGE_ID/shared_prefs"
  local PREFS_FILE="expo.modules.devmenu.sharedpreferences.xml"
  $ADB_CMD shell "mkdir -p $PREFS_DIR && echo '<?xml version=\"1.0\" encoding=\"utf-8\" standalone=\"yes\" ?><map><boolean name=\"isOnboardingFinished\" value=\"true\" /></map>' > $PREFS_DIR/$PREFS_FILE" 2>/dev/null || true
}

prewarm_ios_bundle() {
  [ "${AGENTIC_PREWARM_BUNDLE:-1}" = "1" ] || return 0
  local bundle_url="http://localhost:${PORT}/index.bundle?platform=ios&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.bytecode=1&transform.routerRoot=app&unstable_transformProfile=hermes-stable"
  echo "Prewarming iOS bundle cache..."
  if curl -fsS --max-time "${AGENTIC_BUNDLE_PREWARM_TIMEOUT:-600}" "$bundle_url" >/dev/null; then
    echo "iOS bundle cache ready."
  else
    echo "WARN: iOS bundle prewarm failed or timed out; launching app anyway."
  fi
}

ios_sim_udid() {
  if [[ "$SIM_TARGET" =~ ^[0-9A-Fa-f-]{36}$ ]]; then
    echo "$SIM_TARGET"
    return 0
  fi
  xcrun simctl list devices 2>/dev/null \
    | awk -v name="$SIM_TARGET" 'index($0, "    " name " (") == 1 { gsub(/[()]/, "", $2); print $2; exit }'
}

app_running_ios() {
  # `simctl spawn <sim> launchctl list` is not reliable on recent simulator
  # runtimes while Expo dev-client is downloading/loading the bundle. The host
  # process path always includes the simulator UDID, so use that as authority.
  local udid
  udid="$(ios_sim_udid)"
  [ -n "$udid" ] || return 1
  pgrep -f "CoreSimulator/Devices/${udid}/.*MetaMask\.app/MetaMask" >/dev/null 2>&1 && return 0
  xcrun simctl spawn "$SIM_TARGET" launchctl list 2>/dev/null | grep -q "$BUNDLE_ID"
}

launch_app_ios() {
  suppress_expo_dev_menu_ios
  prewarm_ios_bundle
  xcrun simctl terminate "$SIM_TARGET" "$BUNDLE_ID" 2>/dev/null || true
  sleep 1

  ENCODED_URL=$(python3 -c "import urllib.parse; print(urllib.parse.quote('http://localhost:${PORT}?disableOnboarding=1', safe=''))")
  DEV_CLIENT_URL="expo-metamask://expo-development-client/?url=${ENCODED_URL}"
  if ! xcrun simctl openurl "$SIM_TARGET" "$DEV_CLIENT_URL" 2>/dev/null; then
    echo "ERROR: Could not open dev-client URL; is the app installed on this simulator?"
    return 1
  fi

  # Do not relaunch after a fixed 5s sleep. On a cold bundle the app can spend
  # longer than that downloading/initializing JS; relaunching during that window
  # creates overlapping RN runtimes and crashes in native module installation
  # (observed in REAModule installTurboModule). Wait for the actual process.
  local launch_wait=0
  while [ "$launch_wait" -lt "${AGENTIC_IOS_LAUNCH_CONFIRM_TIMEOUT:-45}" ]; do
    app_running_ios && return 0
    sleep 1
    launch_wait=$((launch_wait + 1))
  done

  echo "ERROR: App did not stay running after dev-client launch; cannot wait for CDP targets."
  return 1
}

launch_app_android() {
  # Ensure device can reach Metro on host (localhost on device != host machine)
  $ADB_CMD reverse tcp:$PORT tcp:$PORT 2>/dev/null || echo "WARN: adb reverse failed — device may not reach Metro"

  suppress_expo_dev_menu_android
  $ADB_CMD shell am force-stop "$PACKAGE_ID" 2>/dev/null || true
  sleep 1

  ENCODED_URL=$(python3 -c "import urllib.parse; print(urllib.parse.quote('http://localhost:${PORT}?disableOnboarding=1', safe=''))")
  DEV_CLIENT_URL="expo-metamask://expo-development-client/?url=${ENCODED_URL}"
  $ADB_CMD shell am start -a android.intent.action.VIEW -d "$DEV_CLIENT_URL" 2>/dev/null || \
    echo "WARN: Could not launch app — is it installed on this device?"

  # First launch after a rebuild sometimes crashes — retry once
  sleep 5
  if ! $ADB_CMD shell pidof "$PACKAGE_ID" >/dev/null 2>&1; then
    echo "App exited after launch — retrying..."
    sleep 2
    $ADB_CMD shell am start -a android.intent.action.VIEW -d "$DEV_CLIENT_URL" 2>/dev/null || true
  fi

}

launch_app() {
  if [ "$PLAT" = "ios" ]; then launch_app_ios; else launch_app_android; fi
}

mkdir -p .agent

# --- Detect a running Metro via HTTP probe ---
if curl -sf --max-time 2 "http://localhost:${PORT}/status" >/dev/null 2>&1; then
  echo "Metro already running on port $PORT."
  echo ""
  echo "To follow live logs:  tail -f $LOGFILE"
  echo "To reload apps:       ./scripts/perps/agentic/reload-metro.sh"
  echo "To stop Metro:        ./scripts/perps/agentic/stop-metro.sh"
  if $LAUNCH_APP; then
    echo "Launching app..."
    launch_app
  fi
  exit 0
fi

# --- No Metro detected — start fresh ---
> "$LOGFILE"

# Keep Metro/Babel caches by default so the skill-owned live command is
# idempotent and does not force a full JS rebundle on every validation run.
# Callers that intentionally changed inline env values can request a reset.
if [ "${AGENTIC_RESET_METRO_CACHE:-0}" = "1" ]; then
  rm -rf "${TMPDIR:-/tmp}/metro-cache" "${TMPDIR:-/tmp}/haste-map-"* 2>/dev/null || true
fi

echo "Starting Metro on port $PORT..."
METRO_TMUX_SESSION=""
# Keep Metro detached from the harness command by default. Earlier versions
# started a nested tmux session whenever the developer ran the easy command from
# tmux; on large first bundles that nested session could disappear mid-transform
# and kill the foreground prewarm before the app ever reached CDP. The nohup
# path is stable for both tmux and non-tmux callers because it disowns the Expo
# process before this helper returns. Keep an opt-in tmux path for local
# debugging only.
if [ "${AGENTIC_USE_METRO_TMUX:-0}" = "1" ] && [ -n "${TMUX:-}" ] && command -v tmux >/dev/null 2>&1; then
  METRO_TMUX_SESSION="mms-metro-${PORT}-$(basename "$PWD" | tr -cd '[:alnum:]_-')"
  tmux kill-session -t "$METRO_TMUX_SESSION" 2>/dev/null || true
  tmux new-session -d -s "$METRO_TMUX_SESSION" -c "$PWD" \
    "env EXPO_NO_TYPESCRIPT_SETUP=1 yarn expo start --port '$PORT' --max-workers '$METRO_MAX_WORKERS'"
  METRO_TMUX_PANE=$(tmux display-message -p -t "$METRO_TMUX_SESSION" '#{pane_id}' 2>/dev/null || echo "")
  if [ -n "$METRO_TMUX_PANE" ]; then
    tmux pipe-pane -o -t "$METRO_TMUX_PANE" "cat >> '$LOGFILE'" 2>/dev/null || true
    METRO_PID=$(tmux display-message -p -t "$METRO_TMUX_PANE" '#{pane_pid}' 2>/dev/null || echo "")
  else
    tmux pipe-pane -o -t "$METRO_TMUX_SESSION" "cat >> '$LOGFILE'" 2>/dev/null || true
    METRO_PID=$(tmux display-message -p -t "$METRO_TMUX_SESSION" '#{pane_pid}' 2>/dev/null || echo "")
  fi
  echo "$METRO_TMUX_SESSION" > .agent/metro.tmux-session
  echo "${METRO_PID:-tmux:$METRO_TMUX_SESSION}" > "$PIDFILE"
  echo "Metro tmux session: $METRO_TMUX_SESSION, logging to $LOGFILE"
else
  # Detach Metro from this helper. When start-metro.sh is run from a one-shot
  # harness/preflight script, a plain background job can receive SIGHUP as the
  # parent shell exits, leaving a "ready" log line but no listening server by
  # the time CDP/app-state validation starts. nohup keeps the skill-owned easy
  # command alive after this wrapper returns.
  python3 - "$PORT" "$LOGFILE" <<'PY' &
import os
import sys

port, log_path = sys.argv[1], sys.argv[2]
devnull = os.open("/dev/null", os.O_RDONLY)
log = os.open(log_path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
try:
    os.setsid()
except OSError:
    # Best effort: exec still happens with stdio detached below.
    pass
os.dup2(devnull, 0)
os.dup2(log, 1)
os.dup2(log, 2)
for fd in (devnull, log):
    try:
        os.close(fd)
    except OSError:
        pass
env = os.environ.copy()
env["EXPO_NO_TYPESCRIPT_SETUP"] = "1"
max_workers = os.environ.get("METRO_MAX_WORKERS", "2")
os.execvpe("yarn", ["yarn", "expo", "start", "--port", port, "--max-workers", max_workers], env)
PY
  METRO_PID=$!
  # Ensure parent shell exit does not propagate job-control cleanup to Metro.
  # The Python shim above calls setsid() before exec so this works even when
  # the easy command itself is killed or exits from a tmux-launched shell.
  disown "$METRO_PID" 2>/dev/null || true
  echo "$METRO_PID" > "$PIDFILE"
  rm -f .agent/metro.tmux-session
  echo "Metro PID: $METRO_PID, logging to $LOGFILE"
fi

metro_alive() {
  if [ -n "$METRO_TMUX_SESSION" ]; then
    tmux has-session -t "$METRO_TMUX_SESSION" 2>/dev/null
  else
    kill -0 "$METRO_PID" 2>/dev/null
  fi
}

# Wait for ready signal
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  if curl -sf --max-time 2 "http://localhost:${PORT}/status" >/dev/null 2>&1 || grep -q "Waiting on http://localhost:${PORT}" "$LOGFILE" 2>/dev/null; then
    echo "Metro ready after ${ELAPSED}s."
    echo ""
    echo "To follow live logs:  tail -f $LOGFILE"
    echo "To reload apps:       ./scripts/perps/agentic/reload-metro.sh"
    echo "To stop Metro:        ./scripts/perps/agentic/stop-metro.sh"
    if $LAUNCH_APP; then
      echo "Launching app..."
      launch_app
    fi
    exit 0
  fi
  if ! metro_alive; then
    echo "ERROR: Metro exited unexpectedly. Last 10 lines:"
    tail -10 "$LOGFILE"
    rm -f "$PIDFILE"
    exit 1
  fi
  sleep 1
  ELAPSED=$((ELAPSED + 1))
done

echo "WARNING: Metro did not signal ready within ${TIMEOUT}s (PID $METRO_PID still running)."
echo "Last 10 lines of $LOGFILE:"
tail -10 "$LOGFILE"
exit 1
