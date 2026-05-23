#!/usr/bin/env bash
set -euo pipefail

TARGET="$PWD"
ARTIFACTS=""
STATIC_ONLY=false
while [ "$#" -gt 0 ]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --artifacts-dir) ARTIFACTS="$2"; shift 2 ;;
    --static-only) STATIC_ONLY=true; shift ;;
    -h|--help) echo "Usage: verify.sh [--target <metamask-mobile>] [--artifacts-dir <dir>] [--static-only]"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

TARGET="$(cd "$TARGET" && pwd)"
HARNESS_DIR="$TARGET/.agent/recipe-harness/mobile"
ARTIFACTS="${ARTIFACTS:-$HARNESS_DIR/verify/$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p "$ARTIFACTS/logs"

status="pass"
checks=()

check_file() {
  local rel="$1"
  if [ -e "$TARGET/$rel" ]; then
    checks+=("{\"name\":\"$rel\",\"status\":\"pass\"}")
  else
    checks+=("{\"name\":\"$rel\",\"status\":\"fail\"}")
    status="fail"
  fi
}

check_file ".agent/recipe-harness/mobile/manifest.json"
check_file "package.json"
check_file "scripts/perps/agentic/validate-recipe.sh"
check_file "scripts/perps/agentic/preflight.sh"
check_file "scripts/perps/agentic/start-metro.sh"
check_file "scripts/perps/agentic/app-state.sh"
check_file "scripts/perps/agentic/screenshot.sh"
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

if node - "$TARGET/package.json" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
const scripts = pkg.scripts || {};
const required = ['a:start', 'a:status', 'a:ios', 'a:android'];
process.exit(required.every((name) => scripts[name]) ? 0 : 1);
NODE
then
  checks+=("{\"name\":\"package a:* ergonomic aliases\",\"status\":\"pass\"}")
else
  checks+=("{\"name\":\"package a:* ergonomic aliases\",\"status\":\"warn\"}")
fi

if [ "$STATIC_ONLY" = false ]; then
  if (
    cd "$TARGET"
    bash scripts/perps/agentic/app-state.sh status
  ) > "$ARTIFACTS/logs/app-state-status.log" 2>&1 && node - "$ARTIFACTS/logs/app-state-status.log" <<'NODE'
const fs = require('fs');
const raw = fs.readFileSync(process.argv[2], 'utf8').trim();
const value = JSON.parse(raw);
if (!value || Array.isArray(value) || !value.route || !value.route.name) process.exit(1);
NODE
  then
    checks+=("{\"name\":\"live app-state status\",\"status\":\"pass\"}")
  else
    checks+=("{\"name\":\"live app-state status\",\"status\":\"fail\"}")
    status="fail"
  fi

  if (
    cd "$TARGET"
    bash scripts/perps/agentic/app-state.sh eval "JSON.stringify({hasAgentic: !!globalThis.__AGENTIC__})"
  ) > "$ARTIFACTS/logs/agentic-bridge.log" 2>&1 && node - "$ARTIFACTS/logs/agentic-bridge.log" <<'NODE'
const fs = require('fs');
const raw = fs.readFileSync(process.argv[2], 'utf8').trim();
let value = JSON.parse(raw);
if (typeof value === 'string') value = JSON.parse(value);
if (!value.hasAgentic) process.exit(1);
NODE
  then
    checks+=("{\"name\":\"live __AGENTIC__ bridge\",\"status\":\"pass\"}")
  else
    checks+=("{\"name\":\"live __AGENTIC__ bridge\",\"status\":\"fail\"}")
    status="fail"
  fi

  if (
    cd "$TARGET"
    bash scripts/perps/agentic/app-state.sh route
  ) > "$ARTIFACTS/logs/route.log" 2>&1 && node - "$ARTIFACTS/logs/route.log" <<'NODE'
const fs = require('fs');
const raw = fs.readFileSync(process.argv[2], 'utf8').trim();
const value = JSON.parse(raw);
if (!value || !value.name) process.exit(1);
NODE
  then
    checks+=("{\"name\":\"live route read\",\"status\":\"pass\"}")
  else
    checks+=("{\"name\":\"live route read\",\"status\":\"fail\"}")
    status="fail"
  fi

  if [ -f "$TARGET/.agent/wallet-fixture.json" ]; then
    if (
      cd "$TARGET"
      bash scripts/perps/agentic/setup-wallet.sh
    ) > "$ARTIFACTS/logs/wallet-setup-unlock.log" 2>&1; then
      checks+=("{\"name\":\"live wallet setup/unlock\",\"status\":\"pass\"}")
    else
      checks+=("{\"name\":\"live wallet setup/unlock\",\"status\":\"fail\"}")
      status="fail"
    fi
  fi

  if (
    cd "$TARGET"
    shot="$(bash scripts/perps/agentic/screenshot.sh recipe-harness-live)"
    cp "$shot" "$ARTIFACTS/screenshot.png"
    echo "$shot"
  ) > "$ARTIFACTS/logs/screenshot.log" 2>&1; then
    checks+=("{\"name\":\"live screenshot capture\",\"status\":\"pass\"}")
  else
    checks+=("{\"name\":\"live screenshot capture\",\"status\":\"fail\"}")
    status="fail"
  fi

  if [ -f "$TARGET/scripts/perps/agentic/teams/perps/recipes/provider-smoke.json" ]; then
    if (
      cd "$TARGET"
      bash scripts/perps/agentic/validate-recipe.sh scripts/perps/agentic/teams/perps/recipes/provider-smoke.json --artifacts-dir "$ARTIFACTS/recipe"
    ) > "$ARTIFACTS/logs/tiny-recipe.log" 2>&1; then
      checks+=("{\"name\":\"live tiny recipe\",\"status\":\"pass\"}")
    else
      checks+=("{\"name\":\"live tiny recipe\",\"status\":\"fail\"}")
      status="fail"
    fi
  fi
fi

node - "$ARTIFACTS" "$status" "${checks[@]}" <<'NODE'
const fs = require('fs');
const path = require('path');
const [artifacts, status, ...checks] = process.argv.slice(2);
const parsedChecks = checks.map((entry) => JSON.parse(entry));
fs.writeFileSync(path.join(artifacts, 'summary.json'), `${JSON.stringify({
  adapter: 'mobile',
  status,
  checks: parsedChecks,
  generatedAt: new Date().toISOString(),
}, null, 2)}\n`);
fs.writeFileSync(path.join(artifacts, 'artifact-manifest.json'), `${JSON.stringify({
  artifacts: fs.readdirSync(artifacts).map((name) => ({ path: name })),
}, null, 2)}\n`);
NODE

echo "Mobile harness verify $status: $ARTIFACTS/summary.json"
[ "$status" = "pass" ]
