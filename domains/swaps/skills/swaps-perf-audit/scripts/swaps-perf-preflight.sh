#!/usr/bin/env bash
#
# swaps-perf-preflight.sh — verify that a machine is ready to run a swaps
# performance audit of MetaMask Mobile. Read-only: it inspects and reports,
# and changes nothing.
#
# Run from the metamask-mobile repository root.
#
#   ./swaps-perf-preflight.sh
#
# Exit 0 means every gate passed and the audit may start. Any other exit means
# it may not, and the failing gate names the command that fixes it.
#
# Run this unsandboxed. It shells out to `xcrun simctl`, `idb`, `lsof`, and
# `curl` against localhost (Metro, the inspector) — a default agent sandbox
# commonly blocks or partially blocks those, which then reads as a failed
# gate even though nothing is actually wrong. The script is read-only, so a
# sandbox buys no safety here, only false failures. In Cursor, pass
# required_permissions: ["all"] on the Shell tool call.
#
# Env overrides:
#   MM_AUDIT_DEVICE_ID    simulator UDID to target (required when several are booted)
#   MM_AUDIT_METRO_PORT   Metro port to check (default: .js.env WATCHER_PORT, else 8081)
#
# What this script deliberately does NOT do. Every one of these was a step the
# provisioning script it replaces used to take, and every one of them is a way
# for a setup to half-succeed and be measured anyway:
#   - It never boots, creates, or shuts down a simulator.
#   - It never starts or stops Metro.
#   - It never downloads or installs a build.
#   - It never runs `mm launch`, and never touches an existing mm session.
#   - It never types your password. Unlocking is yours to do.
#
# Progress and diagnostics go to stderr. On success stdout carries the resolved
# UDID and Metro port as KEY=VALUE lines, so a caller can eval or parse them.

set -euo pipefail

BUNDLE_ID="io.metamask.MetaMask"
DEV_CLIENT_SCHEME="expo-metamask"

# Login screen. Checked first: it renders over the wallet when locked.
LOCKED_IDS='login-password-input|log-in-button|invalid-password-error'
# Any of these means we are past the lock screen.
UNLOCKED_IDS='wallet-screen|wallet-header-root|wallet-scroll-view|wallet-action-buttons|account-picker|bridge-view-scroll'

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { printf '%b%s%b\n' "$BLUE" "$*" "$NC" >&2; }
ok()   { printf '%b✓ %s%b\n' "$GREEN" "$*" "$NC" >&2; }
warn() { printf '%b! %s%b\n' "$YELLOW" "$*" "$NC" >&2; }
fail() { printf '%b✗ %s%b\n' "$RED" "$*" "$NC" >&2; }

# A gate that failed cannot be fixed by reading further output, so `die` stops
# the run. `record_failure` is for the independent gates, which are all
# evaluated before the run stops so one round of fixes clears them together.
FAILURES=0
die() { fail "$*"; exit 1; }
record_failure() { fail "$*"; FAILURES=$((FAILURES + 1)); }

case "${1:-}" in
  -h|--help) sed -n '3,35p' "$0"; exit 0 ;;
  "")        : ;;
  *)         die "Unknown argument: $1 (this script takes none; try --help)" ;;
esac

# ---------------------------------------------------------------------------
# Repo root
# ---------------------------------------------------------------------------

REPO_ROOT="$(pwd)"
if [ ! -f "$REPO_ROOT/package.json" ] || [ ! -d "$REPO_ROOT/tests/llm-workflow" ]; then
  die "Run this from the metamask-mobile repository root (no tests/llm-workflow here)."
fi

JS_ENV="$REPO_ROOT/.js.env"

SIM_UDID=""
SIM_NAME=""
METRO_PORT=""

have() { command -v "$1" >/dev/null 2>&1; }

# ---------------------------------------------------------------------------
# Gate 1 — host toolchain
#
# `mm:doctor` already checks the things the mm iOS driver needs (xcrun, idb,
# idb_companion), so defer to it rather than re-implementing the list and
# letting the two drift. jq and curl are this script's own dependencies.
# ---------------------------------------------------------------------------

check_toolchain() {
  local out node_major

  [ "$(uname -s)" = "Darwin" ] || die "Swaps performance audits run on the iOS Simulator, so macOS only."

  have jq   || { record_failure "jq not found. Install with: brew install jq"; return; }
  have curl || { record_failure "curl not found."; return; }

  if out="$(yarn mm:doctor 2>&1)"; then
    ok "Toolchain ready (yarn mm:doctor passed)"
  else
    record_failure "yarn mm:doctor failed:"
    printf '%s\n' "$out" >&2
    return
  fi

  # `mm cdp` opens a WebSocket to the Metro inspector proxy. Node 20 hides the
  # global WebSocket behind a flag; Node 22+ ships it. Gate 8 needs it.
  node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  if [ "$node_major" -lt 22 ]; then
    case "${NODE_OPTIONS:-}" in
      *--experimental-websocket*) : ;;
      *) record_failure "Node $node_major cannot run 'mm cdp' without a flag. Either use Node 22+, or:
    export NODE_OPTIONS=--experimental-websocket" ;;
    esac
  fi
}

# ---------------------------------------------------------------------------
# Gate 2 — exactly one booted simulator
#
# The old script picked a device for you out of everything available, which is
# how an audit ended up measuring a simulator nobody was looking at. Here the
# booted device *is* the target, and an ambiguous machine is an error.
# ---------------------------------------------------------------------------

# udid|name, one per line, booted iPhones only.
list_booted_iphones() {
  xcrun simctl list devices booted -j 2>/dev/null | jq -r '
    .devices | to_entries[] | .value[]
    | select(.name | test("^iPhone"))
    | "\(.udid)|\(.name)"
  '
}

check_simulator() {
  local booted count row

  booted="$(list_booted_iphones)"
  count="$(printf '%s' "$booted" | grep -c . || true)"

  if [ "$count" -eq 0 ]; then
    record_failure "No iPhone simulator is booted. Boot the one holding your wallet:
    xcrun simctl list devices available
    xcrun simctl boot <UDID> && open -a Simulator"
    return
  fi

  if [ -n "${MM_AUDIT_DEVICE_ID:-}" ]; then
    row="$(printf '%s\n' "$booted" | grep "^$MM_AUDIT_DEVICE_ID|" || true)"
    if [ -z "$row" ]; then
      record_failure "MM_AUDIT_DEVICE_ID=$MM_AUDIT_DEVICE_ID is not a booted iPhone simulator. Booted:
$booted"
      return
    fi
  elif [ "$count" -gt 1 ]; then
    record_failure "$count iPhone simulators are booted, so the target is ambiguous.
Shut the extras down, or name the one to audit:
    MM_AUDIT_DEVICE_ID=<udid> $0
Booted:
$booted"
    return
  else
    row="$booted"
  fi

  SIM_UDID="${row%%|*}"
  SIM_NAME="${row#*|}"
  ok "Simulator: $SIM_NAME ($SIM_UDID)"
}

# ---------------------------------------------------------------------------
# Gate 3 — Metro
# ---------------------------------------------------------------------------

js_env_watcher_port() {
  [ -f "$JS_ENV" ] || return 0
  sed -nE 's/^[[:space:]]*(export[[:space:]]+)?WATCHER_PORT=["'"'"']?([0-9]+).*/\2/p' "$JS_ENV" | tail -1
}

metro_is_healthy() {
  curl -fsS --max-time 3 "http://localhost:$1/status" 2>/dev/null |
    grep -q 'packager-status:running'
}

metro_serves_metamask() {
  curl -fsS --max-time 3 "http://localhost:$1/json/list" 2>/dev/null |
    jq -e --arg id "$BUNDLE_ID" 'any(.[]; .appId == $id)' >/dev/null 2>&1
}

# Prints the first port in the usual range running a Metro that MetaMask is
# attached to, ignoring the port given. Several bundlers on one machine is
# normal — another project's Metro answers `packager-status:running` just as
# readily as ours, and picking it would be worse than finding nothing.
other_metro_serving_metamask() {
  local skip="$1" p
  for p in 8081 8082 8083 8084 8085 8086 8087 8088 8089 8090; do
    [ "$p" = "$skip" ] && continue
    if metro_serves_metamask "$p"; then printf '%s' "$p"; return 0; fi
  done
  return 1
}

port_has_listener() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

check_metro() {
  local port elsewhere held

  port="${MM_AUDIT_METRO_PORT:-$(js_env_watcher_port)}"
  port="${port:-8081}"

  if metro_is_healthy "$port"; then
    METRO_PORT="$port"
    ok "Metro healthy on port $port"
    return
  fi

  # A listener that does not answer /status is usually a watcher still doing a
  # cold build, and a cold build on this project takes minutes. Saying "no
  # Metro" there sends people off to start a second one.
  if port_has_listener "$port"; then
    held="A process is listening on port $port but is not answering as Metro. Either the
watcher is still doing its first bundle — which takes minutes on this project,
so give it time and re-run — or it died and left the port held."
  else
    held="Nothing is listening on port $port. Start the watcher and let it finish its
first bundle:
    yarn watch"
  fi

  if elsewhere="$(other_metro_serving_metamask "$port")"; then
    record_failure "$held

MetaMask is attached to a Metro on port $elsewhere. If that is the watcher you meant to
use, point this run at it:
    MM_AUDIT_METRO_PORT=$elsewhere $0"
    return
  fi

  record_failure "$held

If your watcher runs on another port, name it: MM_AUDIT_METRO_PORT=<port> $0"
}

# ---------------------------------------------------------------------------
# Gate 4 — the app is installed, and is a dev-client build
#
# A release build has no inspector, so Fast Refresh instrumentation and the
# `mm cdp` readout the audit depends on would both be unavailable.
# ---------------------------------------------------------------------------

check_app_installed() {
  local container

  if [ -z "$SIM_UDID" ]; then
    warn "Skipped the install check — there is no unambiguous simulator to check against."
    return 0
  fi

  if ! container="$(xcrun simctl get_app_container "$SIM_UDID" "$BUNDLE_ID" 2>/dev/null)"; then
    record_failure "MetaMask is not installed on $SIM_NAME. Install the latest iOS dev build:
    yarn install:ios:dev"
    return
  fi

  if plutil -extract CFBundleURLTypes json -o - "$container/Info.plist" 2>/dev/null |
      grep -q "$DEV_CLIENT_SCHEME"; then
    ok "MetaMask installed, and it is a dev-client build"
  else
    record_failure "The installed MetaMask does not advertise the $DEV_CLIENT_SCHEME scheme, so it is not
an expo-dev-client build. Metro attach and Hermes CDP need one. Install a dev build:
    yarn install:ios:dev"
  fi
}

# ---------------------------------------------------------------------------
# Gate 5 — the app is running and attached to that Metro
#
# The inspector target list is better evidence than "the process is alive": it
# proves the app is attached to *this* bundler, which is what the counter
# readout actually rides on.
# ---------------------------------------------------------------------------

check_app_attached() {
  local targets elsewhere

  targets="$(curl -fsS --max-time 5 "http://localhost:$METRO_PORT/json/list" 2>/dev/null || true)"

  if [ -n "$targets" ] && printf '%s' "$targets" |
      jq -e --arg id "$BUNDLE_ID" --arg dev "$SIM_NAME" \
        'any(.[]; .appId == $id and .deviceName == $dev)' >/dev/null 2>&1; then
    ok "MetaMask is running on $SIM_NAME and attached to Metro"
    return 0
  fi

  if elsewhere="$(other_metro_serving_metamask "$METRO_PORT")"; then
    die "The Metro on port $METRO_PORT is healthy but MetaMask is not attached to it — it is
attached to the Metro on port $elsewhere instead. Port $METRO_PORT most likely belongs to a
different project. Point this run at the right one:
    MM_AUDIT_METRO_PORT=$elsewhere $0"
  fi

  die "MetaMask is not attached to Metro on port $METRO_PORT as a debuggable target.
Open the app on $SIM_NAME and let it finish loading the bundle, then re-run. A
cold bundle takes minutes, and the app shows no target until it has one.
Targets Metro currently reports:
${targets:-<none>}"
}

# ---------------------------------------------------------------------------
# Gates 6 and 7 — mm can drive the simulator, and the wallet is unlocked
#
# One `describe-screen` answers both. That it returns at all proves the daemon,
# the session and the idb connection to this device are alive; what it returns
# says whether we are looking at a lock screen.
# ---------------------------------------------------------------------------

DESCRIBE_OUT=""

check_mm_session() {
  local status

  set +e
  DESCRIBE_OUT="$(yarn mm describe-screen 2>&1)"
  status=$?
  set -e

  if [ $status -ne 0 ] || printf '%s' "$DESCRIBE_OUT" | grep -q 'no daemon running'; then
    die "mm cannot drive the simulator — no session is attached. Start one:
    yarn mm launch --device-id $SIM_UDID --metro-port $METRO_PORT
Do not pass --reinstall or --reset-app-data; the audit needs your wallet state.
mm said:
$DESCRIBE_OUT"
  fi

  ok "mm session is live and driving $SIM_NAME"
}

check_unlocked() {
  if printf '%s' "$DESCRIBE_OUT" | grep -Eq "$LOCKED_IDS"; then
    die "MetaMask is locked. Unlock it on $SIM_NAME, leave it on the wallet home, and re-run.
This script will not type your password, and an audit driven against a lock
screen measures nothing."
  fi

  if ! printf '%s' "$DESCRIBE_OUT" | grep -Eq "$UNLOCKED_IDS"; then
    die "MetaMask is on a screen this script does not recognise — neither the login screen
nor the wallet home. Bring it to the wallet home on $SIM_NAME and re-run.
Current screen:
$DESCRIBE_OUT"
  fi

  ok "Wallet is unlocked and on a known screen"
}

# ---------------------------------------------------------------------------
# Gate 8 — at least one wallet exists
#
# `globalThis.__AGENTIC__` is the __DEV__-only bridge the app installs once
# navigation is ready (app/dev-tools/AgenticService/AgenticService.ts). Reading
# the account count through it is also the cheapest proof that Hermes CDP works
# at all, which every counter readout in the audit depends on.
# ---------------------------------------------------------------------------

check_wallet_exists() {
  local expr params out count

  # Answer with a sentinel rather than a bare number: `mm cdp` prints the
  # daemon's response envelope, and grepping for a string we chose ourselves is
  # immune to how that envelope is shaped or escaped.
  expr='(function () {
    try {
      var b = globalThis.__AGENTIC__;
      if (!b || typeof b.listAccounts !== "function") return "__MM_NO_BRIDGE__";
      return "__MM_ACCOUNTS__" + b.listAccounts().length;
    } catch (e) {
      return "__MM_THREW__" + String(e && e.message ? e.message : e);
    }
  })()'
  params="$(jq -cn --arg e "$expr" '{expression: $e}')"

  set +e
  out="$(yarn mm cdp Runtime.evaluate "$params" 2>&1)"
  set -e

  if printf '%s' "$out" | grep -q '__MM_NO_BRIDGE__'; then
    die "Hermes answered, but the app has no __AGENTIC__ bridge. That bridge is __DEV__-only
and installs once navigation mounts, so this is either a release build or an app
that has not finished starting. Confirm the build with 'yarn install:ios:dev',
give it a moment, and re-run."
  fi

  if printf '%s' "$out" | grep -q '__MM_THREW__'; then
    die "Reading the account list threw inside the app — the wallet is probably still
initialising. Give it a moment and re-run.
mm cdp said:
$out"
  fi

  count="$(printf '%s' "$out" | grep -oE '__MM_ACCOUNTS__[0-9]+' | grep -oE '[0-9]+$' | head -1)"

  if [ -z "$count" ]; then
    die "Could not read the account count through Hermes CDP. Every counter readout in the
audit uses this same path, so there is nothing to measure with. On Node 20,
export NODE_OPTIONS=--experimental-websocket first.
mm cdp said:
$out"
  fi

  if [ "$count" -lt 1 ]; then
    die "The wallet has no accounts. Onboard one on $SIM_NAME — swaps is unreachable
without an account — then re-run."
  fi

  ok "Wallet has $count account(s)"
}

# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

info "Checking the machine is ready for a swaps performance audit (nothing will be changed)"

# Independent of one another, so evaluate all four and report every failure at
# once. Fixing them is one round of work, not four.
check_toolchain
check_simulator
check_metro
check_app_installed

if [ "$FAILURES" -gt 0 ]; then
  fail "$FAILURES check(s) failed. Fix the above and re-run; nothing further was checked,"
  fail "because everything that follows depends on them."
  exit 1
fi

# Each of these depends on the one before it, so the first failure stops the run.
check_app_attached
check_mm_session
check_unlocked
check_wallet_exists

ok "Ready — start the audit"
printf 'SWAPS_PERF_UDID=%s\n' "$SIM_UDID"
printf 'SWAPS_PERF_METRO_PORT=%s\n' "$METRO_PORT"
