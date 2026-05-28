#!/usr/bin/env bash
# validate-recipe.sh — Run a recipe against MetaMask Extension
# Usage: bash validate-recipe.sh <recipe.json> [--dry-run] [--step] [--slow <ms>] [--skip-manual] [--param key=val]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RECIPE="${1:?Usage: validate-recipe.sh <recipe.json> [options]}"
shift

RUNNER_ENV="${RUNNER_ENV:-${SANDBOX_ENV:-$SCRIPT_DIR/.env}}"
if [ -f "$RUNNER_ENV" ]; then
  while IFS= read -r _line || [ -n "$_line" ]; do
    [[ "$_line" =~ ^[[:space:]]*(#|$) ]] && continue
    _line="${_line#export }"
    _key="${_line%%=*}"
    _key="${_key//[[:space:]]/}"
    _val="${_line#*=}"
    _val="${_val#\"}" ; _val="${_val%\"}"
    _val="${_val#\'}" ; _val="${_val%\'}"
    case "$_key" in
      WALLET_PASSWORD|WALLET_FIXTURE|BROWSER|CHROME_BIN|FIREFOX_BIN|EXTENSION_PATH|EXTENSION_ID) ;;
      *) continue ;;
    esac
    [[ -z "${!_key+x}" ]] && export "$_key=$_val"
  done < "$RUNNER_ENV"
  unset _line _key _val
fi

# Prefer the harness-selected extension ID marker when a caller did not pass
# RECIPE_HARNESS_EXTENSION_ID explicitly. This keeps direct recipe runs aligned
# with the preceding harness readiness/verify result when multiple extension IDs
# are open on the same CDP endpoint.
if [ -z "${RECIPE_HARNESS_EXTENSION_ID:-}" ] && [ -f "temp/runtime/extension.id" ]; then
  _extension_id="$(tr -d '[:space:]' < temp/runtime/extension.id)"
  case "$_extension_id" in
    [a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z][a-z]) export RECIPE_HARNESS_EXTENSION_ID="$_extension_id" ;;
  esac
  unset _extension_id
fi

# Make wallet-fixture.json fields available as env tokens (e.g.
# {{env.WALLET_PASSWORD}}) for templated flow input defaults. Existing env wins.
WALLET_FIXTURE="${WALLET_FIXTURE:-$SCRIPT_DIR/../runtime/wallet-fixture.json}"
if [ -z "${WALLET_PASSWORD:-}" ] && [ -f "$WALLET_FIXTURE" ]; then
  if command -v jq >/dev/null 2>&1; then
    _pw="$(jq -r '.password // empty' "$WALLET_FIXTURE" 2>/dev/null || true)"
  else
    _pw="$(node -e "try{const fs=require('fs');const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8')).password||''; if(p) process.stdout.write(p)}catch{}" "$WALLET_FIXTURE")"
  fi
  [ -n "$_pw" ] && export WALLET_PASSWORD="$_pw"
  unset _pw
fi

exec node "$SCRIPT_DIR/validate-recipe.js" --recipe "$RECIPE" "$@"
