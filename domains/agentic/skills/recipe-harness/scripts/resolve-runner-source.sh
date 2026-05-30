#!/usr/bin/env bash

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

  if [ -z "$METAMASK_RUNNER_DIR" ] && [ -n "$sibling_runner" ] && [ -d "$sibling_runner" ]; then
    METAMASK_RUNNER_DIR="$(cd "$sibling_runner" && pwd -P)"
    METAMASK_RUNNER_SOURCE_KIND="sibling-checkout"
  fi

  if [ -z "$METAMASK_RUNNER_DIR" ]; then
    cat >&2 <<EOF
Missing MetaMask v1 recipe runner source.

Set METAMASK_RECIPE_RUNNER_SOURCE to the runner checkout/package path.
For local development, a sibling checkout is auto-discovered when present:
  ${sibling_runner:-<sibling metamask-recipe-runner checkout>}

The skill is only the UX wrapper; it resolves and installs the runner from a
separate project so the skills repo does not own the harness runtime.
EOF
    return 1
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
  METAMASK_RUNNER_FARMSLOT_ROOT="$(resolve_metamask_runner_farmslot_root "$target_dir" "$skill_dir" "$METAMASK_RUNNER_DIR" "$PWD")"
  export METAMASK_RUNNER_DIR METAMASK_RUNNER_SOURCE_KIND METAMASK_RUNNER_REVISION METAMASK_RUNNER_SKILL_DIR METAMASK_RUNNER_FARMSLOT_ROOT
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
Missing Farmslot checkout for MetaMask recipe runner.

Set FARMSLOT_ROOT to the Farmslot checkout that provides @farmslot/recipe-harness.
The installer records that path in runner/.farmslot-root; the runner source no
longer contains user-specific defaults.
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
