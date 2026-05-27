#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

tmpdir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmpdir"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_extension_verify_does_not_autostart_by_default() {
  local target="$tmpdir/fake-extension"
  local sentinel="$tmpdir/extension-autostart-ran"
  mkdir -p "$target"

  set +e
  RECIPE_HARNESS_EXTENSION_LAUNCH_CMD="touch '$sentinel'" \
    "$SKILL_DIR/scripts/recipe-harness" \
      --adapter extension \
      --target "$target" \
      verify \
      --cdp-port 9 \
      >/tmp/recipe-harness-extension-no-autostart.log 2>&1
  local rc=$?
  set -e

  [ "$rc" -ne 0 ] || fail "fake extension verify unexpectedly passed"
  [ ! -e "$sentinel" ] || fail "extension verify auto-started despite built-in no-start policy"
}

assert_mobile_check_only_exits_before_wallet_reset() {
  local preflight="$SKILL_DIR/adapters/mobile/runner/scripts/perps/agentic/preflight.sh"
  node - "$preflight" <<'NODE'
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
const guard = src.indexOf('# --check-only is read-only: probes above fail loud on mismatch; it must');
const reset = src.indexOf('# Reset app data for deterministic fixture wallet setup');
if (guard === -1 || reset === -1 || guard > reset) {
  throw new Error('check-only guard must appear before wallet/app data reset');
}
const between = src.slice(guard, reset);
if (!between.includes('if $CHECK_ONLY; then') || !between.includes('exit 0')) {
  throw new Error('check-only guard must exit before reset block');
}
NODE
}

assert_extension_verify_does_not_autostart_by_default
assert_mobile_check_only_exits_before_wallet_reset

echo "recipe-harness safety contracts OK"
