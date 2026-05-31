# json-field.sh — shared JSON-field reader for recipe-harness scripts.
# Sourced (not executed). read_runtime_context_field <json-path> <dotted.field>
# prints the value (empty string if absent); returns 1 if the file is missing.
read_runtime_context_field() {
  local context_path="$1"
  local field="$2"
  [ -f "$context_path" ] || return 1
  node -e '
const fs = require("node:fs");
const [path, field] = process.argv.slice(1);
try {
  const data = JSON.parse(fs.readFileSync(path, "utf8"));
  const value = field.split(".").reduce((node, key) => {
    if (node === undefined || node === null) return undefined;
    return node[key];
  }, data);
  if (value !== undefined && value !== null && value !== "") process.stdout.write(String(value));
} catch (error) {
  process.stderr.write(String(error && error.message ? error.message : error) + "\n");
  process.exitCode = 1;
}
' "$context_path" "$field"
}
