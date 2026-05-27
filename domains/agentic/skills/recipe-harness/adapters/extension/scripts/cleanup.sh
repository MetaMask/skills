#!/usr/bin/env bash
set -euo pipefail

TARGET="$PWD"
OUT=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    -h|--help) echo "Usage: cleanup.sh [--target <metamask-extension>] [--out <temp/agentic/recipes>]"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/path.sh"
TARGET="$(cd "$TARGET" && pwd)"
HARNESS_DIR="$TARGET/.agent/recipe-harness/extension"
BACKUP_DIR="$HARNESS_DIR/backup"
STATE_FILE="$BACKUP_DIR/state.env"

if [ -z "$OUT" ]; then
  MANIFEST="$HARNESS_DIR/manifest.json"
  if [ ! -f "$MANIFEST" ]; then
    echo "Missing extension harness manifest; pass --out explicitly for cleanup." >&2
    exit 1
  fi
  OUT="$(node - "$MANIFEST" <<'NODE'
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const installedPath = manifest.installedPaths && manifest.installedPaths[0];
if (!installedPath) process.exit(1);
process.stdout.write(installedPath);
NODE
)"
fi

if ! OUT_ABS="$(resolve_harness_out "$TARGET" "$OUT")"; then
  echo "Refusing extension harness cleanup outside target: $OUT" >&2
  exit 1
fi

if [ ! -f "$STATE_FILE" ]; then
  echo "No extension harness backup found at $STATE_FILE" >&2
  exit 1
fi

while IFS= read -r _line || [ -n "$_line" ]; do
  [[ "$_line" =~ ^[[:space:]]*(#|$) ]] && continue
  _key="${_line%%=*}"
  _val="${_line#*=}"
  case "$_key" in
    OUT_EXISTED) ;;
    *) continue ;;
  esac
  export "$_key=$_val"
done < "$STATE_FILE"
unset _line _key _val

rm -rf "$OUT_ABS"
if [ "${OUT_EXISTED:-0}" = "1" ]; then
  mkdir -p "$(dirname "$OUT_ABS")"
  cp -a "$BACKUP_DIR/original" "$OUT_ABS"
fi

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
rm -rf "$TARGET/.skills-cache"
echo "Cleaned extension recipe harness from $TARGET"
