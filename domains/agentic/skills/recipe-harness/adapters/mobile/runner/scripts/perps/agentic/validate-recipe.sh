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
if [ -f .js.env ]; then
  while IFS= read -r _line || [ -n "$_line" ]; do
    [[ "$_line" =~ ^[[:space:]]*(#|$) ]] && continue
    _line="${_line#export }"
    _key="${_line%%=*}"
    _key="${_key//[[:space:]]/}"
    _val="${_line#*=}"
    _val="${_val#\"}" ; _val="${_val%\"}"
    _val="${_val#\'}" ; _val="${_val%\'}"
    [[ -n "$_key" && -z "${!_key+x}" ]] && export "$_key=$_val"
  done < .js.env
  unset _line _key _val
fi
export WATCHER_PORT="${WATCHER_PORT:-8081}"

exec node scripts/perps/agentic/validate-recipe.js "$@"
