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

HASH_FILE="$BACKUP_DIR/managed-hashes.tsv"

digest_file() {
  local file="$1"
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" | awk '{print $1}'
  elif command -v openssl >/dev/null 2>&1; then
    openssl dgst -sha256 "$file" | awk '{print $NF}'
  else
    echo "Error: need shasum, sha256sum, or openssl for mobile harness hashing." >&2
    exit 1
  fi
}

digest_stdin() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{print $1}'
  elif command -v openssl >/dev/null 2>&1; then
    openssl dgst -sha256 | awk '{print $NF}'
  else
    echo "Error: need shasum, sha256sum, or openssl for mobile harness hashing." >&2
    exit 1
  fi
}

hash_path() {
  local rel="$1"
  if [ ! -e "$TARGET/$rel" ]; then
    printf 'MISSING'
  elif [ -d "$TARGET/$rel" ]; then
    (
      cd "$TARGET"
      find "$rel" -type f | LC_ALL=C sort | while IFS= read -r file; do
        printf '%s  %s\n' "$(digest_file "$file")" "$file"
      done | digest_stdin
    )
  else
    (cd "$TARGET" && digest_file "$rel")
  fi
}

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

verify_managed_paths_unchanged

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
echo "Cleaned mobile recipe harness from $TARGET"
