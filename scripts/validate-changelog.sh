#!/usr/bin/env bash

set -euo pipefail

args=(validate --formatter oxfmt --tag-prefix '@metamask/skills@')
if [[ "${GITHUB_REF:-}" =~ (^|/)release/ ]]; then
  args+=(--rc)
fi

yarn auto-changelog "${args[@]}" "$@"
