#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

tmpdir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmpdir"
}
trap cleanup EXIT

FARMSLOT_FIXTURE="$tmpdir/farmslot-fixture"
RUNNER_FIXTURE="$tmpdir/metamask-recipe-runner-fixture"
mkdir -p \
  "$FARMSLOT_FIXTURE/packages/recipe-harness" \
  "$FARMSLOT_FIXTURE/packages/protocol" \
  "$RUNNER_FIXTURE/bin" \
  "$RUNNER_FIXTURE/manifests"
printf '{"name":"@farmslot/recipe-harness"}\n' > "$FARMSLOT_FIXTURE/packages/recipe-harness/package.json"
printf '{"name":"@farmslot/protocol"}\n' > "$FARMSLOT_FIXTURE/packages/protocol/package.json"
printf '{"name":"@metamask/recipe-runner-fixture"}\n' > "$RUNNER_FIXTURE/package.json"
printf '#!/usr/bin/env bash\nprintf "fixture runner\\n"\n' > "$RUNNER_FIXTURE/bin/metamask-recipe"
chmod +x "$RUNNER_FIXTURE/bin/metamask-recipe"
printf '{"runner_protocol_version":1,"action_registry_version":1,"supported_official_actions":[],"action_metadata":{}}\n' \
  > "$RUNNER_FIXTURE/manifests/mobile.action-manifest.json"
printf '{"runner_protocol_version":1,"action_registry_version":1,"supported_official_actions":[],"action_metadata":{}}\n' \
  > "$RUNNER_FIXTURE/manifests/extension.action-manifest.json"

run_mobile_install() {
  FARMSLOT_ROOT="$FARMSLOT_FIXTURE" \
  METAMASK_RECIPE_RUNNER_SOURCE="$RUNNER_FIXTURE" \
    "$SKILL_DIR/adapters/mobile/scripts/install.sh" "$@"
}

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

assert_no_mobile_harness_bundled_in_skill() {
  [ ! -e "$SKILL_DIR/adapters/mobile/runner/scripts/perps/agentic" ] \
    || fail "mobile product harness must not be bundled under recipe-harness skill"
}

assert_force_overlay_requires_external_mobile_source() {
  local target="$tmpdir/mobile-force-overlay-no-source"
  mkdir -p "$target/app/core/NavigationService" "$target/app/components/Nav/App"
  (
    cd "$target"
    git init -q
    printf '{"scripts":{}}\n' > package.json
    printf '    this.#navigation = this.#createReactAwareNavigation(navRef);\n' > app/core/NavigationService/NavigationService.ts
    printf "import PerpsWebSocketHealthToast from './toast';\n  <ControllerEventToastBridge />\n" > app/components/Nav/App/App.tsx
  )

  set +e
  run_mobile_install --target "$target" --force-overlay --allow-dirty-harness-paths \
    >/tmp/recipe-harness-mobile-force-overlay-no-source.log 2>&1
  local rc=$?
  set -e

  [ "$rc" -ne 0 ] || fail "force overlay install passed without external mobile bridge source"
  grep -q 'Mobile bridge overlay source is not bundled in metamask-skills' \
    /tmp/recipe-harness-mobile-force-overlay-no-source.log \
    || fail "force overlay failure did not explain required external mobile bridge source"
}

assert_verify_marks_harness_owned_only_after_preflight_success() {
  local verify="$SKILL_DIR/adapters/mobile/scripts/verify.sh"
  node - "$verify" <<'NODE'
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
const preflightCall = src.indexOf('bash "${preflight_args[@]}"');
const marker = src.indexOf(': > "$ARTIFACTS/logs/harness-started-runtime"');
const failureAfterMarker = src.indexOf('return 1', marker);
if (preflightCall === -1 || marker === -1 || marker < preflightCall) {
  throw new Error('verify must write harness-started-runtime only after preflight succeeds');
}
if (failureAfterMarker === -1) {
  throw new Error('verify must return failure when preflight does not start a runtime');
}
if (!src.includes('EXPO_NO_TYPESCRIPT_SETUP=1 bash "${preflight_args[@]}"')) {
  throw new Error('verify auto-start must disable Expo TypeScript setup to avoid tsconfig drift');
}
if (!src.includes('native-config-before-autostart.sha256') || !src.includes('native-config-after-autostart.sha256')) {
  throw new Error('verify auto-start must snapshot native/package config around preflight');
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

  printf '.agent/recipe-harness/\n' > "$target/.git/info/exclude"

  run_mobile_install --target "$target" >/tmp/recipe-harness-mobile-partial-product.log 2>&1

  grep -qxF 'product-owned' "$target/scripts/perps/agentic/preflight.sh" \
    || fail "partial tracked product harness was overwritten without --force-overlay"
  grep -qxF '.agent/recipe-harness/' "$target/.git/info/exclude" \
    || fail "metadata-only install did not add expected exclude entry"
  grep -qxF '.skills-cache/' "$target/.agent/recipe-harness/mobile/added-git-exclude" \
    || fail "metadata-only install did not record newly added exclude entries"
  ! grep -qxF '.agent/recipe-harness/' "$target/.agent/recipe-harness/mobile/added-git-exclude" \
    || fail "metadata-only install recorded a pre-existing exclude entry"
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
  grep -qxF '.agent/recipe-harness/' "$target/.git/info/exclude" \
    || fail "metadata-only cleanup removed a pre-existing exclude entry"
  ! grep -qxF '.skills-cache/' "$target/.git/info/exclude" \
    || fail "metadata-only cleanup left an install-added exclude entry behind"
}

assert_installer_refuses_symlinked_runner_destinations() {
  local mobile_target="$tmpdir/mobile-symlink-runner"
  local extension_target="$tmpdir/extension-symlink-runner"
  mkdir -p "$mobile_target/.agent/recipe-harness/mobile" "$mobile_target/scripts/perps/agentic"
  mkdir -p "$extension_target/.agent/recipe-harness/extension"
  (
    cd "$mobile_target"
    git init -q
    printf 'product-owned\n' > scripts/perps/agentic/preflight.sh
    git add scripts/perps/agentic/preflight.sh
  )
  (
    cd "$extension_target"
    git init -q
  )
  ln -s "$tmpdir/outside-mobile-runner" "$mobile_target/.agent/recipe-harness/mobile/runner"
  ln -s "$tmpdir/outside-extension-runner" "$extension_target/.agent/recipe-harness/extension/runner"

  set +e
  run_mobile_install --target "$mobile_target" >/tmp/recipe-harness-mobile-symlink-runner.log 2>&1
  local mobile_rc=$?
  FARMSLOT_ROOT="$FARMSLOT_FIXTURE" \
  METAMASK_RECIPE_RUNNER_SOURCE="$RUNNER_FIXTURE" \
    "$SKILL_DIR/adapters/extension/scripts/install.sh" --target "$extension_target" \
      >/tmp/recipe-harness-extension-symlink-runner.log 2>&1
  local extension_rc=$?
  set -e

  [ "$mobile_rc" -ne 0 ] || fail "mobile install followed symlinked runner destination"
  [ "$extension_rc" -ne 0 ] || fail "extension install followed symlinked runner destination"
  grep -q 'symlink' /tmp/recipe-harness-mobile-symlink-runner.log \
    || fail "mobile symlink refusal did not explain symlink risk"
  grep -q 'symlink' /tmp/recipe-harness-extension-symlink-runner.log \
    || fail "extension symlink refusal did not explain symlink risk"
}

assert_runner_source_precedence_allows_stale_lower_priority_env() {
  local target="$tmpdir/runner-source-precedence"
  mkdir -p "$target/scripts/perps/agentic"
  (
    cd "$target"
    git init -q
    printf 'product-owned\n' > scripts/perps/agentic/preflight.sh
    git add scripts/perps/agentic/preflight.sh
  )

  FARMSLOT_ROOT="$FARMSLOT_FIXTURE" \
  METAMASK_RECIPE_RUNNER_SOURCE="$RUNNER_FIXTURE" \
  RECIPE_RUNNER_SOURCE="$tmpdir/missing-lower-priority-runner" \
    "$SKILL_DIR/adapters/mobile/scripts/install.sh" --target "$target" \
      >/tmp/recipe-harness-runner-source-precedence.log 2>&1

  node - "$target/.agent/recipe-harness/mobile/manifest.json" <<'NODE'
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (manifest.source.runnerSourceKind !== 'env:METAMASK_RECIPE_RUNNER_SOURCE') {
  throw new Error(`expected highest-priority runner source, got ${manifest.source.runnerSourceKind}`);
}
NODE
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
if (!src.includes('compiled=false') || !src.includes('Timed out waiting for target-scoped yarn start compilation marker')) {
  throw new Error('extension live --start-test-watch compile wait must fail when marker is not observed');
}
NODE
}

assert_extension_verify_does_not_autostart_by_default
assert_no_mobile_harness_bundled_in_skill
assert_force_overlay_requires_external_mobile_source
assert_verify_marks_harness_owned_only_after_preflight_success
assert_partial_product_harness_install_is_metadata_only
assert_installer_refuses_symlinked_runner_destinations
assert_runner_source_precedence_allows_stale_lower_priority_env
assert_mobile_adapter_scripts_parse_with_macos_bash
assert_extension_start_test_watch_is_target_scoped

echo "recipe-harness safety contracts OK"
