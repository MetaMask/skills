#!/usr/bin/env bash
# Terminal is a cook platform like the others: detected from its checkout and
# accepted by the template scripts, with dev and fix-bug templates.
set -euo pipefail
scripts="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fail() { echo "FAIL: $*" >&2; exit 1; }

mkdir -p "$tmp/va-mmcx-terminal"
got="$(cd "$tmp/va-mmcx-terminal" && "$scripts/detect-platform")" || fail "detect-platform refused a Terminal checkout"
[ "$got" = terminal ] || fail "detect-platform said $got"

mkdir -p "$tmp/renamed" && git -C "$tmp/renamed" init -q && git -C "$tmp/renamed" remote add origin git@github.com:consensys-vertical-apps/va-mmcx-terminal.git
got="$(cd "$tmp/renamed" && "$scripts/detect-platform")" || fail "detect-platform refused a Terminal remote"
[ "$got" = terminal ] || fail "detect-platform from the remote said $got"

# No harness on PATH: list-templates reads the packaged templates directly.
path="$(dirname "$(command -v node)"):/usr/bin:/bin"
for kind in dev fix-bug; do
  out="$(env -u MM_HARNESS_BIN PATH="$path" "$scripts/list-templates" --task-kind "$kind" --platform terminal --json)" \
    || fail "list-templates refused --platform terminal for $kind"
  grep -q "\"$kind/terminal\"" <<<"$out" || fail "no $kind/terminal template: $out"
done
echo "platform: terminal detected and listed for dev and fix-bug"
