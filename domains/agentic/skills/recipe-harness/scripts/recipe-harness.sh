#!/usr/bin/env bash
# Backward-compatible low-level dispatcher. Prefer scripts/recipe-harness for human use.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: recipe-harness.sh <mobile|extension> <install|launch|live|verify|cleanup> [args]

Examples:
  recipe-harness.sh mobile install --target /path/to/metamask-mobile
  recipe-harness.sh mobile launch --target /path/to/metamask-mobile --platform ios --preflight-mode fast
  recipe-harness.sh mobile live --target /path/to/metamask-mobile --platform ios --preflight-mode fast
  recipe-harness.sh mobile verify --target /path/to/metamask-mobile --no-auto-start
  recipe-harness.sh extension install --target /path/to/metamask-extension
  recipe-harness.sh extension launch --target /path/to/metamask-extension --cdp-port <port>
  recipe-harness.sh extension live --target /path/to/metamask-extension --cdp-port <port> --launch-existing-dist
  recipe-harness.sh extension verify --target /path/to/metamask-extension --cdp-port <port>
  recipe-harness.sh extension verify --target /path/to/metamask-extension --static-only
EOF
}


if [ "$#" -lt 2 ]; then
  usage >&2
  exit 2
fi

ADAPTER="$1"
ACTION="$2"
shift 2

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib/cli-common.sh"
SKILL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ADAPTER_SCRIPT="${SKILL_DIR}/adapters/${ADAPTER}/scripts/${ACTION}.sh"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib/json-field.sh"

if ! valid_adapter_action "$ADAPTER" "$ACTION"; then
  usage >&2
  exit 2
fi

if [ ! -x "$ADAPTER_SCRIPT" ]; then
  echo "Missing adapter script: $ADAPTER_SCRIPT" >&2
  exit 1
fi

if [ "$ADAPTER" = "extension" ] && [ "$ACTION" != "install" ] && [ "$ACTION" != "cleanup" ]; then
  TARGET="$(arg_value --target "$@" || true)"
  TARGET="${TARGET:-$(pwd)}"
  if [ -d "$TARGET" ]; then
    TARGET="$(cd "$TARGET" && pwd -P)"
  fi

  CONTEXT_PATH="${RECIPE_RUNTIME_CONTEXT:-$TARGET/temp/runtime/agentic-runtime.json}"
  if [ -f "$CONTEXT_PATH" ]; then
    export RECIPE_RUNTIME_CONTEXT="$CONTEXT_PATH"
    if [ -z "${RECIPE_SLOT_ID:-}" ]; then
      RECIPE_SLOT_ID="$(read_runtime_context_field "$CONTEXT_PATH" slotId || true)"
      [ -n "$RECIPE_SLOT_ID" ] && export RECIPE_SLOT_ID
    fi
    if [ -z "${RECIPE_RUNTIME_STRICT:-}" ]; then
      _strict="$(read_runtime_context_field "$CONTEXT_PATH" strict || true)"
      case "$_strict" in
        true|True|1) export RECIPE_RUNTIME_STRICT=1 ;;
        false|False|0) export RECIPE_RUNTIME_STRICT=0 ;;
      esac
      unset _strict
    fi
    if [ -z "${RECIPE_HARNESS_EXTENSION_ID:-}" ]; then
      _extension_id="$(read_runtime_context_field "$CONTEXT_PATH" extensionId || true)"
      [ -n "$_extension_id" ] && export RECIPE_HARNESS_EXTENSION_ID="$_extension_id"
      unset _extension_id
    fi
    if [ -z "${RECIPE_RUNTIME_START_APPROVED:-}" ]; then
      _runtime_start_approved="$(read_runtime_context_field "$CONTEXT_PATH" runtimeStart.approved || true)"
      case "$_runtime_start_approved" in
        true|True|1) export RECIPE_RUNTIME_START_APPROVED=1 ;;
        false|False|0) export RECIPE_RUNTIME_START_APPROVED=0 ;;
      esac
      unset _runtime_start_approved
    fi
    if [ -z "${RECIPE_RUNTIME_START_CMD:-}" ]; then
      _runtime_start_cmd="$(read_runtime_context_field "$CONTEXT_PATH" runtimeStart.command || true)"
      [ -n "$_runtime_start_cmd" ] && export RECIPE_RUNTIME_START_CMD="$_runtime_start_cmd"
      unset _runtime_start_cmd
    fi
    if [ -z "${RECIPE_RUNTIME_READY_URL:-}" ]; then
      _runtime_ready_url="$(read_runtime_context_field "$CONTEXT_PATH" runtimeStart.readyUrl || true)"
      [ -n "$_runtime_ready_url" ] && export RECIPE_RUNTIME_READY_URL="$_runtime_ready_url"
      unset _runtime_ready_url
    fi
  fi

  if ! has_arg --cdp-port "$@"; then
    CONTEXT_CDP_PORT=""
    if [ -f "$CONTEXT_PATH" ]; then
      CONTEXT_CDP_PORT="$(read_runtime_context_field "$CONTEXT_PATH" cdpPort || true)"
    fi
    CONTEXT_CDP_PORT="${CONTEXT_CDP_PORT:-${RECIPE_CDP_PORT:-${CDP_PORT:-}}}"
    if [ -n "$CONTEXT_CDP_PORT" ]; then
      export RECIPE_CDP_PORT="$CONTEXT_CDP_PORT"
      export CDP_PORT="$CONTEXT_CDP_PORT"
      set -- "$@" --cdp-port "$CONTEXT_CDP_PORT"
    fi
  fi

  if { [ "$ACTION" = "launch" ] || [ "$ACTION" = "live" ]; } && ! has_arg --prepare-cmd "$@"; then
    if [ "${RECIPE_RUNTIME_START_APPROVED:-0}" = "1" ] && [ -n "${RECIPE_RUNTIME_START_CMD:-}" ]; then
      set -- "$@" --prepare-cmd "$RECIPE_RUNTIME_START_CMD"
    fi
  fi
fi

exec "$ADAPTER_SCRIPT" "$@"
