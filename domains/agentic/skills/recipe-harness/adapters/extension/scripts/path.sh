#!/usr/bin/env bash

resolve_harness_out() {
  local target="$1"
  local out="$2"
  node - "$target" "$out" <<'NODE'
const path = require('path');

const target = path.resolve(process.argv[2]);
const out = process.argv[3];
if (!out) process.exit(1);
if (out.split(/[\\/]+/).includes('..')) process.exit(1);

const resolved = path.resolve(target, out);
const relative = path.relative(target, resolved);
if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
  process.exit(1);
}

process.stdout.write(resolved);
NODE
}
