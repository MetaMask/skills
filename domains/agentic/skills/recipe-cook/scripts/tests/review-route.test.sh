#!/usr/bin/env bash
set -euo pipefail
skill_dir="$(cd "$(dirname "$0")/../.." && pwd)"
runner="$skill_dir/scripts/create-harness-runner"
policy="$skill_dir/../recipe-setup/scripts/harness-package-policy"
init="$skill_dir/scripts/init-template"
# Removed runtime-review IDs cannot silently start a static review or launch an app.
for platform in mobile extension; do
  test -f "$skill_dir/references/templates/qa/pr.$platform.md"
  test ! -e "$skill_dir/references/templates/review-pr/autonomous.$platform.md"
done
if "$init" --platform mobile --task-kind review-pr --template review-pr/static-perps.mobile --prepare >/dev/null 2>&1; then
  echo 'static review accepted runtime preparation' >&2; exit 1
fi

# create-harness-runner must produce a runner that actually resolves and execs a
# harness, not merely contain the right text.
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

produced="$("$runner" "$work/task")"
[ "$produced" = "$work/task/mm-harness" ] || { echo "create-harness-runner returned an unexpected path: $produced" >&2; exit 1; }
test -x "$produced"

minimum="$(sed -n 's/^HARNESS_RECOMMENDED_VERSION="\(.*\)"$/\1/p' "$policy")"
[ -n "$minimum" ] || { echo "harness-package-policy has no resolvable recommended version" >&2; exit 1; }
# shellcheck source=../../../recipe-setup/scripts/harness-package-policy
source "$policy"
test "$HARNESS_PACKAGE_SPEC" = "@deeeed/metamask-harness@$minimum"
# One pin: no recipe skill writes a harness version anywhere but the policy file.
if grep -rIlE "metamask-harness@[0-9]|recommended version [0-9]" "$skill_dir/.." --exclude=harness-package-policy --exclude-dir=tests >/dev/null; then
  echo 'A recipe skill hard-codes a harness version outside recipe-setup/scripts/harness-package-policy' >&2; exit 1
fi
if grep -Eq 'u\.latest|mm-harness update' "$skill_dir/../recipe-setup/scripts/setup-check"; then
  echo 'Setup must not recommend unreviewed registry releases' >&2
  exit 1
fi
grep -Fq 'scripts/harness-package-policy' "$skill_dir/../recipe-setup/skill.md" || { echo 'Setup does not point at the harness pin' >&2; exit 1; }

# Setup uses the explicit binary and never suggests a newer registry release.
cat > "$work/setup-harness" <<'SH'
#!/usr/bin/env bash
test "$*" = 'doctor --json' || exit 1
printf '%s\n' '{"status":"pass","runner":{"version":"99.0.0"},"adapter":"core","fixture":{"status":"ready"},"update":{"checked":true,"current":"99.0.0","latest":"100.0.0","updateAvailable":true}}'
SH
chmod +x "$work/setup-harness"
setup_output="$(MM_HARNESS_BIN="$work/setup-harness" "$skill_dir/../recipe-setup/scripts/setup-check")"
grep -Fq 'mm-harness 99.0.0' <<< "$setup_output"
if grep -Eq '100\.0\.0|mm-harness update' <<< "$setup_output"; then
  echo 'Setup recommended an unreviewed release' >&2
  exit 1
fi
grep -Fq "✓ harness 99.0.0 (recommended $minimum or newer)" <<< "$setup_output"

# An installed harness older than the reviewed release is flagged with the exact install.
sed 's/"version":"99.0.0"/"version":"0.1.0"/' "$work/setup-harness" > "$work/old-harness"
chmod +x "$work/old-harness"
old_output="$(MM_HARNESS_BIN="$work/old-harness" "$skill_dir/../recipe-setup/scripts/setup-check")"
grep -Fq "! harness 0.1.0 is older than the recommended $minimum (npm i -g '$HARNESS_PACKAGE_SPEC')" <<< "$old_output"
grep -Fq 'SETUP OK (warnings:' <<< "$old_output"

# Execution requires an existing receipt and cannot resolve a new PATH binary.
set +e
runner_output="$(env PATH="/usr/bin:/bin" MM_HARNESS_BIN="$work/absent-harness" "$produced" actions --json 2>&1)"
runner_status=$?
set -e
[ "$runner_status" -ne 0 ] || { echo "task-local runner succeeded without a resolvable harness" >&2; exit 1; }
grep -Fq 'harness provenance is missing, stale, or invalid' <<<"$runner_output"

echo "recipe-cook review route: PASS"
