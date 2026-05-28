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
EXTENSION_ID_FILE="$TARGET/temp/runtime/extension.id"
read_runtime_context_field() {
  local context_path="$1"
  local field="$2"
  [ -f "$context_path" ] || return 1
  node -e '
const fs = require("node:fs");
const [path, field] = process.argv.slice(1);
try {
  const data = JSON.parse(fs.readFileSync(path, "utf8"));
  const value = field.split(".").reduce((node, key) => {
    if (node === undefined || node === null) return undefined;
    return node[key];
  }, data);
  if (value !== undefined && value !== null && value !== "") process.stdout.write(String(value));
} catch (error) {
  process.stderr.write(String(error && error.message ? error.message : error) + "\n");
  process.exitCode = 1;
}
' "$context_path" "$field"
}
refresh_extension_id() {
  if [ -f "$EXTENSION_ID_FILE" ]; then
    RECIPE_HARNESS_EXTENSION_ID="$(tr -d '[:space:]' < "$EXTENSION_ID_FILE")"
    export RECIPE_HARNESS_EXTENSION_ID
  else
    unset RECIPE_HARNESS_EXTENSION_ID || true
  fi
}
CONTEXT_PATH="${RECIPE_RUNTIME_CONTEXT:-$TARGET/temp/runtime/agentic-runtime.json}"
if [ -f "$CONTEXT_PATH" ]; then
  CONTEXT_EXTENSION_ID="$(read_runtime_context_field "$CONTEXT_PATH" extensionId || true)"
  if [[ "$CONTEXT_EXTENSION_ID" =~ ^[a-z]{32}$ ]]; then
    mkdir -p "$(dirname "$EXTENSION_ID_FILE")"
    printf '%s\n' "$CONTEXT_EXTENSION_ID" > "$EXTENSION_ID_FILE"
    RECIPE_HARNESS_EXTENSION_ID="$CONTEXT_EXTENSION_ID"
    export RECIPE_HARNESS_EXTENSION_ID
  else
    refresh_extension_id
  fi
  unset CONTEXT_EXTENSION_ID
else
  refresh_extension_id
fi

status="pass"
checks=()

fixture_status_json() {
  TARGET_FOR_FIXTURE="$TARGET" node <<'NODE'
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const target = process.env.TARGET_FOR_FIXTURE;
const candidates = [
  'temp/runtime/wallet-fixture.json',
  '.agent/wallet-fixture.json',
  'test/e2e/seeder/withFixtures.js',
  'test/e2e/fixtures',
  'fixtures',
].map((rel) => path.join(target, rel));
const found = candidates.find((file) => fs.existsSync(file));
const extensionId = path.join(target, 'temp/runtime/extension.id');
const profileHints = [];
if (fs.existsSync(extensionId)) profileHints.push({ path: 'temp/runtime/extension.id', type: 'extension-id' });
if (!found) {
  console.log(JSON.stringify({
    status: 'MISSING_FIXTURES',
    message: 'Fixture status: MISSING_FIXTURES. This run may depend on an inherited browser/profile state. Prefer a prepared debug profile or fixture seed before spending time repairing state manually.',
    profileHints,
  }));
  process.exit(0);
}
const stat = fs.statSync(found);
const isFile = stat.isFile();
let sha256 = null;
let validJson = null;
if (isFile) {
  const bytes = fs.readFileSync(found);
  sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  if (found.endsWith('.json')) {
    try { JSON.parse(bytes.toString('utf8')); validJson = true; }
    catch { validJson = false; }
  }
}
const rel = path.relative(target, found);
console.log(JSON.stringify({
  status: validJson === false ? 'STALE_OR_INVALID' : 'READY',
  path: rel,
  type: isFile ? 'file' : 'directory',
  sha256,
  modifiedAt: stat.mtime.toISOString(),
  profileHints,
  message: validJson === false
    ? `Fixture status: STALE_OR_INVALID (${rel}). Fix before relying on a clean sandbox.`
    : `Fixture status: READY (${rel}).`,
}));
NODE
}

cdp_holder_json() {
  local port="$1"
  PORT_FOR_STATUS="$port" node <<'NODE'
const cp = require('child_process');
const http = require('http');
const port = process.env.PORT_FOR_STATUS;
function run(cmd) {
  try { return cp.execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
}
function getJson(path) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}${path}`, { timeout: 1000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}
(async () => {
  const pid = run(`lsof -iTCP:${port} -sTCP:LISTEN -t | head -1`);
  const command = pid ? run(`ps -p ${pid} -o command=`) : '';
  const version = await getJson('/json/version');
  const targets = await getJson('/json/list');
  const extensionTargets = Array.isArray(targets)
    ? targets.filter((target) => String(target.url || '').startsWith('chrome-extension://')).length
    : 0;
  console.log(JSON.stringify({
    port,
    listening: Boolean(pid),
    pid: pid || null,
    command: command || null,
    cdpReachable: Boolean(version),
    browser: version?.Browser || null,
    targetCount: Array.isArray(targets) ? targets.length : null,
    extensionTargets,
  }));
})();
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

check_file ".agent/recipe-harness/extension/manifest.json"
check_file "$OUT/validate-recipe.sh"
check_file "$OUT/validate-recipe.js"
check_file "$OUT/lib/workflow.js"

live_mode="static-only"
if [ "$STATIC_ONLY" = false ]; then
  fixture_status_json > "$ARTIFACTS/logs/fixture-status.json"
  node -e 'const fs=require("fs"); const v=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); console.error(v.message || v.status);' "$ARTIFACTS/logs/fixture-status.json"
  checks+=("{\"name\":\"fixture/profile status\",\"status\":\"$(node -e 'const fs=require("fs"); const v=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); console.log(v.status === "READY" ? "pass" : "warn");' "$ARTIFACTS/logs/fixture-status.json")\"}")

  if [ -z "$CDP_PORT" ]; then
    echo "Live extension verify requires --cdp-port. Static checks may pass, but runtime proof is missing." > "$ARTIFACTS/logs/live-missing-cdp.log"
    checks+=("{\"name\":\"live runtime CDP port\",\"status\":\"fail\",\"detail\":\"missing --cdp-port\"}")
    status="fail"
    live_mode="missing-cdp"
  else
    live_mode="live"
    cdp_holder_json "$CDP_PORT" > "$ARTIFACTS/logs/cdp-holder.json"
    if node "$SCRIPT_DIR/extension-readiness.js" --target "$TARGET" --cdp-port "$CDP_PORT" --json > "$ARTIFACTS/logs/extension-readiness.json" 2>&1; then
      checks+=("{\"name\":\"live extension readiness\",\"status\":\"pass\"}")
      # extension-readiness.js may repair temp/runtime/extension.id when the
      # supplied Chrome profile loads a fresh extension ID. Reload it before
      # running recipe smoke checks so the recipe bridge targets the live
      # extension instead of a stale marker from a previous browser profile.
      refresh_extension_id
    else
      checks+=("{\"name\":\"live extension readiness\",\"status\":\"fail\",\"detail\":\"see logs/extension-readiness.json\"}")
      status="fail"
    fi

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
  git -C "$TARGET" status --short -- . ":(exclude).agent/recipe-harness" ":(exclude).skills-cache" ":(exclude)$OUT" > "$ARTIFACTS/logs/product-diff-excluding-harness.log" 2>&1 || true
fi

RECIPE_HARNESS_LIVE_MODE="$live_mode" node - "$ARTIFACTS" "$TARGET" "$status" "${checks[@]}" <<'NODE'
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const [artifacts, target, status, ...checks] = process.argv.slice(2);
const parsedChecks = checks.map((entry) => JSON.parse(entry));
const liveMode = process.env.RECIPE_HARNESS_LIVE_MODE || 'unknown';
let fixtureStatus = null;
let cdpHolder = null;
let readinessReport = null;
try { fixtureStatus = JSON.parse(fs.readFileSync(path.join(artifacts, 'logs/fixture-status.json'), 'utf8')); } catch {}
try { cdpHolder = JSON.parse(fs.readFileSync(path.join(artifacts, 'logs/cdp-holder.json'), 'utf8')); } catch {}
try { readinessReport = JSON.parse(fs.readFileSync(path.join(artifacts, 'logs/extension-readiness.json'), 'utf8')); } catch {}
function runGit(args) {
  try {
    return cp.execFileSync('git', ['-C', target, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    // Git metadata is diagnostic-only; non-git targets still produce a usable verify summary.
    return null;
  }
}
const statusShort = runGit(['status', '--short', '--', '.', ':(exclude).agent/recipe-harness', ':(exclude).skills-cache']);
const gitStatus = {
  branch: runGit(['branch', '--show-current']),
  head: runGit(['rev-parse', '--short', 'HEAD']),
  dirtyCount: statusShort ? statusShort.split('\n').filter(Boolean).length : 0,
  dirtyPreview: statusShort ? statusShort.split('\n').filter(Boolean).slice(0, 25) : [],
};
const readiness = parsedChecks.find((check) => check.name === 'live extension readiness');
const extensionIdPath = path.join(target, 'temp/runtime/extension.id');
let markerExtensionId = null;
try {
  const value = fs.readFileSync(extensionIdPath, 'utf8').trim();
  if (/^[a-z]{32}$/.test(value)) markerExtensionId = value;
} catch {}
const cdpTarget = readinessReport?.cdp ? {
  selectedExtensionId: readinessReport.cdp.selectedExtensionId || null,
  markerExtensionId,
  markerMatched: readinessReport.cdp.markerMatched ?? null,
  markerRepaired: readinessReport.cdp.markerRepaired ?? null,
  extensionIds: readinessReport.cdp.extensionIds || [],
  targetCount: readinessReport.cdp.targetCount ?? null,
  browser: readinessReport.cdp.browser || cdpHolder?.browser || null,
} : null;
const runtimeOwner = liveMode === 'static-only'
  ? 'static-only'
  : liveMode === 'missing-cdp'
    ? 'none'
    : cdpHolder?.cdpReachable
      ? (readiness?.status === 'pass' ? 'compatible-external-or-harness' : 'incompatible-external-or-stale')
      : 'none';
fs.writeFileSync(path.join(artifacts, 'summary.json'), `${JSON.stringify({
  adapter: 'extension',
  status,
  liveMode,
  runtimeClassification: {
    runtimeOwner,
    recipeControllable: readiness?.status === 'pass',
    startedByVerify: false,
  },
  cleanupOwnership: {
    mayStop: false,
    reason: 'extension verify inspects the supplied CDP runtime; wrapper/preflight ownership must be recorded by the caller before stopping processes',
  },
  gitStatus,
  runtimePolicy: {
    runtimeReusePolicy: 'reuse a running harness-compatible CDP target when possible; wrapper auto-start must use a cached/watch-only prepare path unless the human explicitly permits a rebuild',
  },
  fixtureStatus,
  cdpHolder,
  cdpTarget,
  checks: parsedChecks,
  generatedAt: new Date().toISOString(),
}, null, 2)}\n`);
fs.writeFileSync(path.join(artifacts, 'artifact-manifest.json'), `${JSON.stringify({
  artifacts: fs.readdirSync(artifacts).map((name) => ({ path: name })),
}, null, 2)}\n`);
NODE

echo "Extension harness verify $status: $ARTIFACTS/summary.json"
[ "$status" = "pass" ]
