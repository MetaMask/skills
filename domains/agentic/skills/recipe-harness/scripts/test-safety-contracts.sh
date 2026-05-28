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
const fnStart = src.indexOf('js_dependencies_need_install() {');
const fnEnd = src.indexOf('mark_js_dependencies_reconciled() {', fnStart);
const depsFn = src.slice(fnStart, fnEnd);
if (!depsFn.includes('$CHECK_ONLY && return 1')) {
  throw new Error('check-only dependency probe must not write js-deps fingerprint metadata');
}
NODE
}

assert_verify_marks_harness_owned_only_after_preflight_success() {
  local verify="$SKILL_DIR/adapters/mobile/scripts/verify.sh"
  node - "$verify" <<'NODE'
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
const preflightCall = src.indexOf('bash "${preflight_args[@]}"');
const marker = src.indexOf(': > "$ARTIFACTS/logs/harness-started-runtime"');
const failure = src.indexOf('return 1', preflightCall);
if (preflightCall === -1 || marker === -1 || marker < preflightCall) {
  throw new Error('verify must write harness-started-runtime only after preflight succeeds');
}
if (failure === -1 || failure < marker) {
  throw new Error('verify must return failure when preflight does not start a runtime');
}
NODE
}

assert_partial_product_harness_install_is_metadata_only() {
  local target="$tmpdir/partial-product-mobile"
  mkdir -p "$target/scripts/perps/agentic"
  (
    cd "$target"
    git init -q
    printf 'product-owned\n' > scripts/perps/agentic/preflight.sh
    git add scripts/perps/agentic/preflight.sh
  )

  "$SKILL_DIR/adapters/mobile/scripts/install.sh" --target "$target" >/tmp/recipe-harness-mobile-partial-product.log 2>&1

  grep -qxF 'product-owned' "$target/scripts/perps/agentic/preflight.sh" \
    || fail "partial tracked product harness was overwritten without --force-overlay"
  grep -qxF '.agent/recipe-harness/' "$target/.git/info/exclude" \
    || fail "metadata-only install did not add expected exclude entry"
  node - "$target/.agent/recipe-harness/mobile/manifest.json" <<'NODE'
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (manifest.installMode !== 'product-owned') {
  throw new Error(`expected product-owned installMode, got ${manifest.installMode || '<missing>'}`);
}
if ((manifest.installedPaths || []).length !== 0 || (manifest.patchedFiles || []).length !== 0) {
  throw new Error('metadata-only install must not report installed or patched product files');
}
NODE

  "$SKILL_DIR/adapters/mobile/scripts/cleanup.sh" --target "$target" >/tmp/recipe-harness-mobile-partial-product-cleanup.log 2>&1
  [ ! -e "$target/.agent/recipe-harness/mobile" ] \
    || fail "metadata-only cleanup did not remove harness metadata"
  ! grep -qxF '.agent/recipe-harness/' "$target/.git/info/exclude" \
    || fail "metadata-only cleanup left exclude entry behind"
}

assert_mobile_adapter_scripts_parse_with_macos_bash() {
  local bash_bin="${BASH_SYNTAX_BIN:-/bin/bash}"
  if [ ! -x "$bash_bin" ]; then
    bash_bin="bash"
  fi

  local script
  for script in "$SKILL_DIR"/adapters/mobile/scripts/*.sh; do
    [ -f "$script" ] || continue
    "$bash_bin" -n "$script" || fail "mobile adapter script is not parseable by $bash_bin: $script"
  done
}

assert_extension_start_test_watch_is_target_scoped() {
  local live="$SKILL_DIR/adapters/extension/scripts/live.sh"
  node - "$live" <<'NODE'
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
if (src.includes("pgrep -f 'yarn start:test'")) {
  throw new Error('extension live --start-test-watch must not use machine-global pgrep');
}
if (!src.includes('watch_pid_file=temp/runtime/recipe-harness-webpack.pid')) {
  throw new Error('extension live --start-test-watch must use a target-scoped watcher pid file');
}
if (!src.includes('compiled=false') || !src.includes('Timed out waiting for target-scoped yarn start:test compilation marker')) {
  throw new Error('extension live --start-test-watch compile wait must fail when marker is not observed');
}
NODE
}

assert_extension_verify_does_not_autostart_by_default
assert_mobile_check_only_exits_before_wallet_reset
assert_verify_marks_harness_owned_only_after_preflight_success
assert_partial_product_harness_install_is_metadata_only
assert_mobile_adapter_scripts_parse_with_macos_bash
assert_extension_start_test_watch_is_target_scoped

echo "recipe-harness safety contracts OK"
