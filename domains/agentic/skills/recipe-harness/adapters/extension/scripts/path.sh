#!/usr/bin/env bash

# harness_root() / harness_dir() live in the shared lib so both adapters and the
# wrapper share one definition. Source it from the installed co-located copy
# ($SCRIPT_DIR/lib) else the skill-tree canonical (scripts/lib).
_harness_path_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
for _hp in "$_harness_path_dir/lib/harness-path.sh" "$_harness_path_dir/../../../scripts/lib/harness-path.sh"; do
  [ -f "$_hp" ] && { . "$_hp"; break; }
done
unset _hp _harness_path_dir
if ! command -v harness_root >/dev/null 2>&1; then
  echo "recipe-harness: shared lib scripts/lib/harness-path.sh not found; reinstall the harness." >&2
  exit 1
fi

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
