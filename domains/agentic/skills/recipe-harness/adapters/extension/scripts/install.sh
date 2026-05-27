#!/usr/bin/env bash
set -euo pipefail

TARGET="$PWD"
OUT=""
FORCE=false
while [ "$#" -gt 0 ]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --force) FORCE=true; shift ;;
    -h|--help) echo "Usage: install.sh [--target <metamask-extension>] [--out <temp/agentic/recipes>] [--force]"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

dir_content_hash() {
  find "$1" -type f -print0 2>/dev/null | sort -z | xargs -0 shasum -a 256 2>/dev/null | shasum -a 256 | awk '{print $1}'
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADAPTER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SKILL_DIR="$(cd "${ADAPTER_DIR}/../.." && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/path.sh"
TARGET="$(cd "$TARGET" && pwd)"
OUT="${OUT:-temp/agentic/recipes}"
if ! OUT_ABS="$(resolve_harness_out "$TARGET" "$OUT")"; then
  echo "Refusing extension harness --out outside target: $OUT" >&2
  exit 1
fi
HARNESS_DIR="$TARGET/.agent/recipe-harness/extension"
BACKUP_DIR="$HARNESS_DIR/backup"
STATE_FILE="$BACKUP_DIR/state.env"

mkdir -p "$HARNESS_DIR"
if [ ! -f "$STATE_FILE" ]; then
  TMP_BACKUP_DIR="$(mktemp -d "$HARNESS_DIR/backup.tmp.XXXXXX")"
  if [ -e "$OUT_ABS" ]; then
    cp -a "$OUT_ABS" "$TMP_BACKUP_DIR/original"
    echo "OUT_EXISTED=1" > "$TMP_BACKUP_DIR/state.env"
  else
    echo "OUT_EXISTED=0" > "$TMP_BACKUP_DIR/state.env"
  fi
  rm -rf "$BACKUP_DIR"
  mv "$TMP_BACKUP_DIR" "$BACKUP_DIR"
fi

INSTALLED_HASH_FILE="$HARNESS_DIR/installed-content.sha256"
if [ -e "$OUT_ABS" ] && [ -f "$INSTALLED_HASH_FILE" ] && ! $FORCE; then
  prev_hash="$(cat "$INSTALLED_HASH_FILE")"
  curr_hash="$(dir_content_hash "$OUT_ABS")"
  if [ "$prev_hash" != "$curr_hash" ]; then
    echo "Extension harness output has local modifications." >&2
    echo "Re-install would overwrite user edits in: $OUT" >&2
    echo "Use --force to proceed anyway." >&2
    exit 1
  fi
fi

mkdir -p "$(dirname "$OUT_ABS")"
rsync -a --delete "$ADAPTER_DIR/runner/recipes/" "$OUT_ABS/"
chmod +x "$OUT_ABS/validate-recipe.sh" 2>/dev/null || true
dir_content_hash "$OUT_ABS" > "$INSTALLED_HASH_FILE"
mkdir -p "$HARNESS_DIR/scripts"
rsync -a --delete "$ADAPTER_DIR/scripts/" "$HARNESS_DIR/scripts/"
chmod +x "$HARNESS_DIR/scripts/"*.sh "$HARNESS_DIR/scripts/"*.js 2>/dev/null || true
dir_content_hash "$HARNESS_DIR/scripts" > "$HARNESS_DIR/installed-scripts.sha256"

add_git_exclude() {
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
  mkdir -p "$(dirname "$exclude_file")"
  touch "$exclude_file"
  if ! grep -qxF "$entry" "$exclude_file"; then
    echo "$entry" >> "$exclude_file"
    echo "$entry" >> "$BACKUP_DIR/added-git-exclude"
  fi
}

add_git_exclude ".agent/recipe-harness/"
add_git_exclude ".skills-cache/"
add_git_exclude "temp/agentic/recipes/"
add_git_exclude "temp/recipes/"

SOURCE_REV="$(git -C "$SKILL_DIR" rev-parse HEAD 2>/dev/null || echo unknown)"
cat > "$HARNESS_DIR/manifest.json" <<EOF
{
  "adapter": "extension",
  "installedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "source": {
    "skillDir": "$SKILL_DIR",
    "revision": "$SOURCE_REV",
    "runtime": "$ADAPTER_DIR"
  },
  "target": "$TARGET",
  "installedPaths": ["$OUT", ".agent/recipe-harness/extension/scripts"],
  "patchedFiles": [],
  "recommendedCommandEnv": {
    "unset": ["BUNDLED_DEBUGPY_PATH"]
  },
  "backupDir": "$BACKUP_DIR",
  "cleanupCommand": "$SCRIPT_DIR/cleanup.sh --target $TARGET --out $OUT",
  "productDiffExcludes": [
    ":(exclude).agent/recipe-harness",
    ":(exclude).skills-cache",
    ":(exclude)$OUT"
  ]
}
EOF

echo "Installed extension recipe harness: $HARNESS_DIR/manifest.json"
