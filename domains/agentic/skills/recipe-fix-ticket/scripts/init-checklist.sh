#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage: init-checklist.sh --platform mobile|extension [--slug task-slug] [--task-dir path]

Creates a live CHECKLIST.md copied from this skill's embedded
platform checklist. Prints the CHECKLIST.md path on stdout.
USAGE
}

platform=""
slug="task"
task_dir=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --platform) platform="${2:-}"; shift 2 ;;
    --slug) slug="${2:-}"; shift 2 ;;
    --task-dir) task_dir="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 2 ;;
  esac
done

case "$platform" in
  mobile|extension) ;;
  *) echo "--platform must be mobile or extension" >&2; usage; exit 2 ;;
esac

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_dir="$(cd "$script_dir/.." && pwd)"
skill_name="$(basename "$skill_dir")"
ref="$skill_dir/references/metamask-${platform}-checklist.md"
if [ ! -f "$ref" ]; then
  echo "Checklist reference not found: $ref" >&2
  exit 1
fi

safe_slug="$(printf '%s' "$slug" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9._-]+/-/g; s/^-+//; s/-+$//')"
[ -n "$safe_slug" ] || safe_slug="task"
if [ -z "$task_dir" ]; then
  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  task_dir="temp/tasks/${skill_name}/${ts}-${safe_slug}"
fi
mkdir -p "$task_dir/artifacts"
out="$task_dir/CHECKLIST.md"
{
  printf '# Live Recipe Workflow Checklist\n\n'
  printf 'Generated: %s\n\n' "$(date -Iseconds)"
  printf 'Skill: `%s`\n\n' "$skill_name"
  printf 'Platform: `%s`\n\n' "$platform"
  printf 'Task slug: `%s`\n\n' "$safe_slug"
  printf '> Human progress file: monitor this file. The agent must mark each gate `[ ]` → `[x]` as work progresses and add artifact paths/results under the relevant gate.\n\n'
  cat "$ref"
} > "$out"
printf '%s\n' "$out"
