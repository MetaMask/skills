#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: recipe-harness.sh <mobile|extension> <install|verify|cleanup> [args]

Examples:
  recipe-harness.sh mobile install --target /path/to/metamask-mobile
  recipe-harness.sh mobile verify --target /path/to/metamask-mobile
  recipe-harness.sh extension install --target /path/to/metamask-extension
  recipe-harness.sh extension verify --target /path/to/metamask-extension --cdp-port 9222
EOF
}

if [ "$#" -lt 2 ]; then
  usage >&2
  exit 2
fi

ADAPTER="$1"
ACTION="$2"
shift 2

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ADAPTER_SCRIPT="${SKILL_DIR}/adapters/${ADAPTER}/scripts/${ACTION}.sh"

case "${ADAPTER}:${ACTION}" in
  mobile:install|mobile:verify|mobile:cleanup|extension:install|extension:verify|extension:cleanup) ;;
  *)
    usage >&2
    exit 2
    ;;
esac

if [ ! -x "$ADAPTER_SCRIPT" ]; then
  echo "Missing adapter script: $ADAPTER_SCRIPT" >&2
  exit 1
fi

exec "$ADAPTER_SCRIPT" "$@"
