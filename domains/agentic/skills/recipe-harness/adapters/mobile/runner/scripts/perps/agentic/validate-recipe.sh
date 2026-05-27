#!/bin/bash
# validate-recipe.sh — Thin wrapper that delegates to the Node.js runner.
#
# Usage:
#   validate-recipe.sh <recipe-folder-or-json> [--dry-run] [--step <id>] [--skip-manual] [--no-hud]
#
# See validate-recipe.js for full documentation.
set -euo pipefail
cd "$(dirname "$0")/../../.."

# Source port config so WATCHER_PORT is in env for cdp-bridge.js.
# shellcheck source=lib/safe-env-parser.sh
. "$(dirname "$0")/lib/safe-env-parser.sh"
load_js_env
export WATCHER_PORT="${WATCHER_PORT:-8081}"

exec node scripts/perps/agentic/validate-recipe.js "$@"
