#!/usr/bin/env bash
set -euo pipefail

TARGET="$PWD"
ALLOW_DIRTY=false
while [ "$#" -gt 0 ]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --allow-dirty-harness-paths) ALLOW_DIRTY=true; shift ;;
    -h|--help) echo "Usage: install.sh [--target <metamask-mobile>] [--allow-dirty-harness-paths]"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADAPTER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SKILL_DIR="$(cd "${ADAPTER_DIR}/../.." && pwd)"
TARGET="$(cd "$TARGET" && pwd)"
HARNESS_DIR="$TARGET/.agent/recipe-harness/mobile"
if GIT_BACKUP_PATH="$(git -C "$TARGET" rev-parse --git-path recipe-harness/mobile/backup 2>/dev/null)"; then
  case "$GIT_BACKUP_PATH" in
    /*) BACKUP_DIR="$GIT_BACKUP_PATH" ;;
    *) BACKUP_DIR="$TARGET/$GIT_BACKUP_PATH" ;;
  esac
else
  BACKUP_DIR="$HARNESS_DIR/backup-store"
fi
OLD_BACKUP_DIR="$HARNESS_DIR/backup"
if [ "$BACKUP_DIR" != "$OLD_BACKUP_DIR" ] && [ -f "$OLD_BACKUP_DIR/state.env" ] && [ ! -e "$BACKUP_DIR" ]; then
  mkdir -p "$(dirname "$BACKUP_DIR")"
  mv "$OLD_BACKUP_DIR" "$BACKUP_DIR"
fi
STATE_FILE="$BACKUP_DIR/state.env"

mkdir -p "$HARNESS_DIR"

INSTALLED=false

hash_path() {
  local item="$1"
  if [ ! -e "$TARGET/$item" ]; then
    printf 'MISSING'
  elif [ -d "$TARGET/$item" ]; then
    (
      cd "$TARGET"
      find "$item" -type f | LC_ALL=C sort | while IFS= read -r file; do
        shasum -a 256 "$file"
      done | shasum -a 256 | awk '{print $1}'
    )
  else
    (cd "$TARGET" && shasum -a 256 "$item" | awk '{print $1}')
  fi
}

verify_installed_paths_unchanged() {
  local hash_file="$BACKUP_DIR/managed-hashes.tsv"
  if [ ! -f "$hash_file" ]; then
    return 0
  fi
  local rel expected actual conflicts=0
  while IFS=$'\t' read -r rel expected; do
    [ -n "$rel" ] || continue
    actual="$(hash_path "$rel")"
    if [ "$actual" != "$expected" ]; then
      echo "Refusing to refresh mobile recipe harness: managed path changed after install: $rel" >&2
      echo "  expected: $expected" >&2
      echo "  actual:   $actual" >&2
      conflicts=1
    fi
  done < "$hash_file"
  if [ "$conflicts" != "0" ]; then
    cat >&2 <<EOF
Reinstall would bless local edits as harness-managed and make cleanup unsafe.
Save/stash product changes or rerun with --allow-dirty-harness-paths if you intentionally want to overwrite and refresh harness-managed state.
EOF
    exit 1
  fi
}

if [ -f "$HARNESS_DIR/manifest.json" ] && [ -f "$STATE_FILE" ]; then
  INSTALLED=true
  echo "Existing mobile recipe harness found; refreshing injected files from source." >&2
fi

if [ "$ALLOW_DIRTY" = false ] && [ "$INSTALLED" = true ]; then
  verify_installed_paths_unchanged
fi

if [ "$ALLOW_DIRTY" = false ] && [ "$INSTALLED" = false ] && git -C "$TARGET" rev-parse --git-dir >/dev/null 2>&1; then
  DIRTY_PATHS="$(git -C "$TARGET" status --porcelain -- package.json scripts/perps/agentic app/core/AgenticService app/core/NavigationService/NavigationService.ts app/components/Nav/App/App.tsx)"
  if [ -n "$DIRTY_PATHS" ]; then
    cat >&2 <<EOF
Refusing to install mobile recipe harness over dirty harness paths.
Clean, stash, or rerun with --allow-dirty-harness-paths if you intentionally want backup/restore behavior.

$DIRTY_PATHS
EOF
    exit 1
  fi
fi

backup_path() {
  local rel="$1"
  local var="$2"
  local target_path="$TARGET/$rel"
  local backup_path="$ACTIVE_BACKUP_DIR/$rel"
  if [ -e "$target_path" ]; then
    mkdir -p "$(dirname "$backup_path")"
    cp -a "$target_path" "$backup_path"
    printf '%s=1\n' "$var" >> "$ACTIVE_STATE_FILE"
  else
    printf '%s=0\n' "$var" >> "$ACTIVE_STATE_FILE"
  fi
}

if [ ! -f "$STATE_FILE" ]; then
  TMP_BACKUP_DIR="$(mktemp -d "$HARNESS_DIR/backup.tmp.XXXXXX")"
  ACTIVE_BACKUP_DIR="$TMP_BACKUP_DIR"
  ACTIVE_STATE_FILE="$TMP_BACKUP_DIR/state.env"
  : > "$ACTIVE_STATE_FILE"
  backup_path "scripts/perps/agentic" "SCRIPTS_EXISTED"
  backup_path "app/core/AgenticService" "AGENTIC_SERVICE_EXISTED"
  backup_path "package.json" "PACKAGE_JSON_EXISTED"
  backup_path "app/core/NavigationService/NavigationService.ts" "NAVIGATION_SERVICE_EXISTED"
  backup_path "app/components/Nav/App/App.tsx" "APP_TSX_EXISTED"
  rm -rf "$BACKUP_DIR"
  mkdir -p "$(dirname "$BACKUP_DIR")"
  mv "$TMP_BACKUP_DIR" "$BACKUP_DIR"
fi

mkdir -p "$TARGET/scripts/perps" "$TARGET/app/core"
rsync -a --delete "$ADAPTER_DIR/runner/scripts/perps/agentic" "$TARGET/scripts/perps/"
rsync -a --delete "$ADAPTER_DIR/app-overlay/app/core/AgenticService" "$TARGET/app/core/"

node - "$TARGET" <<'NODE'
const fs = require('fs');
const path = require('path');

const target = process.argv[2];

function patchPackageJson() {
  const file = path.join(target, 'package.json');
  if (!fs.existsSync(file)) throw new Error(`missing ${file}`);
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  pkg.scripts = pkg.scripts || {};
  const desired = {
    'a:start': 'scripts/perps/agentic/start-metro.sh',
    'a:watch': 'scripts/perps/agentic/interactive-start.sh',
    'a:stop': 'scripts/perps/agentic/stop-metro.sh',
    'a:status': 'scripts/perps/agentic/app-state.sh status',
    'a:reload': 'scripts/perps/agentic/reload-metro.sh',
    'a:navigate': 'scripts/perps/agentic/app-navigate.sh',
    'a:ios': 'scripts/perps/agentic/preflight.sh --platform ios --wallet-setup',
    'a:android': 'scripts/perps/agentic/preflight.sh --platform android --wallet-setup',
    'a:setup:ios': 'scripts/perps/agentic/preflight.sh --platform ios --clean --wallet-setup',
    'a:setup:android': 'scripts/perps/agentic/preflight.sh --platform android --clean --wallet-setup',
  };
  let changed = false;
  for (const [key, value] of Object.entries(desired)) {
    if (pkg.scripts[key] !== value) {
      pkg.scripts[key] = value;
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
  }
  return changed ? 'patched' : 'already-present';
}

function patchNavigation() {
  const file = path.join(target, 'app/core/NavigationService/NavigationService.ts');
  if (!fs.existsSync(file)) throw new Error(`missing ${file}`);
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes('AgenticService.install')) return 'already-present';
  const marker = '    this.#navigation = this.#createReactAwareNavigation(navRef);\n';
  const insert = `${marker}\n    if (__DEV__) {\n      import('../AgenticService/AgenticService').then(\n        ({ default: AgenticService }) => {\n          AgenticService.install(navRef, this.#navigation);\n        },\n      );\n    }\n`;
  if (!src.includes(marker)) {
    throw new Error(`cannot patch NavigationService.ts: marker not found`);
  }
  src = src.replace(marker, insert);
  fs.writeFileSync(file, src);
  return 'patched';
}

function patchApp() {
  const file = path.join(target, 'app/components/Nav/App/App.tsx');
  if (!fs.existsSync(file)) throw new Error(`missing ${file}`);
  let src = fs.readFileSync(file, 'utf8');
  let importStatus = 'already-present';
  if (!src.includes("core/AgenticService/AgentStepHud")) {
    const marker = "import PerpsWebSocketHealthToast";
    const line = "import AgentStepHud from '../../../core/AgenticService/AgentStepHud';\n";
    if (src.includes(marker)) {
      src = src.replace(marker, `${line}${marker}`);
    } else {
      throw new Error(`cannot patch App.tsx: import marker not found`);
    }
    importStatus = 'patched';
  }
  let renderStatus = 'already-present';
  if (!src.includes('<AgentStepHud')) {
    const marker = /^(\s*)<ControllerEventToastBridge\b[^\n]*\/>/m;
    const match = src.match(marker);
    if (!match) {
      throw new Error(`cannot patch App.tsx: render marker not found`);
    }
    src = src.replace(marker, `${match[1]}{__DEV__ && <AgentStepHud />}\n${match[0]}`);
    renderStatus = 'patched';
  }
  fs.writeFileSync(file, src);
  return `${importStatus},${renderStatus}`;
}

console.log(JSON.stringify({
  packageJson: patchPackageJson(),
  navigation: patchNavigation(),
  app: patchApp(),
}));
NODE

add_git_exclude() {
  local entry="$1"
  local git_dir
  local exclude_file
  if ! git_dir="$(git -C "$TARGET" rev-parse --git-dir 2>/dev/null)"; then
    return 0
  fi
  case "$git_dir" in
    /*) ;;
    *) git_dir="$TARGET/$git_dir" ;;
  esac
  exclude_file="$git_dir/info/exclude"
  mkdir -p "$(dirname "$exclude_file")"
  touch "$exclude_file"
  if ! grep -qxF "$entry" "$exclude_file"; then
    echo "$entry" >> "$exclude_file"
    echo "$entry" >> "$BACKUP_DIR/added-git-exclude"
  fi
}

add_git_exclude ".agent/recipe-harness/"
add_git_exclude "temp/agentic/recipe-harness/"
add_git_exclude "scripts/perps/agentic/"
add_git_exclude "app/core/AgenticService/"

write_managed_hashes() {
  local hash_file="$BACKUP_DIR/managed-hashes.tsv"
  local rel
  : > "$hash_file"
  for rel in \
    "scripts/perps/agentic" \
    "app/core/AgenticService" \
    "package.json" \
    "app/core/NavigationService/NavigationService.ts" \
    "app/components/Nav/App/App.tsx"; do
    printf '%s\t%s\n' "$rel" "$(hash_path "$rel")" >> "$hash_file"
  done
}

write_managed_hashes

SOURCE_REV="$(git -C "$SKILL_DIR" rev-parse HEAD 2>/dev/null || echo unknown)"
cat > "$HARNESS_DIR/manifest.json" <<EOF
{
  "adapter": "mobile",
  "installedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "source": {
    "skillDir": "$SKILL_DIR",
    "revision": "$SOURCE_REV",
    "runtime": "$ADAPTER_DIR"
  },
  "target": "$TARGET",
  "installedPaths": [
    "scripts/perps/agentic",
    "app/core/AgenticService"
  ],
  "patchedFiles": [
    "package.json",
    "app/core/NavigationService/NavigationService.ts",
    "app/components/Nav/App/App.tsx"
  ],
  "backupDir": "$BACKUP_DIR",
  "managedHashes": "$BACKUP_DIR/managed-hashes.tsv",
  "cleanupCommand": "$SCRIPT_DIR/cleanup.sh --target $TARGET",
  "productDiffExcludes": [
    ":(exclude).agent/recipe-harness",
    ":(exclude)scripts/perps/agentic",
    ":(exclude)app/core/AgenticService"
  ]
}
EOF

echo "Installed mobile recipe harness: $HARNESS_DIR/manifest.json"
