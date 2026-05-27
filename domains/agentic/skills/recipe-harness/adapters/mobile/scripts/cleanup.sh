#!/usr/bin/env bash
set -euo pipefail

TARGET="$PWD"
ALLOW_MANAGED_CHANGES=false
while [ "$#" -gt 0 ]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --allow-managed-changes) ALLOW_MANAGED_CHANGES=true; shift ;;
    -h|--help) echo "Usage: cleanup.sh [--target <metamask-mobile>] [--allow-managed-changes]"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$(cd "$TARGET" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib/hash-helpers.sh"
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

remove_git_exclude_entry() {
  local entry="$1"
  local git_dir
  local exclude_file
  if ! git_dir="$(git -C "$TARGET" rev-parse --git-dir 2>/dev/null)"; then
    return 0
  fi
  case "$git_dir" in
    /*) ;;
    *) git_dir="$TARGET/$git_dir" ;;
  esac
  exclude_file="$git_dir/info/exclude"
  [ -f "$exclude_file" ] || return 0
  awk -v entry="$entry" '$0 != entry { print }' "$exclude_file" > "$exclude_file.tmp"
  mv "$exclude_file.tmp" "$exclude_file"
}

if [ ! -f "$STATE_FILE" ]; then
  if [ -f "$HARNESS_DIR/manifest.json" ] && node -e '
    const fs = require("fs");
    const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    process.exit(manifest.installMode === "product-owned" ? 0 : 1);
  ' "$HARNESS_DIR/manifest.json" 2>/dev/null; then
    remove_git_exclude_entry ".agent/recipe-harness/"
    remove_git_exclude_entry ".skills-cache/"
    remove_git_exclude_entry "temp/agentic/recipe-harness/"
    rm -rf "$HARNESS_DIR"
    rm -rf "$TARGET/.skills-cache"
    echo "Cleaned mobile recipe harness metadata from $TARGET (product-owned harness files left untouched)"
    exit 0
  fi
  echo "No mobile harness backup found at $STATE_FILE" >&2
  exit 1
fi

while IFS= read -r _line || [ -n "$_line" ]; do
  [[ "$_line" =~ ^[[:space:]]*(#|$) ]] && continue
  _key="${_line%%=*}"
  _val="${_line#*=}"
  case "$_key" in
    SCRIPTS_EXISTED|AGENTIC_SERVICE_EXISTED|PACKAGE_JSON_EXISTED|NAVIGATION_SERVICE_EXISTED|APP_TSX_EXISTED) ;;
    *) continue ;;
  esac
  export "$_key=$_val"
done < "$STATE_FILE"
unset _line _key _val

HASH_FILE="$BACKUP_DIR/managed-hashes.tsv"

verify_managed_paths_unchanged() {
  if [ ! -f "$HASH_FILE" ]; then
    cat >&2 <<EOF
Refusing cleanup: no managed hash file found at $HASH_FILE.
Re-run mobile harness install from the current skill to refresh safety metadata, or restore manually.
EOF
    exit 1
  fi
  local rel expected actual conflicts=0
  while IFS=$'\t' read -r rel expected; do
    [ -n "$rel" ] || continue
    actual="$(hash_path "$rel")"
    if [ "$actual" != "$expected" ]; then
      echo "Refusing cleanup: managed harness path changed after install: $rel" >&2
      echo "  expected: $expected" >&2
      echo "  actual:   $actual" >&2
      conflicts=1
    fi
  done < "$HASH_FILE"
  if [ "$conflicts" != "0" ]; then
    cat >&2 <<EOF
Cleanup would restore backups over files that changed after harness install.
Save/stash those changes, rerun harness install to refresh managed hashes, or restore manually.
EOF
    exit 1
  fi
}

if [ "$ALLOW_MANAGED_CHANGES" != "true" ]; then
  verify_managed_paths_unchanged
else
  echo "Allowing cleanup over changed managed harness paths."
fi

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
rm -rf "$BACKUP_DIR"
rm -rf "$TARGET/.skills-cache"
echo "Cleaned mobile recipe harness from $TARGET"
