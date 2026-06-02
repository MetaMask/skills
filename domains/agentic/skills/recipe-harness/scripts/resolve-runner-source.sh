#!/usr/bin/env bash

DEFAULT_METAMASK_RECIPE_RUNNER_GIT_URL="https://github.com/deeeed/metamask-recipe-runner.git"
DEFAULT_METAMASK_RECIPE_RUNNER_GIT_REF="main"

resolve_metamask_recipe_runner_source() {
  local skill_dir="$1"
  local agentic_dir="$2"
  local target_dir="${3:-}"
  local candidate
  local skill_repo_root=""
  local sibling_runner=""

  if skill_repo_root="$(git -C "$skill_dir" rev-parse --show-toplevel 2>/dev/null)"; then
    sibling_runner="$(dirname "$skill_repo_root")/metamask-recipe-runner"
  fi

  METAMASK_RUNNER_SOURCE_KIND=""
  METAMASK_RUNNER_DIR=""
  METAMASK_RUNNER_FARMSLOT_ROOT=""

  for explicit_var in METAMASK_RECIPE_RUNNER_SOURCE RECIPE_RUNNER_SOURCE METAMASK_RECIPE_RUNNER_PACKAGE_DIR; do
    candidate="${!explicit_var:-}"
    [ -n "$candidate" ] || continue
    if [ ! -d "$candidate" ]; then
      echo "$explicit_var points to a missing MetaMask recipe runner source: $candidate" >&2
      return 1
    fi
    METAMASK_RUNNER_DIR="$(cd "$candidate" && pwd -P)"
    METAMASK_RUNNER_SOURCE_KIND="env:$explicit_var"
    break
  done

  if [ -z "$METAMASK_RUNNER_DIR" ] && ! is_truthy "${METAMASK_RECIPE_RUNNER_SIBLING_DISABLED:-}" && [ -n "$sibling_runner" ] && [ -d "$sibling_runner" ]; then
    METAMASK_RUNNER_DIR="$(cd "$sibling_runner" && pwd -P)"
    METAMASK_RUNNER_SOURCE_KIND="sibling-checkout"
  fi

  if [ -z "$METAMASK_RUNNER_DIR" ]; then
    resolve_cached_metamask_recipe_runner_source
  fi

  for required in \
    "$METAMASK_RUNNER_DIR/package.json" \
    "$METAMASK_RUNNER_DIR/bin/metamask-recipe" \
    "$METAMASK_RUNNER_DIR/manifests/mobile.action-manifest.json" \
    "$METAMASK_RUNNER_DIR/manifests/extension.action-manifest.json"
  do
    if [ ! -e "$required" ]; then
      echo "Invalid MetaMask recipe runner source: missing $required" >&2
      return 1
    fi
  done

  if METAMASK_RUNNER_REVISION="$(git -C "$METAMASK_RUNNER_DIR" rev-parse HEAD 2>/dev/null)"; then
    :
  else
    METAMASK_RUNNER_REVISION="unknown"
  fi
  METAMASK_RUNNER_SKILL_DIR="$(cd "$skill_dir" && pwd -P)"
  METAMASK_RUNNER_FARMSLOT_ROOT="$(resolve_metamask_runner_farmslot_root "$target_dir" "$skill_dir" "$METAMASK_RUNNER_DIR" "$PWD" 2>/dev/null || true)"
  export METAMASK_RUNNER_DIR METAMASK_RUNNER_SOURCE_KIND METAMASK_RUNNER_REVISION METAMASK_RUNNER_SKILL_DIR METAMASK_RUNNER_FARMSLOT_ROOT
}

resolve_cached_metamask_recipe_runner_source() {
  if is_truthy "${METAMASK_RECIPE_RUNNER_GIT_DISABLED:-}"; then
    cat >&2 <<EOF
Missing MetaMask v1 recipe runner source.

Set METAMASK_RECIPE_RUNNER_SOURCE to a runner checkout/package path, provide a
sibling checkout next to metamask-skills, or unset METAMASK_RECIPE_RUNNER_GIT_DISABLED
to allow the public runner fallback.
EOF
    return 1
  fi
  command -v git >/dev/null 2>&1 || { echo "Missing git; cannot fetch MetaMask recipe runner fallback." >&2; return 1; }

  local git_url="${METAMASK_RECIPE_RUNNER_GIT_URL:-$DEFAULT_METAMASK_RECIPE_RUNNER_GIT_URL}"
  local git_ref="${METAMASK_RECIPE_RUNNER_GIT_REF:-$DEFAULT_METAMASK_RECIPE_RUNNER_GIT_REF}"
  local cache_root="${METAMASK_RECIPE_RUNNER_CACHE_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/metamask-skills/recipe-runner}"
  local cache_key repo_dir
  cache_key="$(printf '%s' "$git_url" | git hash-object --stdin)"
  repo_dir="$cache_root/$cache_key"

  mkdir -p "$cache_root"
  if [ -d "$repo_dir/.git" ]; then
    git -C "$repo_dir" fetch --tags --prune origin >/dev/null
  else
    rm -rf "$repo_dir"
    git clone --filter=blob:none "$git_url" "$repo_dir" >/dev/null
  fi
  if git -C "$repo_dir" show-ref --verify --quiet "refs/remotes/origin/$git_ref"; then
    git -C "$repo_dir" checkout --detach -q "origin/$git_ref"
  else
    git -C "$repo_dir" checkout --detach -q "$git_ref"
  fi
  ensure_metamask_recipe_runner_dependencies "$repo_dir"

  METAMASK_RUNNER_DIR="$(cd "$repo_dir" && pwd -P)"
  METAMASK_RUNNER_SOURCE_KIND="git:$git_url#$git_ref"
}

ensure_metamask_recipe_runner_dependencies() {
  local runner_dir="$1"
  [ -f "$runner_dir/package.json" ] || return 0
  if [ -f "$runner_dir/dist/cli.js" ]; then
    return 0
  fi
  if [ -x "$runner_dir/node_modules/.bin/tsx" ] && [ -d "$runner_dir/node_modules/@farmslot/recipe-harness" ]; then
    return 0
  fi
  command -v npm >/dev/null 2>&1 || { echo "Missing npm; cannot install MetaMask recipe runner dependencies in $runner_dir." >&2; return 1; }
  (cd "$runner_dir" && npm install --no-package-lock >/dev/null)
}

is_truthy() {
  case "${1:-}" in
    1|true|TRUE|True|yes|YES|Yes|on|ON|On) return 0 ;;
    *) return 1 ;;
  esac
}

resolve_metamask_runner_farmslot_root() {
  local candidate
  for candidate in "${FARMSLOT_ROOT:-}" "$@"; do
    [ -n "$candidate" ] || continue
    if candidate="$(find_metamask_runner_farmslot_root "$candidate")"; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  cat >&2 <<EOF
Missing optional Farmslot checkout for MetaMask recipe runner local-development fallback.

The published runner resolves @farmslot/* from normal npm dependencies. Set
FARMSLOT_ROOT only when co-developing against a local Farmslot checkout.
EOF
  return 1
}

find_metamask_runner_farmslot_root() {
  local dir="$1"
  [ -d "$dir" ] || return 1
  dir="$(cd "$dir" && pwd -P)"
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/packages/recipe-harness/package.json" ] && [ -f "$dir/packages/protocol/package.json" ]; then
      printf '%s\n' "$dir"
      return 0
    fi
    if [ -f "$dir/farmslot/packages/recipe-harness/package.json" ] && [ -f "$dir/farmslot/packages/protocol/package.json" ]; then
      printf '%s\n' "$dir/farmslot"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  return 1
}
