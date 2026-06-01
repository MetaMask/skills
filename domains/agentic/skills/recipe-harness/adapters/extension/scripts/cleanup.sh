#!/usr/bin/env bash
set -euo pipefail

TARGET="$PWD"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --out) [ "$#" -ge 2 ] || { echo "Missing value for $1" >&2; exit 2; }; shift 2 ;;
    -h|--help) echo "Usage: cleanup.sh [--target <metamask-extension>]"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/path.sh"
TARGET="$(cd "$TARGET" && pwd)"
HARNESS_DIR="$(harness_dir "$TARGET" extension)"

if [ -s "$HARNESS_DIR/added-git-exclude" ]; then
  git_dir="$(git -C "$TARGET" rev-parse --git-dir 2>/dev/null || true)"
  if [ -n "$git_dir" ]; then
    case "$git_dir" in
      /*) ;;
      *) git_dir="$TARGET/$git_dir" ;;
    esac
    exclude_file="$git_dir/info/exclude"
    if [ -f "$exclude_file" ]; then
      # Remove only the lines THIS install recorded, one occurrence per distinct
      # ledger entry (the appended copy is the last match). A pre-existing
      # duplicate copy, or a stale/duplicate ledger entry, must never drop a line
      # we did not add this run.
      tmp_file="$(mktemp)"
      awk '
        NR==FNR { if (length($0)) want[$0]=1; next }
        { lines[++n]=$0; if ($0 in want) last[$0]=n }
        END { for (k in last) drop[last[k]]=1; for (i=1;i<=n;i++) if (!(i in drop)) print lines[i] }
      ' "$HARNESS_DIR/added-git-exclude" "$exclude_file" > "$tmp_file"
      mv "$tmp_file" "$exclude_file"
    fi
  fi
fi

# Leave the consumer's .skills-cache/ alone: it is gitignored and owned by the
# product checkout, not the harness.
rm -rf "$HARNESS_DIR"
echo "Cleaned extension recipe harness from $TARGET"
