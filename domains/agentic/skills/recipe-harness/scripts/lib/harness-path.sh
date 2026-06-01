# harness-path.sh — shared, configurable recipe-harness injection root.
# Sourced (not executed) by both adapters and the wrapper so skill + farmslot use
# one definition. Override RECIPE_HARNESS_ROOT (relative to the target repo);
# defaults to temp/agentic/recipe-harness (under the gitignored temp/, so installs
# need no extra git-exclude).
#
# An empty/unset value falls back to the default; a set value is validated
# (relative, safe charset, no '.'/'..' components) so a hostile/typo'd value
# can't make install/cleanup write or rm -rf outside the target, and is safe to
# embed in shell/JSON without quoting surprises.
# Returns non-zero on an invalid value; callers run under `set -e`.
harness_root() {
  local root="${RECIPE_HARNESS_ROOT:-temp/agentic/recipe-harness}"
  case "$root" in
    ""|/*) echo "RECIPE_HARNESS_ROOT must be a non-empty relative path: '$root'" >&2; return 1 ;;
    *[!A-Za-z0-9._/-]*) echo "RECIPE_HARNESS_ROOT may only contain A-Za-z0-9 and . _ / - : '$root'" >&2; return 1 ;;
  esac
  local IFS=/ part
  for part in $root; do
    case "$part" in
      .|..) echo "RECIPE_HARNESS_ROOT must not contain '.' or '..' path components: '$root'" >&2; return 1 ;;
    esac
  done
  printf '%s' "$root"
}

# harness_dir <target> [adapter] -> absolute install dir for the adapter.
harness_dir() {
  printf '%s/%s/%s' "$1" "$(harness_root)" "${2:-extension}"
}
