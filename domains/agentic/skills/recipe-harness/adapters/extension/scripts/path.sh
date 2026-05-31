#!/usr/bin/env bash

# Parameterized harness injection root so the skill and farmslot share one
# configurable location instead of scattered literals. Override RECIPE_HARNESS_ROOT
# (a path relative to the target repo); defaults to .agent/recipe-harness.
# Validated (non-empty, relative, no '.'/'..' components, no control chars) so a
# hostile/typo'd value can't make install/cleanup write or rm -rf outside the target.
# Returns non-zero on an invalid value; callers run under `set -e`.
harness_root() {
  local root="${RECIPE_HARNESS_ROOT:-.agent/recipe-harness}"
  case "$root" in
    ""|/*) echo "RECIPE_HARNESS_ROOT must be a non-empty relative path: '$root'" >&2; return 1 ;;
    # Restrict to a safe charset (letters, digits, . _ / -). Rejects spaces, quotes,
    # control chars, and shell metacharacters so the value is safe to embed in the
    # manifest cleanupCommand and shell paths without quoting surprises.
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

resolve_harness_out() {
  local target="$1"
  local out="$2"
  node - "$target" "$out" <<'NODE'
const path = require('path');

const target = path.resolve(process.argv[2]);
const out = process.argv[3];
if (!out) process.exit(1);
if (out.split(/[\\/]+/).includes('..')) process.exit(1);

const resolved = path.resolve(target, out);
const relative = path.relative(target, resolved);
if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
  process.exit(1);
}

process.stdout.write(resolved);
NODE
}
