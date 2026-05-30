#!/usr/bin/env bash
set -euo pipefail

TARGET="$PWD"
FORCE=false
while [ "$#" -gt 0 ]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --out) [ "$#" -ge 2 ] || { echo "Missing value for $1" >&2; exit 2; }; shift 2 ;;
    --force) FORCE=true; shift ;;
    -h|--help) echo "Usage: cleanup.sh [--target <metamask-extension>] [--force]"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

dir_content_hash() {
  find "$1" -type f -print0 2>/dev/null | sort -z | xargs -0 shasum -a 256 2>/dev/null | shasum -a 256 | awk '{print $1}'
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/path.sh"
TARGET="$(cd "$TARGET" && pwd)"
HARNESS_DIR="$TARGET/.agent/recipe-harness/extension"

if [ -f "$HARNESS_DIR/added-git-exclude" ]; then
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
      done < "$HARNESS_DIR/added-git-exclude"
      mv "$tmp_file" "$exclude_file"
    fi
  fi
fi

rm -rf "$HARNESS_DIR"
rm -rf "$TARGET/.skills-cache"
echo "Cleaned extension recipe harness from $TARGET"
