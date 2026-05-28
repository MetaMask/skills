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

_has_arg() {
  local needle="$1"
  shift
  local arg
  for arg in "$@"; do
    [ "$arg" = "$needle" ] && return 0
  done
  return 1
}

_runtime_context_field() {
  local context_path="$1"
  local field="$2"
  [ -f "$context_path" ] || return 1
  node -e '
const fs = require("node:fs");
const [path, field] = process.argv.slice(1);
try {
  const value = JSON.parse(fs.readFileSync(path, "utf8"))[field];
  if (value !== undefined && value !== null && value !== "") process.stdout.write(String(value));
} catch (error) {
  process.stderr.write(String(error && error.message ? error.message : error) + "\n");
  process.exitCode = 1;
}
' "$context_path" "$field"
}

# Generic runtime-context contract. Producers such as Farmslot may write
# temp/runtime/agentic-runtime.json; direct recipe runs consume it without
# guessing default CDP ports or probing unrelated slots.
_context_path="${RECIPE_RUNTIME_CONTEXT:-$(pwd)/temp/runtime/agentic-runtime.json}"
if [ -f "$_context_path" ]; then
  export RECIPE_RUNTIME_CONTEXT="$_context_path"
  if [ -z "${RECIPE_SLOT_ID:-}" ]; then
    _slot_id="$(_runtime_context_field "$_context_path" slotId || true)"
    [ -n "$_slot_id" ] && export RECIPE_SLOT_ID="$_slot_id"
    unset _slot_id
  fi
  if [ -z "${RECIPE_RUNTIME_STRICT:-}" ]; then
    _strict="$(_runtime_context_field "$_context_path" strict || true)"
    case "$_strict" in
      true|True|1) export RECIPE_RUNTIME_STRICT=1 ;;
      false|False|0) export RECIPE_RUNTIME_STRICT=0 ;;
    esac
    unset _strict
  fi
  if [ -z "${RECIPE_HARNESS_EXTENSION_ID:-}" ]; then
    _extension_id="$(_runtime_context_field "$_context_path" extensionId || true)"
    [ -n "$_extension_id" ] && export RECIPE_HARNESS_EXTENSION_ID="$_extension_id"
    unset _extension_id
  fi
  if ! _has_arg --cdp-port "$@"; then
    _cdp_port="$(_runtime_context_field "$_context_path" cdpPort || true)"
    if [ -n "$_cdp_port" ]; then
      export RECIPE_CDP_PORT="$_cdp_port"
      export CDP_PORT="$_cdp_port"
    elif [ -z "${CDP_PORT:-}" ] && [ -n "${RECIPE_CDP_PORT:-}" ]; then
      export CDP_PORT="$RECIPE_CDP_PORT"
    fi
    unset _cdp_port
  fi
fi
unset _context_path

if [ -z "${CDP_PORT:-}" ] && [ -n "${RECIPE_CDP_PORT:-}" ] && ! _has_arg --cdp-port "$@"; then
  export CDP_PORT="$RECIPE_CDP_PORT"
fi

# Prefer the harness-selected extension ID marker only when neither the caller nor
# runtime context selected an extension ID. This avoids stale marker reuse when a
# managed slot writes a fresher temp/runtime/agentic-runtime.json.
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
