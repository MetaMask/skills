#!/usr/bin/env bash
#
# BUNDLE_DIRS in tools/skill-schema.mjs is what the linter accepts beside a skill.md.
# The bundle loop in tools/install is what actually reaches a consuming repo. They are one
# contract expressed twice, in two languages, and nothing compares them.
#
# When they drift, a skill passes lint carrying a directory the installer silently skips.
# The skill still installs, still loads, and still answers, minus whatever that directory
# held. Nothing errors and nothing reports it, so the gap is only visible to someone who
# goes looking for a file that is not there.
#
# This tests the installer's behaviour rather than its source text. It builds a fixture
# skill containing every declared bundle directory, runs a dry-run install, and asserts
# each one is reported as copied. A regex over the loop would only compare two
# declarations, which is the same class of evidence as the bug.
#
#   0  every declared bundle directory is shipped
#   1  at least one is declared and not shipped
#   2  could not run the comparison
set -uo pipefail
ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
SCHEMA="$ROOT/tools/skill-schema.mjs"
INSTALL="$ROOT/tools/install"

[ -f "$SCHEMA" ]  || { echo "check-bundle-contract: no schema at $SCHEMA" >&2; exit 2; }
[ -x "$INSTALL" ] || [ -f "$INSTALL" ] || { echo "check-bundle-contract: no installer at $INSTALL" >&2; exit 2; }

declared=$(sed -n "s/.*BUNDLE_DIRS *= *\[\([^]]*\)\].*/\1/p" "$SCHEMA" \
  | tr -d "'\"" | tr ',' '\n' | tr -d ' ' | grep -v '^$')
[ -n "$declared" ] || { echo "check-bundle-contract: could not parse BUNDLE_DIRS from $SCHEMA" >&2; exit 2; }

tmp=$(mktemp -d) || exit 2
trap 'rm -rf "$tmp"' EXIT

# A fixture skill carrying one file in every declared bundle directory.
fixture="$tmp/src/domains/contract-check/skills/bundle-fixture"
mkdir -p "$fixture"
cat > "$fixture/skill.md" <<'EOF'
---
name: bundle-fixture
description: Fixture skill used by check-bundle-contract to observe which bundle directories the installer copies. Not installed by any consumer and carries no guidance.
---

# Bundle fixture

Exists so the installer can be watched rather than read.
EOF
for b in $declared; do
  mkdir -p "$fixture/$b"
  echo "marker" > "$fixture/$b/marker.txt"
done

# The installer resolves its source tree from its own location, so it runs from a copy
# placed inside the fixture tree rather than from an environment override.
mkdir -p "$tmp/src/tools"
cp "$INSTALL" "$tmp/src/tools/install"
chmod +x "$tmp/src/tools/install"
mkdir -p "$tmp/dest"

out="$tmp/install.log"
if ! bash "$tmp/src/tools/install" \
      --repo metamask-extension --target "$tmp/dest" --dry-run >"$out" 2>&1; then
  echo "check-bundle-contract: dry-run install failed, cannot observe behaviour" >&2
  sed 's/^/    /' "$out" | tail -5 >&2
  exit 2
fi

printf 'check-bundle-contract\n  declared in %s:\n    %s\n\n' \
  "$(basename "$SCHEMA")" "$(echo "$declared" | tr '\n' ' ')"

fails=0
for b in $declared; do
  if grep -q "/$b/" "$out"; then
    printf '  ok       %-12s reported copied\n' "$b"
  else
    printf '  UNSHIPPED %-12s declared, never copied\n' "$b"
    fails=$((fails + 1))
  fi
done
echo

if [ "$fails" -eq 0 ]; then
  echo "every declared bundle directory is shipped"
  echo
  echo "This observes a dry run. It shows which directories the installer reports, not that"
  echo "the bytes landed. A real install into a scratch target would close that gap."
  exit 0
fi

echo "$fails declared bundle director(y/ies) never reach a consuming repo."
echo "A skill can pass lint carrying one of these and it will install, load, and answer"
echo "without it. Add the name to the bundle loop in tools/install, or remove it from"
echo "BUNDLE_DIRS so the linter stops accepting it."
exit 1
