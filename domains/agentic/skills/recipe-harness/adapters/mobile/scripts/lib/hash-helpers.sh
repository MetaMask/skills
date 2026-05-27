#!/usr/bin/env bash

digest_file() {
  local file="$1"
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" | awk '{print $1}'
  elif command -v openssl >/dev/null 2>&1; then
    openssl dgst -sha256 "$file" | awk '{print $NF}'
  else
    echo "Error: need shasum, sha256sum, or openssl for mobile harness hashing." >&2
    exit 1
  fi
}

digest_stdin() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{print $1}'
  elif command -v openssl >/dev/null 2>&1; then
    openssl dgst -sha256 | awk '{print $NF}'
  else
    echo "Error: need shasum, sha256sum, or openssl for mobile harness hashing." >&2
    exit 1
  fi
}

hash_path() {
  local rel="$1"
  if [ ! -e "$TARGET/$rel" ]; then
    printf 'MISSING'
  elif [ -d "$TARGET/$rel" ]; then
    (
      cd "$TARGET"
      find "$rel" -type f | LC_ALL=C sort | while IFS= read -r file; do
        printf '%s  %s\n' "$(digest_file "$file")" "$file"
      done | digest_stdin
    )
  else
    (cd "$TARGET" && digest_file "$rel")
  fi
}
