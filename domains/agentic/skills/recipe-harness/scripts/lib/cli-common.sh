#!/usr/bin/env bash
# Shared helpers for recipe-harness entrypoints.

valid_adapter_action() {
  case "${1:-}:${2:-}" in
    mobile:install|mobile:launch|mobile:live|mobile:verify|mobile:cleanup|extension:install|extension:launch|extension:live|extension:verify|extension:cleanup) return 0 ;;
    *) return 1 ;;
  esac
}

has_arg() {
  local needle="$1"
  shift
  local arg
  for arg in "$@"; do
    [ "$arg" = "$needle" ] && return 0
    case "$arg" in "$needle="*) return 0 ;; esac
  done
  return 1
}

arg_value() {
  local needle="$1"
  shift
  while [ "$#" -gt 0 ]; do
    case "$1" in
      "$needle") [ "$#" -ge 2 ] && printf '%s\n' "$2"; return 0 ;;
      "$needle"=*) printf '%s\n' "${1#*=}"; return 0 ;;
    esac
    shift
  done
  return 1
}

is_false() {
  case "${1:-}" in
    0|false|FALSE|False|no|NO|No|off|OFF|Off) return 0 ;;
    *) return 1 ;;
  esac
}

cdp_reachable() {
  local port="$1"
  command -v curl >/dev/null 2>&1 || return 1
  curl -fsS --max-time 1 "http://127.0.0.1:${port}/json/version" >/dev/null 2>&1
}

detect_adapter() {
  local target="$1"
  local remote=""
  remote="$(git -C "$target" config --get remote.origin.url 2>/dev/null || true)"
  case "$remote" in
    *metamask-extension*) printf 'extension\n'; return 0 ;;
    *metamask-mobile*) printf 'mobile\n'; return 0 ;;
  esac

  if [ -f "$target/development/skills-sync.ts" ] || { [ -d "$target/ui" ] && [ -d "$target/app/scripts" ]; }; then
    printf 'extension\n'
    return 0
  fi
  if [ -f "$target/scripts/skills-sync.mts" ] || { [ -d "$target/ios" ] && [ -d "$target/android" ] && [ -d "$target/app/core" ]; }; then
    printf 'mobile\n'
    return 0
  fi
  return 1
}
