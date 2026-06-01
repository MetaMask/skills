#!/usr/bin/env bash
set -euo pipefail

TARGET="$PWD"
ARTIFACTS=""
STATIC_ONLY=false
AUTO_START="${RECIPE_HARNESS_MOBILE_AUTO_START:-false}"
PLATFORM="${RECIPE_HARNESS_PLATFORM:-${PLATFORM:-ios}}"
PREFLIGHT_MODE="${RECIPE_HARNESS_MOBILE_PREFLIGHT_MODE:-fast}"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --artifacts-dir) ARTIFACTS="$2"; shift 2 ;;
    --static-only) STATIC_ONLY=true; shift ;;
    --platform) PLATFORM="$2"; shift 2 ;;
    --preflight-mode) PREFLIGHT_MODE="$2"; shift 2 ;;
    --auto-start) AUTO_START=true; shift ;;
    --no-auto-start) AUTO_START=false; shift ;;
    -h|--help) echo "Usage: verify.sh [--target <metamask-mobile>] [--artifacts-dir <dir>] [--static-only] [--platform ios|android] [--preflight-mode fast|auto|default|rebuild-native|clean] [--auto-start|--no-auto-start]"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done
case "$PREFLIGHT_MODE" in
  fast|auto|default|rebuild-native|clean) ;;
  *) echo "Unknown --preflight-mode: $PREFLIGHT_MODE" >&2; exit 2 ;;
esac
case "$PLATFORM" in
  ios|android) ;;
  *) echo "Unknown --platform: $PLATFORM (expected ios or android)" >&2; exit 2 ;;
esac

case "$AUTO_START" in
  1|true|TRUE|True|yes|YES|Yes|on|ON|On) AUTO_START=true ;;
  0|false|FALSE|False|no|NO|No|off|OFF|Off|"") AUTO_START=false ;;
  *) echo "Unknown RECIPE_HARNESS_MOBILE_AUTO_START value: $AUTO_START" >&2; exit 2 ;;
esac

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
HARNESS_ROOT="$(harness_root)"
HARNESS_REL="$HARNESS_ROOT/mobile"
HARNESS_DIR="$(harness_dir "$TARGET" mobile)"
RUNNER_BIN="$HARNESS_DIR/runner/bin/metamask-recipe"
ARTIFACTS="${ARTIFACTS:-$HARNESS_DIR/verify/$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p "$ARTIFACTS/logs"

status="pass"
checks=()

add_note() {
  printf '%s\n' "$1" >> "$ARTIFACTS/logs/runtime-notes.txt"
}

fixture_status_json() {
  TARGET_FOR_FIXTURE="$TARGET" node <<'NODE'
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const target = process.env.TARGET_FOR_FIXTURE;
const candidates = [
  '.agent/wallet-fixture.json',
  'scripts/perps/agentic/wallet-fixture.json',
].map((rel) => path.join(target, rel));
const fixture = candidates.find((file) => fs.existsSync(file));
if (!fixture) {
  const example = path.join(target, 'scripts/perps/agentic/wallet-fixture.example.json');
  console.log(JSON.stringify({
    status: 'MISSING_FIXTURES',
    message: 'No wallet fixture found. This run may spend time repairing wallet/perps state manually. For a clean isolated sandbox, create .agent/wallet-fixture.json from scripts/perps/agentic/wallet-fixture.example.json.',
    setupCommand: fs.existsSync(example)
      ? 'cp scripts/perps/agentic/wallet-fixture.example.json .agent/wallet-fixture.json'
      : null,
  }));
  process.exit(0);
}
const fixtureRaw = fs.readFileSync(fixture);
let parsed = null;
let valid = false;
let accountCount = null;
let hasPassword = false;
try {
  parsed = JSON.parse(fixtureRaw.toString('utf8'));
  valid = true;
  accountCount = Array.isArray(parsed.accounts) ? parsed.accounts.length : 0;
  hasPassword = typeof parsed.password === 'string' && parsed.password.length > 0;
} catch {
  valid = false;
}
const stat = fs.statSync(fixture);
console.log(JSON.stringify({
  status: valid && hasPassword && accountCount > 0 ? 'READY' : 'STALE_OR_INVALID',
  path: path.relative(target, fixture),
  sha256: crypto.createHash('sha256').update(fixtureRaw).digest('hex'),
  modifiedAt: stat.mtime.toISOString(),
  accountCount,
  hasPassword,
  message: valid && hasPassword && accountCount > 0
    ? `Fixture status: READY (${path.relative(target, fixture)}, accounts=${accountCount}).`
    : `Fixture status: STALE_OR_INVALID (${path.relative(target, fixture)}). Validate password/accounts before relying on a clean sandbox.`,
}));
NODE
}

port_holder_json() {
  local port="$1"
  PORT_FOR_STATUS="$port" node <<'NODE'
const cp = require('child_process');
const port = process.env.PORT_FOR_STATUS;
function run(cmd) {
  try { return cp.execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
}
const pid = run(`lsof -iTCP:${port} -sTCP:LISTEN -t | head -1`);
let command = '';
// Validate pid is numeric before interpolating it into the `ps -p` shell string.
if (/^[0-9]+$/.test(pid)) command = run(`ps -p ${pid} -o command=`);
console.log(JSON.stringify({
  port,
  listening: Boolean(pid),
  pid: pid || null,
  command: command || null,
  metroStatusReachable: null,
  metroHttpProbeSkipped: true,
  note: 'HTTP /status probing is skipped during live verify because the React Native bridge is the authoritative readiness path for Mobile.',
}));
NODE
}

fixture_check_json() {
  local fixture_status_path="$1"
  node - "$fixture_status_path" <<'NODE'
const fs = require('fs');
const v = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify({
  name: 'fixture status',
  status: v.status === 'READY' ? 'pass' : 'warn',
  detail: v.path || v.status || '',
  message: v.message || v.status,
}));
NODE
}

watcher_port() {
  TARGET_FOR_WATCHER_PORT="$TARGET" node <<'NODE'
const fs = require('fs');
const path = require('path');
const target = process.env.TARGET_FOR_WATCHER_PORT;
let port = process.env.WATCHER_PORT || '8081';
for (const file of ['.js.env', '.env', '.env.local']) {
  const full = path.join(target, file);
  if (!fs.existsSync(full)) continue;
  const text = fs.readFileSync(full, 'utf8');
  const match = text.match(/^\s*(?:export\s+)?WATCHER_PORT=(["']?)([0-9]+)\1/m);
  if (match) { port = match[2]; break; }
}
console.log(port);
NODE
}

# Resolve a runtime env var (e.g. IOS_SIMULATOR, ADB_SERIAL) from the process
# env or the target repo's .js.env so the runner can bind device-scoped proof
# (screenshots) to the same device as the bridge commands.
jsenv_value() {
  TARGET_FOR_JSENV="$TARGET" JSENV_NAME="$1" node <<'NODE'
const fs = require('fs');
const path = require('path');
const target = process.env.TARGET_FOR_JSENV;
const name = process.env.JSENV_NAME;
let value = process.env[name] || '';
if (!value) {
  const re = new RegExp("^\\s*(?:export\\s+)?" + name + "=([\"']?)([^\"'\\n]+)\\1", "m");
  for (const file of ['.js.env', '.env', '.env.local']) {
    const full = path.join(target, file);
    if (!fs.existsSync(full)) continue;
    const match = fs.readFileSync(full, 'utf8').match(re);
    if (match) { value = match[2]; break; }
  }
}
process.stdout.write(value);
NODE
}

check_file() {
  local rel="$1"
  if [ -e "$TARGET/$rel" ]; then
    checks+=("{\"name\":\"$rel\",\"status\":\"pass\"}")
  else
    checks+=("{\"name\":\"$rel\",\"status\":\"fail\"}")
    status="fail"
  fi
}

check_file "$HARNESS_REL/manifest.json"
check_file "$HARNESS_REL/action-manifest.json"
check_file "$HARNESS_REL/runner/bin/metamask-recipe"
check_file "package.json"
check_file "scripts/perps/agentic/cdp-bridge.js"
check_file "app/core/AgenticService/AgenticService.ts"

if ! grep -q "AgenticService.install" "$TARGET/app/core/NavigationService/NavigationService.ts" 2>/dev/null; then
  checks+=("{\"name\":\"NavigationService patch\",\"status\":\"fail\"}")
  status="fail"
else
  checks+=("{\"name\":\"NavigationService patch\",\"status\":\"pass\"}")
fi

if ! grep -q "AgentStepHud" "$TARGET/app/components/Nav/App/App.tsx" 2>/dev/null; then
  checks+=("{\"name\":\"App AgentStepHud patch\",\"status\":\"fail\"}")
  status="fail"
else
  checks+=("{\"name\":\"App AgentStepHud patch\",\"status\":\"pass\"}")
fi

# Drift detection (read-only): a product-owned checkout keeps its own
# app/core/AgenticService source; install never overwrites it. Compare the
# in-repo AgenticService/HUD against the bundled overlay and WARN when the
# branch is behind the skills version, so a stale HUD is visible at verify
# time. Never fails the run and never mutates product source.
overlay_drift_check="$(
  SCRIPT_DIR_FOR_DRIFT="$SCRIPT_DIR" TARGET_FOR_DRIFT="$TARGET" node <<'NODE'
const fs = require('fs');
const path = require('path');
const name = 'agentic overlay matches skills (HUD freshness)';
const overlayDir = path.join(process.env.SCRIPT_DIR_FOR_DRIFT, '..', 'app-overlay', 'app', 'core', 'AgenticService');
const targetDir = path.join(process.env.TARGET_FOR_DRIFT, 'app', 'core', 'AgenticService');
let checked = 0;
const drifted = [];
const missing = [];
try {
  for (const entry of fs.readdirSync(overlayDir)) {
    if (!entry.endsWith('.patch')) continue;
    // install.sh excludes *.test.* from the product copy, so these overlay test
    // files are intentionally absent in the target — skip them or they WARN as
    // spurious "absent in repo" drift on every verify.
    if (/\.test\./u.test(entry)) continue;
    const base = entry.slice(0, -'.patch'.length);
    const targetFile = path.join(targetDir, base);
    if (!fs.existsSync(targetFile)) { missing.push(base); continue; }
    checked += 1;
    if (fs.readFileSync(path.join(overlayDir, entry), 'utf8') !== fs.readFileSync(targetFile, 'utf8')) {
      drifted.push(base);
    }
  }
} catch (error) {
  process.stdout.write(JSON.stringify({ name, status: 'warn', detail: 'overlay compare skipped: ' + String((error && error.message) || error) }));
  process.exit(0);
}
// checked === 0 means the in-repo harness is absent; install/presence checks own that case.
if (checked === 0) {
  process.stdout.write(JSON.stringify({ name, status: 'pass' }));
} else if (drifted.length || missing.length) {
  const parts = [];
  if (drifted.length) parts.push('behind skills: ' + drifted.join(', '));
  if (missing.length) parts.push('absent in repo: ' + missing.join(', '));
  process.stdout.write(JSON.stringify({ name, status: 'warn', detail: parts.join('; ') + ' — merge latest or run recipe-harness install --force-overlay to refresh the in-repo HUD/AgenticService' }));
} else {
  process.stdout.write(JSON.stringify({ name, status: 'pass' }));
}
NODE
)"
checks+=("$overlay_drift_check")

if node - "$TARGET/package.json" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
const scripts = pkg.scripts || {};
const required = ['a:start', 'a:status', 'a:ios', 'a:android'];
const hasRequired = required.every((name) => scripts[name]);
const safeLaunch = String(scripts['a:ios'] || '').includes('--mode fast')
  && String(scripts['a:android'] || '').includes('--mode fast');
process.exit(hasRequired && safeLaunch ? 0 : 1);
NODE
then
  checks+=("{\"name\":\"package a:* ergonomic aliases use fast mode\",\"status\":\"pass\"}")
else
  checks+=("{\"name\":\"package a:* ergonomic aliases use fast mode\",\"status\":\"warn\"}")
fi

run_with_timeout() {
  local log_path="$1"
  local timeout_s="$2"
  shift 2
  [[ "$timeout_s" =~ ^[0-9]+$ ]] || {
    echo "Invalid timeout seconds: $timeout_s" >&2
    return 2
  }
  "$@" > "$log_path" 2>&1 &
  local pid=$!
  local waited=0
  while kill -0 "$pid" 2>/dev/null; do
    if [ "$waited" -ge "$timeout_s" ]; then
      echo "Timed out after ${timeout_s}s: $*" >> "$log_path"
      kill "$pid" 2>/dev/null || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
      return 124
    fi
    sleep 1
    waited=$((waited + 1))
  done
  wait "$pid"
}

live_status_ok() {
  local log_path="$1"
  run_with_timeout "$log_path" 20 bash -lc 'cd "$1" && bash scripts/perps/agentic/app-state.sh status' bash "$TARGET" && node - "$log_path" <<'NODE'
const fs = require('fs');
const raw = fs.readFileSync(process.argv[2], 'utf8').trim();
const start = raw.search(/[\[{]/);
if (start < 0) process.exit(1);
const value = JSON.parse(raw.slice(start));
if (!value || Array.isArray(value) || !value.route || !value.route.name) process.exit(1);
NODE
}

preflight_supports_mode_flag() {
  grep -q -- '--mode)' "$TARGET/scripts/perps/agentic/preflight.sh" 2>/dev/null
}

managed_native_config_hash() {
  (
    cd "$TARGET"
    for rel in package.json tsconfig.json ios/Podfile.lock; do
      if [ -e "$rel" ]; then
        shasum -a 256 "$rel"
      else
        printf 'missing  %s\n' "$rel"
      fi
    done
  )
}

ensure_live_runtime() {
  live_status_ok "$ARTIFACTS/logs/app-state-precheck.log" && return 0
  if [ "$AUTO_START" != true ]; then
    echo "Mobile runtime is not recipe-controllable and auto-start is disabled; use recipe-harness live/launch, pass --auto-start, or set RECIPE_HARNESS_MOBILE_AUTO_START=1 after explicit runtime-start approval." >&2
    return 1
  fi

  echo "Mobile runtime is not recipe-controllable; starting ${PLATFORM} app via harness preflight (--mode ${PREFLIGHT_MODE})..." >&2
  if [ "$PREFLIGHT_MODE" = "fast" ]; then
    if ! preflight_supports_mode_flag; then
      cat >&2 <<'EOF'
Refusing mobile auto-start in fast mode: target scripts/perps/agentic/preflight.sh does not support --mode.
Running it would silently fall back to legacy/default behavior and may mutate package.json,
tsconfig.json, ios/Podfile.lock, Pods, or native build state. Start the app manually or install
a product-owned harness preflight that supports --mode fast.
EOF
      return 1
    fi
    echo "  Build policy: fast reuses an installed matching app or shared cache and fails before a native rebuild." >&2
    echo "  To permit a rebuild, rerun with --preflight-mode auto or RECIPE_HARNESS_MOBILE_PREFLIGHT_MODE=auto after explicit caller/human approval." >&2
  else
    echo "  Build policy: ${PREFLIGHT_MODE} may run native build/setup work; use only after explicit caller/human approval." >&2
  fi
  managed_native_config_hash > "$ARTIFACTS/logs/native-config-before-autostart.sha256"
  preflight_args=(scripts/perps/agentic/preflight.sh --platform "$PLATFORM" --mode "$PREFLIGHT_MODE")
  if [ -f "$TARGET/.agent/wallet-fixture.json" ]; then
    preflight_args+=(--wallet-setup --wallet-fixture .agent/wallet-fixture.json)
  else
    echo "  Fixture status: MISSING_FIXTURES. Starting without wallet setup; state repair may be slower/flakier." >&2
  fi
  if (
    cd "$TARGET"
    EXPO_NO_TYPESCRIPT_SETUP=1 bash "${preflight_args[@]}"
  ) 2>&1 | tee "$ARTIFACTS/logs/auto-start.log"; then
    managed_native_config_hash > "$ARTIFACTS/logs/native-config-after-autostart.sha256"
    if ! cmp -s "$ARTIFACTS/logs/native-config-before-autostart.sha256" "$ARTIFACTS/logs/native-config-after-autostart.sha256"; then
      echo "Mobile auto-start mutated package/native config; refusing to treat runtime as verified. See logs/native-config-*-autostart.sha256." >&2
      return 1
    fi
    : > "$ARTIFACTS/logs/harness-started-runtime"
  else
    managed_native_config_hash > "$ARTIFACTS/logs/native-config-after-autostart.sha256"
    return 1
  fi
}

if [ "$STATIC_ONLY" = false ]; then
  if ensure_live_runtime; then
    checks+=('{"name":"mobile runtime controllable precheck","status":"pass"}')
  else
    checks+=('{"name":"mobile runtime controllable precheck","status":"fail","detail":"see logs/app-state-precheck.log or logs/auto-start.log"}')
    status="fail"
  fi

  fixture_json="$(fixture_status_json)"
  printf '%s\n' "$fixture_json" > "$ARTIFACTS/logs/fixture-status.json"
  fixture_check_json="$(fixture_check_json "$ARTIFACTS/logs/fixture-status.json")"
  fixture_message="$(node -e 'const v=JSON.parse(process.argv[1]); console.log(v.message || v.detail);' "$fixture_check_json")"
  echo "$fixture_message" >&2
  add_note "$fixture_message"
  checks+=("$fixture_check_json")

  port="$(watcher_port)"
  # Reject a non-numeric port before it is interpolated into a shell command
  # (port_holder_json runs `lsof -iTCP:${port}`). The .env path is regex-guarded,
  # but the WATCHER_PORT env path is not, so validate here.
  case "$port" in
    ""|*[!0-9]*) echo "Refusing mobile verify: resolved watcher port is not numeric: '$port' (check WATCHER_PORT)" >&2; exit 2 ;;
  esac
  port_holder_json "$port" > "$ARTIFACTS/logs/port-holder.json"

  cat > "$ARTIFACTS/mobile-v1-live-smoke.recipe.json" <<'JSON'
{
  "schema_version": 1,
  "title": "Mobile v1 runner live bridge smoke",
  "description": "Verifies the installed MetaMask runner can drive the React Native debug bridge without using the legacy recipe graph.",
  "validate": {
    "workflow": {
      "entry": "status",
      "nodes": {
        "status": { "action": "app.status", "next": "cdp-probe" },
        "cdp-probe": { "action": "cdp.target", "required": true, "timeout_ms": 15000, "next": "wallet-setup" },
        "wallet-setup": { "action": "metamask.wallet.setup", "timeout_ms": 45000, "next": "wallet-unlock" },
        "wallet-unlock": { "action": "metamask.wallet.ensure_unlocked", "timeout_ms": 45000, "next": "wallet-read" },
        "wallet-read": { "action": "metamask.wallet.read_state", "timeout_ms": 45000, "next": "navigate-wallet" },
        "navigate-wallet": { "action": "ui.navigate", "route": "WalletView", "timeout_ms": 45000, "next": "wait-wallet" },
        "wait-wallet": { "action": "ui.wait_for", "test_id": "wallet-screen", "expected": "present", "timeout_ms": 45000, "next": "hud-smoke" },
        "hud-smoke": { "action": "app.hud", "status": "running", "intent": "Mobile v1 live bridge smoke", "progress": { "current": 1, "total": 1 }, "timeout_ms": 45000, "next": "screenshot" },
        "screenshot": { "action": "ui.screenshot", "path": "screenshots/mobile-v1-live-smoke.png", "timeout_ms": 45000, "next": "done" },
        "done": { "action": "end", "status": "pass" }
      }
    }
  }
}
JSON

  ios_simulator_resolved="$(jsenv_value IOS_SIMULATOR)"
  adb_serial_resolved="$(jsenv_value ADB_SERIAL)"
  if (
    cd "$TARGET"
    METAMASK_RECIPE_AUTO_HUD=0 \
    IOS_SIMULATOR="${IOS_SIMULATOR:-$ios_simulator_resolved}" \
    ADB_SERIAL="${ADB_SERIAL:-$adb_serial_resolved}" \
    ANDROID_SERIAL="${ANDROID_SERIAL:-$adb_serial_resolved}" \
    "$RUNNER_BIN" run "$ARTIFACTS/mobile-v1-live-smoke.recipe.json" --adapter mobile --project-root "$TARGET" --artifacts-dir "$ARTIFACTS/runner-live-smoke" --json
  ) > "$ARTIFACTS/logs/runner-live-smoke.log" 2>&1; then
    checks+=("{\"name\":\"runner v1 live bridge smoke\",\"status\":\"pass\"}")
  else
    checks+=("{\"name\":\"runner v1 live bridge smoke\",\"status\":\"fail\",\"detail\":\"see logs/runner-live-smoke.log\"}")
    add_note "Runner v1 live bridge smoke failed; inspect logs/runner-live-smoke.log and runner-live-smoke/trace.json."
    status="fail"
  fi
fi

RECIPE_HARNESS_PREFLIGHT_MODE="$PREFLIGHT_MODE" RECIPE_HARNESS_ROOT_EXCLUDE="$HARNESS_ROOT" node - "$ARTIFACTS" "$TARGET" "$status" "${checks[@]}" <<'NODE'
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const [artifacts, target, status, ...checks] = process.argv.slice(2);
const parsedChecks = checks.map((entry) => JSON.parse(entry));
let fixtureStatus = null;
let portHolder = null;
let runtimeNotes = [];
const startedRuntime = fs.existsSync(path.join(artifacts, 'logs/harness-started-runtime'));
try { fixtureStatus = JSON.parse(fs.readFileSync(path.join(artifacts, 'logs/fixture-status.json'), 'utf8')); } catch {}
try { portHolder = JSON.parse(fs.readFileSync(path.join(artifacts, 'logs/port-holder.json'), 'utf8')); } catch {}
try { runtimeNotes = fs.readFileSync(path.join(artifacts, 'logs/runtime-notes.txt'), 'utf8').trim().split('\n').filter(Boolean); } catch {}
function runGit(args) {
  try {
    return cp.execFileSync('git', ['-C', target, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    // Git metadata is diagnostic-only; non-git targets still produce a usable verify summary.
    return null;
  }
}
const harnessRootExclude = process.env.RECIPE_HARNESS_ROOT_EXCLUDE || 'temp/agentic/recipe-harness';
const statusShort = runGit(['status', '--short', '--', '.', `:(exclude)${harnessRootExclude}`, ':(exclude).skills-cache']);
const gitStatus = {
  branch: runGit(['branch', '--show-current']),
  head: runGit(['rev-parse', '--short', 'HEAD']),
  dirtyCount: statusShort ? statusShort.split('\n').filter(Boolean).length : 0,
  dirtyPreview: statusShort ? statusShort.split('\n').filter(Boolean).slice(0, 25) : [],
};
const liveRuntimeCheck = parsedChecks.find((check) => check.name === 'runner v1 live bridge smoke');
const runtimeOwner = !portHolder
  ? 'static-only'
  : startedRuntime
    ? 'harness-owned'
    : portHolder.listening
      ? (liveRuntimeCheck?.status === 'pass' ? 'compatible-external-or-harness' : 'incompatible-external-or-stale')
      : 'none';
const recipeControllable = liveRuntimeCheck?.status === 'pass';
fs.writeFileSync(path.join(artifacts, 'summary.json'), `${JSON.stringify({
  adapter: 'mobile',
  status,
  runtimeClassification: {
    runtimeOwner,
    recipeControllable,
    startedByVerify: startedRuntime,
  },
  cleanupOwnership: {
    mayStop: startedRuntime,
    reason: startedRuntime
      ? 'verify launched the runtime through harness preflight'
      : 'verify did not launch this runtime; do not stop human-owned or pre-existing processes automatically',
  },
  gitStatus,
  runtimePolicy: {
    preflightMode: process.env.RECIPE_HARNESS_PREFLIGHT_MODE || 'fast',
    nativeBuildPolicy: (process.env.RECIPE_HARNESS_PREFLIGHT_MODE || 'fast') === 'fast'
      ? 'fast mode reuses an installed matching app or shared cache and fails before native rebuild; use --preflight-mode auto/default only after explicit approval'
      : 'this mode may run native build/setup work; caller must have recorded explicit approval before using it',
  },
  fixtureStatus,
  portHolder,
  runtimeNotes,
  checks: parsedChecks,
  generatedAt: new Date().toISOString(),
}, null, 2)}\n`);
fs.writeFileSync(path.join(artifacts, 'artifact-manifest.json'), `${JSON.stringify({
  artifacts: fs.readdirSync(artifacts).map((name) => ({ path: name })),
}, null, 2)}\n`);
NODE

echo "Mobile harness verify $status: $ARTIFACTS/summary.json"
[ "$status" = "pass" ]
