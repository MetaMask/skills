#!/usr/bin/env bash
set -euo pipefail

TARGET="$PWD"
FORCE=false
while [ "$#" -gt 0 ]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --out) [ "$#" -ge 2 ] || { echo "Missing value for $1" >&2; exit 2; }; shift 2 ;;
    --force) FORCE=true; shift ;;
    -h|--help) echo "Usage: install.sh [--target <metamask-extension>] [--force]"; exit 0 ;;
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
HARNESS_DIR="$TARGET/.agent/recipe-harness/extension"

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

refuse_symlink_destination ".agent"
refuse_symlink_destination ".agent/recipe-harness"
refuse_symlink_destination ".agent/recipe-harness/extension"
refuse_symlink_destination ".agent/recipe-harness/extension/runner/bin/metamask-recipe"
refuse_symlink_destination ".agent/recipe-harness/extension/action-manifest.json"

mkdir -p "$HARNESS_DIR"

rsync -a --delete --exclude node_modules --exclude .git "$METAMASK_RUNNER_DIR/" "$HARNESS_DIR/runner/"
printf '%s\n' "$METAMASK_RUNNER_FARMSLOT_ROOT" > "$HARNESS_DIR/runner/.farmslot-root"
cp "$METAMASK_RUNNER_DIR/manifests/extension.action-manifest.json" "$HARNESS_DIR/action-manifest.json"
make_executable "$HARNESS_DIR/runner/bin/metamask-recipe"
mkdir -p "$HARNESS_DIR/scripts"
rsync -a --delete "$ADAPTER_DIR/scripts/" "$HARNESS_DIR/scripts/"
for executable in "$HARNESS_DIR/scripts/"*.sh "$HARNESS_DIR/scripts/"*.js; do
  [ -e "$executable" ] || continue
  make_executable "$executable"
done
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
    echo "$entry" >> "$HARNESS_DIR/added-git-exclude"
  fi
}

add_git_exclude ".agent/recipe-harness/"
add_git_exclude ".skills-cache/"
add_git_exclude "temp/agentic/recipe-harness/"

SOURCE_REV="$(git -C "$SKILL_DIR" rev-parse HEAD 2>/dev/null || echo unknown)"
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
    actionManifestPath: ".agent/recipe-harness/extension/action-manifest.json",
    runnerEntrypoint: ".agent/recipe-harness/extension/runner/bin/metamask-recipe",
    installedPaths: [".agent/recipe-harness/extension/scripts", ".agent/recipe-harness/extension/runner", ".agent/recipe-harness/extension/action-manifest.json"],
    patchedFiles: [],
    recommendedCommandEnv: { unset: ["BUNDLED_DEBUGPY_PATH"] },
    backupDir: null,
    cleanupCommand: process.argv[8] + "/cleanup.sh --target " + process.argv[7],
    productDiffExcludes: [":(exclude).agent/recipe-harness", ":(exclude).skills-cache", ":(exclude)temp/agentic/recipe-harness"]
  };
  fs.writeFileSync(process.argv[9], JSON.stringify(m, null, 2) + "\n");
' "$SKILL_DIR" "$SOURCE_REV" "$METAMASK_RUNNER_DIR" "$METAMASK_RUNNER_REVISION" "$METAMASK_RUNNER_SOURCE_KIND" "$ADAPTER_DIR" "$TARGET" "$SCRIPT_DIR" "$HARNESS_DIR/manifest.json"

echo "Installed extension recipe harness: $HARNESS_DIR/manifest.json"
