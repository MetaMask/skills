#!/usr/bin/env bash
set -euo pipefail

TARGET="$PWD"
ALLOW_DIRTY=false
FORCE_OVERLAY=false
GIT_EXCLUDE=true
while [ "$#" -gt 0 ]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --allow-dirty-harness-paths) ALLOW_DIRTY=true; shift ;;
    --force-overlay) FORCE_OVERLAY=true; shift ;;
    --no-git-exclude) GIT_EXCLUDE=false; shift ;;
    -h|--help) echo "Usage: install.sh [--target <metamask-mobile>] [--allow-dirty-harness-paths] [--force-overlay] [--no-git-exclude]"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADAPTER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SKILL_DIR="$(cd "${ADAPTER_DIR}/../.." && pwd)"
AGENTIC_DIR="$(cd "$SKILL_DIR/../.." && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib/hash-helpers.sh"
# shellcheck disable=SC1091
for _hp in "$SCRIPT_DIR/lib/harness-path.sh" "$SCRIPT_DIR/../../../scripts/lib/harness-path.sh"; do
  [ -f "$_hp" ] && { . "$_hp"; break; }
done
unset _hp
if ! command -v harness_root >/dev/null 2>&1; then
  echo "recipe-harness: shared lib scripts/lib/harness-path.sh not found; reinstall the harness." >&2
  exit 1
fi
# shellcheck disable=SC1091
. "$SKILL_DIR/scripts/resolve-runner-source.sh"
TARGET="$(cd "$TARGET" && pwd)"
resolve_metamask_recipe_runner_source "$SKILL_DIR" "$AGENTIC_DIR" "$TARGET"
HARNESS_ROOT="$(harness_root)"
HARNESS_REL="$HARNESS_ROOT/mobile"

refuse_symlink_destination() {
  local rel="$1"
  local path_so_far="$TARGET"
  IFS='/' read -r -a parts <<< "$rel"
  for part in "${parts[@]}"; do
    [ -n "$part" ] || continue
    path_so_far="$path_so_far/$part"
    if [ -L "$path_so_far" ]; then
      echo "Refusing mobile recipe harness install: $rel contains symlink component $path_so_far." >&2
      return 1
    fi
  done
}

HARNESS_DIR="$(harness_dir "$TARGET" mobile)"
# refuse_symlink_destination walks every path component, so the deepest path also
# guards its parents ($HARNESS_REL covers the root segments).
refuse_symlink_destination "$HARNESS_REL"
refuse_symlink_destination "scripts"
refuse_symlink_destination "scripts/perps"
refuse_symlink_destination "scripts/perps/agentic"
refuse_symlink_destination "app"
refuse_symlink_destination "app/core"
refuse_symlink_destination "app/core/AgenticService"
refuse_symlink_destination "app/core/NavigationService"
refuse_symlink_destination "app/components"
refuse_symlink_destination "app/components/Nav"
refuse_symlink_destination "app/components/Nav/App"
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

install_v1_runner_assets() {
  # refuse_symlink_destination walks every path component, so the deepest paths
  # also guard their parents ($HARNESS_REL covers the root segments).
  refuse_symlink_destination "$HARNESS_REL/runner"
  refuse_symlink_destination "$HARNESS_REL/action-manifest.json"
  mkdir -p "$HARNESS_DIR"
  rm -rf "$HARNESS_DIR/runner"
  mkdir -p "$HARNESS_DIR/runner/bin" "$HARNESS_DIR/runner/manifests" "$HARNESS_DIR/runner/recipes"

  # Mobile Metro/Watchman observes the product checkout. Copying the full
  # TypeScript runner tree into .agent while Metro is running can trigger large
  # file-map recrawls and make the React Native debug bridge unresponsive.
  # Keep the target overlay lightweight: install a harness-owned delegate plus
  # manifest/recipe snapshots, and execute the reviewed external runner source
  # recorded in manifest.json. This preserves the injection contract without
  # making the skills repo or the watched product checkout own the runtime.
  # Emit shell-safe lines: %q-quote the interpolated paths (like CLEANUP_COMMAND
  # below) so a FARMSLOT_ROOT/runner path containing a space — or $()/backtick/
  # quote — cannot break the generated wrapper or inject at runtime.
  local runner_farmslot_root_q runner_exec_q
  runner_farmslot_root_q="$(printf '%q' "$METAMASK_RUNNER_FARMSLOT_ROOT")"
  runner_exec_q="$(printf '%q' "$METAMASK_RUNNER_DIR/bin/metamask-recipe")"
  cat > "$HARNESS_DIR/runner/bin/metamask-recipe" <<EOF
#!/usr/bin/env bash
set -euo pipefail
export FARMSLOT_ROOT=\${FARMSLOT_ROOT:-$runner_farmslot_root_q}
exec $runner_exec_q "\$@"
EOF
  chmod +x "$HARNESS_DIR/runner/bin/metamask-recipe"
  printf '%s\n' "$METAMASK_RUNNER_FARMSLOT_ROOT" > "$HARNESS_DIR/runner/.farmslot-root"
  printf '%s\n' "$METAMASK_RUNNER_DIR" > "$HARNESS_DIR/runner/.runner-source"
  cp "$METAMASK_RUNNER_DIR/manifests/mobile.action-manifest.json" "$HARNESS_DIR/action-manifest.json"
  cp "$METAMASK_RUNNER_DIR/manifests/mobile.action-manifest.json" "$HARNESS_DIR/runner/manifests/mobile.action-manifest.json"
  cp "$METAMASK_RUNNER_DIR/manifests/extension.action-manifest.json" "$HARNESS_DIR/runner/manifests/extension.action-manifest.json"
  if [ -d "$METAMASK_RUNNER_DIR/recipes" ]; then
    rsync -a --delete "$METAMASK_RUNNER_DIR/recipes/" "$HARNESS_DIR/runner/recipes/"
  fi
  if [ ! -x "$HARNESS_DIR/runner/bin/metamask-recipe" ]; then
    echo "Refusing mobile recipe harness install: failed to make runner executable." >&2
    return 1
  fi
}

git_tracks_any_under() {
  git -C "$TARGET" ls-files -- "$1" 2>/dev/null | grep -q .
}

has_product_owned_mobile_harness() {
  # If the product repo tracks any first-party harness subtree, installing the
  # skill overlay must be metadata-only by default. Requiring every marker to be
  # present is unsafe for older/partial Mobile commits: falling through would
  # rsync --delete tracked product-owned files without --force-overlay.
  git_tracks_any_under "scripts/perps/agentic" && return 0
  git_tracks_any_under "app/core/AgenticService" && return 0

  # Marker fallback for checkouts where the harness was patched but not tracked.
  grep -q "AgenticService.install" "$TARGET/app/core/NavigationService/NavigationService.ts" 2>/dev/null \
    && grep -q "AgentStepHud" "$TARGET/app/components/Nav/App/App.tsx" 2>/dev/null
}

validate_mobile_agentic_source() {
  local source="$1"
  local rel
  for rel in \
    "cdp-bridge.js" \
    "preflight.sh" \
    "start-metro.sh" \
    "interactive-start.sh" \
    "stop-metro.sh" \
    "reload-metro.sh" \
    "app-state.sh" \
    "app-navigate.sh" \
    "screenshot.sh" \
    "setup-wallet.sh" \
    "lib/safe-env-parser.sh"; do
    if [ ! -f "$source/$rel" ]; then
      echo "METAMASK_MOBILE_AGENTIC_SOURCE is missing required Mobile bridge entrypoint: $source/$rel" >&2
      return 1
    fi
  done
}

resolve_mobile_agentic_source() {
  local raw="${METAMASK_MOBILE_AGENTIC_SOURCE:-${METAMASK_RECIPE_MOBILE_BRIDGE_SOURCE:-}}"
  local candidate=""
  if [ -n "$raw" ]; then
    if [ -d "$raw/scripts/perps/agentic" ]; then
      candidate="$raw/scripts/perps/agentic"
    elif [ -d "$raw" ] && [ -f "$raw/cdp-bridge.js" ]; then
      candidate="$raw"
    else
      echo "METAMASK_MOBILE_AGENTIC_SOURCE must point at scripts/perps/agentic or a repo containing scripts/perps/agentic: $raw" >&2
      return 1
    fi
    validate_mobile_agentic_source "$candidate"
    MOBILE_AGENTIC_SOURCE="$(cd "$candidate" && pwd)"
    return 0
  fi

  cat >&2 <<EOF
Mobile bridge overlay source is not bundled in metamask-skills.
Set METAMASK_MOBILE_AGENTIC_SOURCE to a reviewed product/farm checkout path
(or directly to its scripts/perps/agentic directory) when installing into a
checkout that does not already own scripts/perps/agentic.
EOF
  return 1
}

add_git_exclude_entry() {
  local entry="$1"
  local tracking_file="${2:-}"
  local git_dir
  local exclude_file
  if ! git_dir="$(git -C "$TARGET" rev-parse --git-dir 2>/dev/null)"; then
    return 0
  fi
  # Skip if the path is already gitignored (e.g. a temp/-rooted harness under an
  # existing temp/ rule) — no redundant info/exclude entry needed.
  if git -C "$TARGET" check-ignore -q "${entry%/}" 2>/dev/null; then
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
    if [ -n "$tracking_file" ]; then
      echo "$entry" >> "$tracking_file"
    fi
  fi
}

if [ "$FORCE_OVERLAY" = false ] && has_product_owned_mobile_harness; then
  install_v1_runner_assets
  SOURCE_REV="$(git -C "$SKILL_DIR" rev-parse HEAD 2>/dev/null || echo unknown)"
  CLEANUP_COMMAND="RECIPE_HARNESS_ROOT=$HARNESS_ROOT $(printf '%q' "$SCRIPT_DIR/cleanup.sh") --target $(printf '%q' "$TARGET")"
  if [ "$GIT_EXCLUDE" = true ]; then
    echo "[recipe-harness] Adding local .git/info/exclude entries (removed on cleanup): $HARNESS_ROOT/, .skills-cache/"
    add_git_exclude_entry "$HARNESS_ROOT/" "$HARNESS_DIR/added-git-exclude"
    add_git_exclude_entry ".skills-cache/" "$HARNESS_DIR/added-git-exclude"
  else
    echo "[recipe-harness] --no-git-exclude: skipping .git/info/exclude updates; harness overlay paths may show as untracked in git status."
  fi
  node -e '
    const fs = require("fs");
    const m = {
      adapter: "mobile",
      installMode: "product-owned",
      installedAt: new Date().toISOString(),
      source: {
        skillDir: process.argv[1],
        skillRevision: process.argv[2],
        runnerDir: process.argv[3],
        runnerRevision: process.argv[4],
        runnerSourceKind: process.argv[5],
        adapterRuntime: process.argv[6],
        mobileAgenticSource: null
      },
      target: process.argv[7],
      protocolVersion: "v1",
      actionManifestPath: process.argv[11] + "/action-manifest.json",
      runnerEntrypoint: process.argv[11] + "/runner/bin/metamask-recipe",
      installedPaths: [],
      harnessInstalledPaths: [process.argv[11] + "/runner", process.argv[11] + "/action-manifest.json"],
      patchedFiles: [],
      productOwnedPaths: [
        "scripts/perps/agentic",
        "app/core/AgenticService",
        "package.json",
        "app/core/NavigationService/NavigationService.ts",
        "app/components/Nav/App/App.tsx"
      ],
      backupDir: null,
      cleanupCommand: process.argv[12],
      productDiffExcludes: [
        ":(exclude)" + process.argv[10],
        ":(exclude).skills-cache"
      ],
      note: "This checkout already contains the first-party Mobile agentic harness. Skill install only writes recipe-harness metadata and must not overwrite tracked product harness files."
    };
    fs.writeFileSync(process.argv[9], JSON.stringify(m, null, 2) + "\n");
  ' "$SKILL_DIR" "$SOURCE_REV" "$METAMASK_RUNNER_DIR" "$METAMASK_RUNNER_REVISION" "$METAMASK_RUNNER_SOURCE_KIND" "$ADAPTER_DIR" "$TARGET" "$SCRIPT_DIR" "$HARNESS_DIR/manifest.json" "$HARNESS_ROOT" "$HARNESS_REL" "$CLEANUP_COMMAND"
  echo "Installed mobile recipe harness metadata only (product-owned harness detected): $HARNESS_DIR/manifest.json"
  exit 0
fi

# Full-install path: reached when the checkout lacks the bridge, or when
# --force-overlay was passed to deliberately overwrite a product-owned bridge.
if [ "$FORCE_OVERLAY" = true ] && has_product_owned_mobile_harness; then
  echo "[recipe-harness] --force-overlay: OVERWRITING tracked product harness files with the skills overlay:"
  echo "    scripts/perps/agentic, app/core/AgenticService, package.json, app/core/NavigationService/NavigationService.ts, app/components/Nav/App/App.tsx"
  echo "[recipe-harness] Files are backed up and restorable via cleanup. This replaces the checkout's in-repo agentic bridge/HUD (intended for stale or older-commit checkouts)."
fi
if [ "$GIT_EXCLUDE" = false ]; then
  echo "[recipe-harness] --no-git-exclude: skipping .git/info/exclude updates; harness overlay paths may show as untracked in git status."
fi

INSTALLED=false
INSTALL_MUTATING=false
ROLLBACK_BACKUP_DIR="$BACKUP_DIR"
ROLLBACK_STATE_FILE="$STATE_FILE"
REFRESH_BACKUP_DIR=""
REBASE_BACKUP=false

verify_installed_paths_unchanged() {
  local hash_file="$BACKUP_DIR/managed-hashes.tsv"
  if [ ! -f "$hash_file" ]; then
    return 0
  fi
  local rel expected actual conflicts=0 stale_clean=0
  while IFS=$'\t' read -r rel expected; do
    [ -n "$rel" ] || continue
    actual="$(hash_path "$rel")"
    if [ "$actual" != "$expected" ]; then
      if git -C "$TARGET" rev-parse --git-dir >/dev/null 2>&1 \
        && [ -z "$(git -C "$TARGET" status --porcelain -- "$rel")" ]; then
        echo "Mobile recipe harness managed path changed after install but is clean in git: $rel" >&2
        echo "  expected: $expected" >&2
        echo "  actual:   $actual" >&2
        stale_clean=1
      else
        echo "Refusing to refresh mobile recipe harness: managed path changed after install: $rel" >&2
        echo "  expected: $expected" >&2
        echo "  actual:   $actual" >&2
        conflicts=1
      fi
    fi
  done < "$hash_file"
  if [ "$conflicts" != "0" ]; then
    cat >&2 <<EOF
Reinstall would bless local edits as harness-managed and make cleanup unsafe.
Save/stash product changes or rerun with --allow-dirty-harness-paths if you intentionally want to overwrite and refresh harness-managed state.
EOF
    exit 1
  fi
  if [ "$stale_clean" != "0" ]; then
    cat >&2 <<EOF
Managed hashes are stale, but all changed harness-managed paths are clean in git.
This usually means the checkout was reset/rebased after a previous harness install.
Rebaselining the harness backup to the current clean checkout before refreshing.
EOF
    REBASE_BACKUP=true
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

mkdir -p "$HARNESS_DIR"

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

rollback_path() {
  local rel="$1"
  local existed="$2"
  local target_path="$TARGET/$rel"
  local backup_path="$ROLLBACK_BACKUP_DIR/$rel"
  if [ "$existed" = "1" ]; then
    if [ -e "$backup_path" ]; then
      rm -rf "$target_path"
      mkdir -p "$(dirname "$target_path")"
      cp -a "$backup_path" "$target_path"
    else
      echo "Rollback warning: missing backup for $rel at $backup_path" >&2
    fi
  else
    rm -rf "$target_path"
  fi
}

rollback_git_exclude() {
  [ -f "$ROLLBACK_BACKUP_DIR/added-git-exclude" ] || return 0
  local git_dir exclude_file tmp_file entry
  git_dir="$(git -C "$TARGET" rev-parse --git-dir 2>/dev/null || true)"
  [ -n "$git_dir" ] || return 0
  case "$git_dir" in
    /*) ;;
    *) git_dir="$TARGET/$git_dir" ;;
  esac
  exclude_file="$git_dir/info/exclude"
  [ -f "$exclude_file" ] || return 0
  tmp_file="$(mktemp)"
  cp "$exclude_file" "$tmp_file"
  while IFS= read -r entry; do
    [ -n "$entry" ] || continue
    grep -vxF "$entry" "$tmp_file" > "$tmp_file.next" || true
    mv "$tmp_file.next" "$tmp_file"
  done < "$ROLLBACK_BACKUP_DIR/added-git-exclude"
  mv "$tmp_file" "$exclude_file"
}

rollback_failed_install() {
  local code="${1:-1}"
  if [ "$INSTALL_MUTATING" != true ]; then
    exit "$code"
  fi

  set +e
  echo "Mobile recipe harness install failed; restoring backed-up product files." >&2
  if [ -f "$ROLLBACK_STATE_FILE" ]; then
    while IFS= read -r _line || [ -n "$_line" ]; do
      [[ "$_line" =~ ^[[:space:]]*(#|$) ]] && continue
      _key="${_line%%=*}"; _val="${_line#*=}"
      case "$_key" in
        SCRIPTS_EXISTED|AGENTIC_SERVICE_EXISTED|PACKAGE_JSON_EXISTED|NAVIGATION_SERVICE_EXISTED|APP_TSX_EXISTED) ;;
        *) continue ;;
      esac
      export "$_key=$_val"
    done < "$ROLLBACK_STATE_FILE"
    unset _line _key _val
    rollback_path "scripts/perps/agentic" "${SCRIPTS_EXISTED:-0}"
    rollback_path "app/core/AgenticService" "${AGENTIC_SERVICE_EXISTED:-0}"
    rollback_path "package.json" "${PACKAGE_JSON_EXISTED:-0}"
    rollback_path "app/core/NavigationService/NavigationService.ts" "${NAVIGATION_SERVICE_EXISTED:-0}"
    rollback_path "app/components/Nav/App/App.tsx" "${APP_TSX_EXISTED:-0}"
    rollback_git_exclude
  else
    echo "Rollback warning: no backup state found at $ROLLBACK_STATE_FILE" >&2
  fi
  if [ "$INSTALLED" = true ]; then
    [ -n "$REFRESH_BACKUP_DIR" ] && rm -rf "$REFRESH_BACKUP_DIR"
  else
    rm -rf "$HARNESS_DIR"
    rm -rf "$BACKUP_DIR"
  fi
  exit "$code"
}

trap 'rollback_failed_install $?' ERR

if [ ! -f "$STATE_FILE" ] || [ "$REBASE_BACKUP" = true ]; then
  TMP_BACKUP_DIR="$(mktemp -d "$HARNESS_DIR/backup.tmp.XXXXXX")"
  ACTIVE_BACKUP_DIR="$TMP_BACKUP_DIR"
  ACTIVE_STATE_FILE="$TMP_BACKUP_DIR/state.env"
  : > "$ACTIVE_STATE_FILE"
  backup_path "scripts/perps/agentic" "SCRIPTS_EXISTED"
  backup_path "app/core/AgenticService" "AGENTIC_SERVICE_EXISTED"
  backup_path "package.json" "PACKAGE_JSON_EXISTED"
  backup_path "app/core/NavigationService/NavigationService.ts" "NAVIGATION_SERVICE_EXISTED"
  backup_path "app/components/Nav/App/App.tsx" "APP_TSX_EXISTED"
  if [ "$REBASE_BACKUP" = true ] && [ -e "$BACKUP_DIR" ]; then
    ARCHIVE_DIR="$HARNESS_DIR/backup-stale.$(date -u +%Y%m%dT%H%M%SZ)"
    mkdir -p "$(dirname "$ARCHIVE_DIR")"
    mv "$BACKUP_DIR" "$ARCHIVE_DIR"
    echo "Archived stale mobile harness backup: $ARCHIVE_DIR" >&2
  else
    rm -rf "$BACKUP_DIR"
  fi
  mkdir -p "$(dirname "$BACKUP_DIR")"
  mv "$TMP_BACKUP_DIR" "$BACKUP_DIR"
  STATE_FILE="$BACKUP_DIR/state.env"
  ROLLBACK_BACKUP_DIR="$BACKUP_DIR"
  ROLLBACK_STATE_FILE="$STATE_FILE"
else
  REFRESH_BACKUP_DIR="$(mktemp -d "$HARNESS_DIR/refresh-backup.tmp.XXXXXX")"
  ACTIVE_BACKUP_DIR="$REFRESH_BACKUP_DIR"
  ACTIVE_STATE_FILE="$REFRESH_BACKUP_DIR/state.env"
  : > "$ACTIVE_STATE_FILE"
  backup_path "scripts/perps/agentic" "SCRIPTS_EXISTED"
  backup_path "app/core/AgenticService" "AGENTIC_SERVICE_EXISTED"
  backup_path "package.json" "PACKAGE_JSON_EXISTED"
  backup_path "app/core/NavigationService/NavigationService.ts" "NAVIGATION_SERVICE_EXISTED"
  backup_path "app/components/Nav/App/App.tsx" "APP_TSX_EXISTED"
  ROLLBACK_BACKUP_DIR="$REFRESH_BACKUP_DIR"
  ROLLBACK_STATE_FILE="$REFRESH_BACKUP_DIR/state.env"
fi

INSTALL_MUTATING=true

resolve_mobile_agentic_source
install_v1_runner_assets

mkdir -p "$TARGET/scripts/perps" "$TARGET/app/core"
rsync -a --delete "$MOBILE_AGENTIC_SOURCE/" "$TARGET/scripts/perps/agentic/"
rm -rf "$TARGET/app/core/AgenticService"
mkdir -p "$TARGET/app/core/AgenticService"
while IFS= read -r -d '' overlay_file; do
  rel="${overlay_file#$ADAPTER_DIR/app-overlay/app/core/AgenticService/}"
  dest_rel="${rel%.patch}"
  mkdir -p "$TARGET/app/core/AgenticService/$(dirname "$dest_rel")"
  cp "$overlay_file" "$TARGET/app/core/AgenticService/$dest_rel"
  # Exclude overlay *.test.* files: they are skills-repo tests for the overlay
  # templates and must not ship into the product checkout, where the product's
  # jest could pick them up on local runs.
done < <(find "$ADAPTER_DIR/app-overlay/app/core/AgenticService" -type f ! -name '*.test.*' -print0)

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
    'a:ios': 'scripts/perps/agentic/preflight.sh --platform ios --mode fast --wallet-setup',
    'a:android': 'scripts/perps/agentic/preflight.sh --platform android --mode fast --wallet-setup',
    'a:setup:ios': 'scripts/perps/agentic/preflight.sh --platform ios --mode clean --wallet-setup',
    'a:setup:android': 'scripts/perps/agentic/preflight.sh --platform android --mode clean --wallet-setup',
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

if [ "$GIT_EXCLUDE" = true ]; then
  echo "[recipe-harness] Adding local .git/info/exclude entries (removed on cleanup): $HARNESS_ROOT/, .skills-cache/, scripts/perps/agentic/, app/core/AgenticService/"
  add_git_exclude_entry "$HARNESS_ROOT/" "$BACKUP_DIR/added-git-exclude"
  add_git_exclude_entry ".skills-cache/" "$BACKUP_DIR/added-git-exclude"
  add_git_exclude_entry "scripts/perps/agentic/" "$BACKUP_DIR/added-git-exclude"
  add_git_exclude_entry "app/core/AgenticService/" "$BACKUP_DIR/added-git-exclude"
fi

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
INSTALL_MUTATING=false
trap - ERR
[ -n "$REFRESH_BACKUP_DIR" ] && rm -rf "$REFRESH_BACKUP_DIR"

SOURCE_REV="$(git -C "$SKILL_DIR" rev-parse HEAD 2>/dev/null || echo unknown)"
CLEANUP_COMMAND="RECIPE_HARNESS_ROOT=$HARNESS_ROOT $(printf '%q' "$SCRIPT_DIR/cleanup.sh") --target $(printf '%q' "$TARGET")"
node -e '
  const fs = require("fs");
  const m = {
    adapter: "mobile",
    installedAt: new Date().toISOString(),
    source: {
      skillDir: process.argv[1],
      skillRevision: process.argv[2],
      runnerDir: process.argv[3],
      runnerRevision: process.argv[4],
      runnerSourceKind: process.argv[5],
      adapterRuntime: process.argv[6],
      mobileAgenticSource: process.argv[11]
    },
    target: process.argv[7],
    protocolVersion: "v1",
    actionManifestPath: process.argv[13] + "/action-manifest.json",
    runnerEntrypoint: process.argv[13] + "/runner/bin/metamask-recipe",
    installedPaths: [process.argv[13] + "/runner", process.argv[13] + "/action-manifest.json", "scripts/perps/agentic", "app/core/AgenticService"],
    patchedFiles: ["package.json", "app/core/NavigationService/NavigationService.ts", "app/components/Nav/App/App.tsx"],
    backupDir: process.argv[8],
    managedHashes: process.argv[8] + "/managed-hashes.tsv",
    cleanupCommand: process.argv[14],
    productDiffExcludes: [
      ":(exclude)" + process.argv[12], ":(exclude).skills-cache",
      ":(exclude)scripts/perps/agentic", ":(exclude)app/core/AgenticService"
    ]
  };
  fs.writeFileSync(process.argv[10], JSON.stringify(m, null, 2) + "\n");
' "$SKILL_DIR" "$SOURCE_REV" "$METAMASK_RUNNER_DIR" "$METAMASK_RUNNER_REVISION" "$METAMASK_RUNNER_SOURCE_KIND" "$ADAPTER_DIR" "$TARGET" "$BACKUP_DIR" "$SCRIPT_DIR" "$HARNESS_DIR/manifest.json" "${MOBILE_AGENTIC_SOURCE:-}" "$HARNESS_ROOT" "$HARNESS_REL" "$CLEANUP_COMMAND"

echo "Installed mobile recipe harness: $HARNESS_DIR/manifest.json"
