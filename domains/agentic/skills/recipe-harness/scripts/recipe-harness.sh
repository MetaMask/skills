#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: recipe-harness.sh <mobile|extension> <install|launch|live|verify|cleanup> [args]

Examples:
  recipe-harness.sh mobile install --target /path/to/metamask-mobile
  recipe-harness.sh mobile launch --target /path/to/metamask-mobile --platform ios --preflight-mode fast
  recipe-harness.sh mobile live --target /path/to/metamask-mobile --platform ios --preflight-mode fast
  recipe-harness.sh mobile verify --target /path/to/metamask-mobile --no-auto-start
  recipe-harness.sh extension install --target /path/to/metamask-extension
  recipe-harness.sh extension launch --target /path/to/metamask-extension --cdp-port 9222
  recipe-harness.sh extension live --target /path/to/metamask-extension --cdp-port 9222 --launch-existing-dist
  recipe-harness.sh extension verify --target /path/to/metamask-extension --cdp-port 9222
  recipe-harness.sh extension verify --target /path/to/metamask-extension --static-only
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
  mobile:install|mobile:launch|mobile:live|mobile:verify|mobile:cleanup|extension:install|extension:launch|extension:live|extension:verify|extension:cleanup) ;;
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
