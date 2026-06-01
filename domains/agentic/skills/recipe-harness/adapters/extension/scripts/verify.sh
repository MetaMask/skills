#!/usr/bin/env bash
set -euo pipefail

TARGET="$PWD"
CDP_PORT=""
ARTIFACTS=""
STATIC_ONLY=false
OUT=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --out) [ "$#" -ge 2 ] || { echo "Missing value for $1" >&2; exit 2; }; OUT="$2"; shift 2 ;;
    --cdp-port) CDP_PORT="$2"; shift 2 ;;
    --artifacts-dir) ARTIFACTS="$2"; shift 2 ;;
    --static-only) STATIC_ONLY=true; shift ;;
    -h|--help) echo "Usage: verify.sh [--target <metamask-extension>] [--out <recipes-dir>] [--cdp-port <port>] [--static-only]"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

# Reject a non-numeric --cdp-port before it is interpolated into shell/HTTP/CDP
# strings. Empty is allowed (static-only verify needs no port).
if [ -n "$CDP_PORT" ]; then
  case "$CDP_PORT" in
    *[!0-9]*) echo "Invalid --cdp-port (must be numeric): $CDP_PORT" >&2; exit 2 ;;
  esac
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/path.sh"
TARGET="$(cd "$TARGET" && pwd)"
HARNESS_ROOT="$(harness_root)"
HARNESS_REL="$HARNESS_ROOT/extension"
HARNESS_DIR="$(harness_dir "$TARGET" extension)"
RUNNER_BIN="$HARNESS_DIR/runner/bin/metamask-recipe"
# --out (optional): a task-local recipes dir. Resolve it safely within the target
# (resolve_harness_out rejects absolute/.. escapes) and prefer its smoke recipe so
# `live --out <dir>` does not silently fall back to the installed default.
SMOKE_RECIPE="$HARNESS_DIR/runner/recipes/smoke.extension.recipe.json"
if [ -n "$OUT" ]; then
  # Fail fast on a task-local --out that does not contain the requested recipe.
  # Silently falling back to the installed default would validate a different
  # (possibly stale) recipe than the caller explicitly asked for.
  OUT_ABS="$(resolve_harness_out "$TARGET" "$OUT" 2>/dev/null || true)"
  if [ -z "$OUT_ABS" ]; then
    echo "recipe-harness verify: --out '$OUT' did not resolve to a safe path under the target." >&2
    exit 2
  fi
  if [ ! -f "$OUT_ABS/smoke.extension.recipe.json" ]; then
    echo "recipe-harness verify: --out '$OUT' (resolved: $OUT_ABS) has no smoke.extension.recipe.json. Refusing to fall back to the installed default recipe; place the recipe under --out or omit --out." >&2
    exit 2
  fi
  SMOKE_RECIPE="$OUT_ABS/smoke.extension.recipe.json"
fi
ARTIFACTS="${ARTIFACTS:-$HARNESS_DIR/verify/$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p "$ARTIFACTS/logs"
EXTENSION_ID_FILE="$TARGET/temp/runtime/extension.id"
# Shared JSON reader: $SCRIPT_DIR/lib when running from the installed copy,
# else the skill-tree canonical at scripts/lib.
# shellcheck disable=SC1091
for _lib in "$SCRIPT_DIR/lib/json-field.sh" "$SCRIPT_DIR/../../../scripts/lib/json-field.sh"; do
  [ -f "$_lib" ] && { . "$_lib"; break; }
done
unset _lib
# Fail fast with an actionable message if neither path loaded (e.g. an install that
# predates the lib co-location), instead of a cryptic later `set -e` abort.
if ! command -v read_runtime_context_field >/dev/null 2>&1; then
  echo "recipe-harness verify: json-field helper missing (scripts/lib/json-field.sh). Reinstall: /recipe-harness extension install --target $TARGET" >&2
  exit 1
fi
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
  if [[ "$CONTEXT_EXTENSION_ID" =~ ^[a-p]{32}$ ]]; then
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
let hasWalletPassword = false;
let mobileAccountShape = false;
const rel = path.relative(target, found);
const isWalletFixture = rel === 'temp/runtime/wallet-fixture.json' || rel === '.agent/wallet-fixture.json';
if (isFile) {
  const bytes = fs.readFileSync(found);
  sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  if (found.endsWith('.json')) {
    try {
      const parsed = JSON.parse(bytes.toString('utf8'));
      validJson = true;
      const accounts = Array.isArray(parsed.accounts) ? parsed.accounts : [];
      hasWalletPassword = typeof parsed.password === 'string' && parsed.password.length > 0;
      mobileAccountShape = accounts.some((account) => account?.type === 'mnemonic') &&
        accounts.filter((account) => account?.type === 'privateKey').length >= 2;
    } catch {
      validJson = false;
    }
  }
}
const status = validJson === false
  ? 'STALE_OR_INVALID'
  : isWalletFixture && hasWalletPassword
    ? 'READY'
    : 'PROFILE_HINTS';
console.log(JSON.stringify({
  status,
  path: rel,
  type: isFile ? 'file' : 'directory',
  sha256,
  modifiedAt: stat.mtime.toISOString(),
  profileHints,
  hasWalletPassword,
  mobileAccountShape,
  message: validJson === false
    ? `Fixture status: STALE_OR_INVALID (${rel}). Fix before relying on a clean sandbox.`
    : status === 'READY'
      ? `Fixture status: READY (${rel}).`
      : `Fixture status: PROFILE_HINTS (${rel}); no Mobile-shaped wallet fixture was found for automatic account parity validation.`,
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
  // Validate pid is numeric before interpolating it into the `ps -p` shell string.
  const safePid = /^[0-9]+$/.test(pid) ? pid : '';
  const command = safePid ? run(`ps -p ${safePid} -o command=`) : '';
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

check_file "$HARNESS_REL/manifest.json"
check_file "$HARNESS_REL/action-manifest.json"
check_file "$HARNESS_REL/runner/bin/metamask-recipe"
check_file "$HARNESS_REL/runner/manifests/extension.action-manifest.json"

# dist-freshness + build-health now come from the runner's single source of
# truth (`runtime-decision`), which subsumes the probes this skill used to
# hand-roll — so the dist-id/source-dirty + webpack-log logic lives in ONE place
# (matching farmslot preflight's algorithm) and the three layers cannot disagree.
# git/fs only (no --cdp-port) so this stays harness-independent. The derived
# dist-freshness.json / build-health.json keep the same status vocab the case
# mappings + summary below already consume, so behavior is unchanged.
"$RUNNER_BIN" runtime-decision --adapter extension --target "$TARGET" --json \
  > "$ARTIFACTS/logs/runtime-decision.json" 2>/dev/null \
  || printf '%s' '{}' > "$ARTIFACTS/logs/runtime-decision.json"
# Surface an empty/{} decision loudly: without it, dist-freshness/build-health
# silently degrade to WARN and the runtime-proof gate is effectively bypassed.
if [ ! -s "$ARTIFACTS/logs/runtime-decision.json" ] || [ "$(cat "$ARTIFACTS/logs/runtime-decision.json")" = "{}" ]; then
  echo "recipe-harness verify: runtime-decision returned empty/{} — dist-freshness and build-health cannot be derived from the runner and will degrade to WARN (runtime-proof gate NOT fully validated). Check the runner/build state." >&2
fi
node -e '
const fs = require("fs");
const dir = process.argv[1];
let r = {};
try { r = JSON.parse(fs.readFileSync(dir + "/runtime-decision.json", "utf8")); } catch {}
const c = r.checks || {};
const dist = c.dist || { status: "unknown" };
const distMsg = dist.status === "fresh" ? "dist id matches HEAD; no uncommitted source."
  : dist.status === "stale" ? (dist.reason === "uncommitted-source"
      ? ((dist.modified ? dist.modified.length : "some") + " uncommitted source file(s); rebuild or commit.")
      : ("dist id " + (dist.distGitId || "?") + " != HEAD " + (dist.head || "?") + "; rebuild."))
  : dist.status === "no-build" ? "no dist/chrome build."
  : "no git id in dist or not a git checkout; cannot prove parity.";
fs.writeFileSync(dir + "/dist-freshness.json", JSON.stringify({ ...dist, message: distMsg }));
const bl = c.buildLog || { status: "unknown" };
const blMsg = bl.status === "ok" ? "webpack compiled."
  : bl.status === "no-watch" ? "no webpack watch log; build-health n/a (e.g. one-shot build)."
  : bl.status === "building" ? "webpack has not reported a successful compile yet."
  : bl.status === "errors" ? (bl.reason === "stale-cache"
      ? "webpack build failing on a stale cache (ENOENT on a deduped module). Run `recipe-harness extension live --cdp-port <port> --start-watch` to auto-clear the cache and rebuild."
      : "webpack build has errors; fix the source/build before validating.")
  : "build-health unknown.";
fs.writeFileSync(dir + "/build-health.json", JSON.stringify({ status: bl.status, reason: bl.reason, excerpt: bl.excerpt, message: blMsg }));
' "$ARTIFACTS/logs" 2>/dev/null \
  || { printf '%s' '{"status":"unknown","message":"dist-freshness probe error"}' > "$ARTIFACTS/logs/dist-freshness.json"; printf '%s' '{"status":"unknown","message":"build-health probe error"}' > "$ARTIFACTS/logs/build-health.json"; }
df_read() { node -e 'const fs=require("fs");try{const v=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(String(v[process.argv[2]]??""))}catch{process.stdout.write("")}' "$ARTIFACTS/logs/dist-freshness.json" "$1"; }
df_status="$(df_read status)"
echo "dist-freshness: ${df_status:-unknown} — $(df_read message)" >&2
case "$df_status" in
  fresh) checks+=("{\"name\":\"dist-freshness\",\"status\":\"pass\"}") ;;
  stale)
    # A stale dist only fails a LIVE verify (runtime proof would use the wrong
    # build). --static-only checks install/idempotency shape, not runtime, so
    # there it is a warning — don't regress install-only verification.
    if [ "$STATIC_ONLY" = false ]; then
      checks+=("{\"name\":\"dist-freshness\",\"status\":\"fail\",\"detail\":\"see logs/dist-freshness.json\"}"); status="fail"
    else
      checks+=("{\"name\":\"dist-freshness\",\"status\":\"warn\",\"detail\":\"stale (static-only); see logs/dist-freshness.json\"}")
    fi
    ;;
  *)     checks+=("{\"name\":\"dist-freshness\",\"status\":\"warn\",\"detail\":\"${df_status:-unknown}; see logs/dist-freshness.json\"}") ;;
esac

# build-health.json was produced by the runtime-decision derivation above (the
# runner reads the webpack watch log; same status vocab as before).
bh_read() { node -e 'const fs=require("fs");try{process.stdout.write(String(JSON.parse(fs.readFileSync(process.argv[1],"utf8"))[process.argv[2]]??""))}catch{process.stdout.write("")}' "$ARTIFACTS/logs/build-health.json" "$1"; }
bh_status="$(bh_read status)"
echo "build-health: ${bh_status:-unknown} — $(bh_read message)" >&2
case "$bh_status" in
  ok|no-watch) checks+=("{\"name\":\"build-health\",\"status\":\"pass\"}") ;;
  errors)
    # A broken build only fails a LIVE verify; in --static-only (install-shape only)
    # it is a loud warning so install/idempotency checks aren't regressed.
    if [ "$STATIC_ONLY" = false ]; then
      checks+=("{\"name\":\"build-health\",\"status\":\"fail\",\"detail\":\"see logs/build-health.json\"}"); status="fail"
    else
      checks+=("{\"name\":\"build-health\",\"status\":\"warn\",\"detail\":\"build errors (static-only); see logs/build-health.json\"}")
    fi
    ;;
  building) checks+=("{\"name\":\"build-health\",\"status\":\"warn\",\"detail\":\"still compiling; see logs/build-health.json\"}") ;;
  *)        checks+=("{\"name\":\"build-health\",\"status\":\"warn\",\"detail\":\"${bh_status:-unknown}; see logs/build-health.json\"}") ;;
esac

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
      "$RUNNER_BIN" manifest --adapter extension --json
    ) > "$ARTIFACTS/logs/runner-manifest.json" 2> "$ARTIFACTS/logs/runner-manifest.err"; then
      checks+=("{\"name\":\"runner manifest\",\"status\":\"pass\"}")
    else
      checks+=("{\"name\":\"runner manifest\",\"status\":\"fail\",\"detail\":\"see logs/runner-manifest.err\"}")
      status="fail"
    fi

    if (
      cd "$TARGET"
      "$RUNNER_BIN" run "$SMOKE_RECIPE" --adapter extension --project-root "$TARGET" --cdp-port "$CDP_PORT" --artifacts-dir "$ARTIFACTS/runner-smoke" --json
    ) > "$ARTIFACTS/logs/runner-smoke.log" 2>&1; then
      checks+=("{\"name\":\"runner v1 smoke\",\"status\":\"pass\"}")
    else
      checks+=("{\"name\":\"runner v1 smoke\",\"status\":\"fail\",\"detail\":\"see logs/runner-smoke.log\"}")
      status="fail"
    fi
  fi
fi

if git -C "$TARGET" rev-parse --git-dir >/dev/null 2>&1; then
  git -C "$TARGET" status --short -- . ":(exclude)$HARNESS_ROOT" ":(exclude).skills-cache" > "$ARTIFACTS/logs/product-diff-excluding-harness.log" 2>&1 || true
fi

RECIPE_HARNESS_LIVE_MODE="$live_mode" RECIPE_HARNESS_ROOT_EXCLUDE="$HARNESS_ROOT" node - "$ARTIFACTS" "$TARGET" "$status" "${checks[@]}" <<'NODE'
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const [artifacts, target, status, ...checks] = process.argv.slice(2);
const parsedChecks = checks.map((entry) => JSON.parse(entry));
const liveMode = process.env.RECIPE_HARNESS_LIVE_MODE || 'unknown';
let fixtureStatus = null;
let cdpHolder = null;
let readinessReport = null;
let distFreshness = null;
try { distFreshness = JSON.parse(fs.readFileSync(path.join(artifacts, 'logs/dist-freshness.json'), 'utf8')); } catch {}
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
const harnessRootExclude = process.env.RECIPE_HARNESS_ROOT_EXCLUDE || 'temp/agentic/recipe-harness';
const statusShort = runGit(['status', '--short', '--', '.', `:(exclude)${harnessRootExclude}`, ':(exclude).skills-cache']);
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
  if (/^[a-p]{32}$/.test(value)) markerExtensionId = value;
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
  distFreshness,
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
