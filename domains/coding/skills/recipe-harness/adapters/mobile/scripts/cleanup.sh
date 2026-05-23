#!/usr/bin/env bash
set -euo pipefail

TARGET="$PWD"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    -h|--help) echo "Usage: cleanup.sh [--target <metamask-mobile>]"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

TARGET="$(cd "$TARGET" && pwd)"
HARNESS_DIR="$TARGET/.agent/recipe-harness/mobile"
if GIT_BACKUP_PATH="$(git -C "$TARGET" rev-parse --git-path recipe-harness/mobile/backup 2>/dev/null)"; then
  case "$GIT_BACKUP_PATH" in
    /*) BACKUP_DIR="$GIT_BACKUP_PATH" ;;
    *) BACKUP_DIR="$TARGET/$GIT_BACKUP_PATH" ;;
  esac
else
  BACKUP_DIR="$HARNESS_DIR/backup-store"
fi
if [ ! -f "$BACKUP_DIR/state.env" ] && [ -f "$HARNESS_DIR/backup/state.env" ]; then
  BACKUP_DIR="$HARNESS_DIR/backup"
fi
STATE_FILE="$BACKUP_DIR/state.env"

if [ ! -f "$STATE_FILE" ]; then
  echo "No mobile harness backup found at $STATE_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
. "$STATE_FILE"

restore_path() {
  local rel="$1"
  local existed="$2"
  local target_path="$TARGET/$rel"
  local backup_path="$BACKUP_DIR/$rel"
  if [ "$existed" = "1" ]; then
    if [ ! -e "$backup_path" ]; then
      echo "Missing backup for $rel at $backup_path" >&2
      exit 1
    fi
    rm -rf "$target_path"
    mkdir -p "$(dirname "$target_path")"
    cp -a "$backup_path" "$target_path"
  else
    rm -rf "$target_path"
  fi
}

restore_path "scripts/perps/agentic" "${SCRIPTS_EXISTED:-0}"
restore_path "app/core/AgenticService" "${AGENTIC_SERVICE_EXISTED:-0}"
if [ "${PACKAGE_JSON_EXISTED+x}" = "x" ]; then
  restore_path "package.json" "$PACKAGE_JSON_EXISTED"
fi
restore_path "app/core/NavigationService/NavigationService.ts" "${NAVIGATION_SERVICE_EXISTED:-0}"
restore_path "app/components/Nav/App/App.tsx" "${APP_TSX_EXISTED:-0}"

if [ -f "$BACKUP_DIR/added-git-exclude" ]; then
  git_dir="$(git -C "$TARGET" rev-parse --git-dir 2>/dev/null || true)"
  if [ -n "$git_dir" ]; then
    case "$git_dir" in
      /*) ;;
      *) git_dir="$TARGET/$git_dir" ;;
    esac
    exclude_file="$git_dir/info/exclude"
    if [ -f "$exclude_file" ]; then
      tmp_file="$(mktemp)"
      cp "$exclude_file" "$tmp_file"
      while IFS= read -r entry; do
        [ -n "$entry" ] || continue
        grep -vxF "$entry" "$tmp_file" > "$tmp_file.next" || true
        mv "$tmp_file.next" "$tmp_file"
      done < "$BACKUP_DIR/added-git-exclude"
      mv "$tmp_file" "$exclude_file"
    fi
  fi
fi

rm -rf "$HARNESS_DIR"
echo "Cleaned mobile recipe harness from $TARGET"
