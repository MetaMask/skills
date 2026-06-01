#!/usr/bin/env bash
set -euo pipefail

TARGET="$PWD"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --out) echo "install does not support --out (it never isolated recipes). Install normally, then pass --out to 'verify'/'live' for task-local recipe artifacts." >&2; exit 2 ;;
    -h|--help) echo "Usage: install.sh [--target <metamask-extension>]"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

dir_content_hash() {
  find "$1" -type f -print0 2>/dev/null | sort -z | xargs -0 shasum -a 256 2>/dev/null | shasum -a 256 | awk '{print $1}'
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADAPTER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SKILL_DIR="$(cd "${ADAPTER_DIR}/../.." && pwd)"
AGENTIC_DIR="$(cd "$SKILL_DIR/../.." && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/path.sh"
# shellcheck disable=SC1091
. "$SKILL_DIR/scripts/resolve-runner-source.sh"
TARGET="$(cd "$TARGET" && pwd)"
resolve_metamask_recipe_runner_source "$SKILL_DIR" "$AGENTIC_DIR" "$TARGET"
HARNESS_ROOT="$(harness_root)"
HARNESS_REL="$HARNESS_ROOT/extension"
HARNESS_DIR="$(harness_dir "$TARGET" extension)"

refuse_symlink_destination() {
  local rel="$1"
  local path_so_far="$TARGET"
  IFS='/' read -r -a parts <<< "$rel"
  for part in "${parts[@]}"; do
    [ -n "$part" ] || continue
    path_so_far="$path_so_far/$part"
    if [ -L "$path_so_far" ]; then
      echo "Refusing extension recipe harness install: $rel contains symlink component $path_so_far." >&2
      return 1
    fi
  done
}

make_executable() {
  local file="$1"
  chmod +x "$file"
  if [ ! -x "$file" ]; then
    echo "Refusing extension recipe harness install: failed to make executable: $file" >&2
    return 1
  fi
}

# refuse_symlink_destination walks every path component, so the deepest paths
# also guard their parents ($HARNESS_REL covers the root segments).
refuse_symlink_destination "$HARNESS_REL"
refuse_symlink_destination "$HARNESS_REL/runner/bin/metamask-recipe"
refuse_symlink_destination "$HARNESS_REL/action-manifest.json"

mkdir -p "$HARNESS_DIR"

rm -rf "$HARNESS_DIR/runner"
mkdir -p "$HARNESS_DIR/runner/bin" "$HARNESS_DIR/runner/manifests" "$HARNESS_DIR/runner/recipes"
# Emit shell-safe lines: %q-quote the interpolated paths (like CLEANUP_COMMAND
# below) so a FARMSLOT_ROOT/runner path containing a space — or $()/backtick/quote
# — cannot break the generated wrapper or inject at runtime.
runner_farmslot_root_q="$(printf '%q' "$METAMASK_RUNNER_FARMSLOT_ROOT")"
runner_exec_q="$(printf '%q' "$METAMASK_RUNNER_DIR/bin/metamask-recipe")"
cat > "$HARNESS_DIR/runner/bin/metamask-recipe" <<EOF
#!/usr/bin/env bash
set -euo pipefail
export FARMSLOT_ROOT=\${FARMSLOT_ROOT:-$runner_farmslot_root_q}
exec $runner_exec_q "\$@"
EOF
printf '%s\n' "$METAMASK_RUNNER_FARMSLOT_ROOT" > "$HARNESS_DIR/runner/.farmslot-root"
printf '%s\n' "$METAMASK_RUNNER_DIR" > "$HARNESS_DIR/runner/.runner-source"
cp "$METAMASK_RUNNER_DIR/manifests/mobile.action-manifest.json" "$HARNESS_DIR/runner/manifests/mobile.action-manifest.json"
cp "$METAMASK_RUNNER_DIR/manifests/extension.action-manifest.json" "$HARNESS_DIR/runner/manifests/extension.action-manifest.json"
if [ -d "$METAMASK_RUNNER_DIR/recipes" ]; then
  rsync -a --delete "$METAMASK_RUNNER_DIR/recipes/" "$HARNESS_DIR/runner/recipes/"
fi
cp "$METAMASK_RUNNER_DIR/manifests/extension.action-manifest.json" "$HARNESS_DIR/action-manifest.json"
make_executable "$HARNESS_DIR/runner/bin/metamask-recipe"
mkdir -p "$HARNESS_DIR/scripts"
rsync -a --delete "$ADAPTER_DIR/scripts/" "$HARNESS_DIR/scripts/"
for executable in "$HARNESS_DIR/scripts/"*.sh "$HARNESS_DIR/scripts/"*.js; do
  [ -e "$executable" ] || continue
  make_executable "$executable"
done
# Co-locate the shared JSON helper (lives in the skill's generic scripts/lib) so the
# installed adapter scripts are self-contained when run from .agent.
mkdir -p "$HARNESS_DIR/scripts/lib"
cp "$SKILL_DIR/scripts/lib/json-field.sh" "$HARNESS_DIR/scripts/lib/json-field.sh"
cp "$SKILL_DIR/scripts/lib/harness-path.sh" "$HARNESS_DIR/scripts/lib/harness-path.sh"
dir_content_hash "$HARNESS_DIR/scripts" > "$HARNESS_DIR/installed-scripts.sha256"

add_git_exclude() {
  local entry="$1"
  local git_dir
  local exclude_file
  if ! git_dir="$(git -C "$TARGET" rev-parse --git-dir 2>/dev/null)"; then
    return 0
  fi
  # Skip if the path is already gitignored (e.g. a temp/-rooted harness under an
  # existing temp/ rule) — no redundant info/exclude entry needed.
  if git -C "$TARGET" check-ignore -q "${entry%/}" 2>/dev/null; then
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
    echo "$entry" >> "$HARNESS_DIR/added-git-exclude"
  fi
}

# "$HARNESS_ROOT/" already covers the active root (the default IS
# temp/agentic/recipe-harness); adding the default literal too would leave a stray
# exclude entry when RECIPE_HARNESS_ROOT is customized, so it is not added here.
add_git_exclude "$HARNESS_ROOT/"
add_git_exclude ".skills-cache/"

SOURCE_REV="$(git -C "$SKILL_DIR" rev-parse HEAD 2>/dev/null || echo unknown)"
# Build the cleanup hint with shell-safe quoting here (target/script paths may
# contain spaces); HARNESS_ROOT is charset-validated so it needs no quoting.
CLEANUP_COMMAND="RECIPE_HARNESS_ROOT=$HARNESS_ROOT $(printf '%q' "$SCRIPT_DIR/cleanup.sh") --target $(printf '%q' "$TARGET")"
node -e '
  const fs = require("fs");
  const m = {
    adapter: "extension",
    installedAt: new Date().toISOString(),
    source: {
      skillDir: process.argv[1],
      skillRevision: process.argv[2],
      runnerDir: process.argv[3],
      runnerRevision: process.argv[4],
      runnerSourceKind: process.argv[5],
      adapterRuntime: process.argv[6]
    },
    target: process.argv[7],
    protocolVersion: "v1",
    actionManifestPath: process.argv[11] + "/action-manifest.json",
    runnerEntrypoint: process.argv[11] + "/runner/bin/metamask-recipe",
    installedPaths: [process.argv[11] + "/scripts", process.argv[11] + "/runner", process.argv[11] + "/action-manifest.json"],
    patchedFiles: [],
    recommendedCommandEnv: { unset: ["BUNDLED_DEBUGPY_PATH"] },
    backupDir: null,
    cleanupCommand: process.argv[12],
    productDiffExcludes: [":(exclude)" + process.argv[10], ":(exclude).skills-cache"]
  };
  fs.writeFileSync(process.argv[9], JSON.stringify(m, null, 2) + "\n");
' "$SKILL_DIR" "$SOURCE_REV" "$METAMASK_RUNNER_DIR" "$METAMASK_RUNNER_REVISION" "$METAMASK_RUNNER_SOURCE_KIND" "$ADAPTER_DIR" "$TARGET" "$SCRIPT_DIR" "$HARNESS_DIR/manifest.json" "$HARNESS_ROOT" "$HARNESS_REL" "$CLEANUP_COMMAND"

echo "Installed extension recipe harness: $HARNESS_DIR/manifest.json"
