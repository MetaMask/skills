# Trace tooling: provenance and reference

## Provenance

`scripts/` (everything except `baseline.mjs`, `verify.mjs`, `run-trace.mjs` and the two
`config.metamask-*.json` files) is a byte-for-byte copy of the selector-usage trace
tooling from metamask-extension at commit
`44caf77473de8813090f6efa2081b213cfb0cf51`, carrying one documented patch (below).

- Upstream: https://github.com/MetaMask/metamask-extension/tree/44caf77473de8813090f6efa2081b213cfb0cf51/trace-selectors
- Vendored copy (immediate source, with its `VENDORED.md` documenting the same patch):
  https://github.com/Prithpal-Sooriya/metamask-extension-asset-selector-cleanup under
  `vendor/trace-selectors/`

The scripts are CommonJS with no dependencies beyond `node` and `rg` (ripgrep) on
`PATH`. `scripts/package.json` (`{"type": "commonjs"}`) travels with them so they keep
running under a consumer repo regardless of that repo's own module mode.

Do not modify the vendored scripts to hide drift from upstream — fix upstream or carry
a new documented patch here. Validate an installed copy any time:

```bash
node --test .agents/skills/mms-asset-selector-cleanup/scripts/tooling.test.js
```

## The find-importers patch

`scripts/find-importers.js` carries one patch on top of the vendored commit. Upstream
discovers relative importers with `--source-file` only inside the source file's own
directory, so a module nested under a `selectors/<subdir>/` root (mobile's
`app/selectors/assets/assets-migration.ts`) misses every importer that spells the
import as `./assets/...` or `../assets/...` from a sibling or parent directory. The
patch additionally searches relative imports under the enclosing `selectors`/`ducks`
tree root; resolution against the source file still filters the matches:

```diff
   let files = runRg(pattern, rootAbs);
   if (!barrelMode && sourceFile) {
     const sourceDir = path.resolve(process.cwd(), path.dirname(sourceFile));
     if (fs.existsSync(sourceDir)) {
       files = files.concat(runRg(`from\\s+['"]\\.[^'"]+['"]`, sourceDir));
+      const segments = toRepoPath(sourceFile).split('/');
+      const treeIndex = segments.findIndex((segment) => segment === 'selectors' || segment === 'ducks');
+      if (treeIndex > 0) {
+        const treeRoot = path.resolve(process.cwd(), segments.slice(0, treeIndex + 1).join('/'));
+        if (treeRoot !== sourceDir && fs.existsSync(treeRoot)) {
+          files = files.concat(runRg(`from\\s+['"]\\.[^'"]+['"]`, treeRoot));
+        }
+      }
     }
   }
```

With this patch the metamask-extension trace at commit
`4f43cc1cdf39cfdada1c478faeab70acb0faa1ee` gains one genuinely missed file
(`ui/ducks/index.js`, reached through the sibling import
`ui/ducks/bridge/selectors.ts` -> `../metamask/metamask`): remaining files go from
145 to 146.

A discovered importer can land in the trace with `selectors: ["(default or *)"]` and
an empty `migrationSelectors` list. That is upstream classification, not a patch
effect: any import of a traced module joins the dependency graph, and a default or
namespace import is treated as potentially carrying every export. `migrationSelectors`
then records which root exports actually flow through; empty means the file depends on
the module but no traced export reaches it.

## Skill-local additions and adaptations

Not vendored from upstream:

- `run-trace.mjs`, `baseline.mjs`, `verify.mjs` — thin wrappers around `trace-usage.js`
  that detect the repo, pick the matching config, write outputs outside the repo, save
  a baseline, and diff a fresh run against it (the verify verdict).
- `config.metamask-extension.json`, `config.metamask-mobile.json` — the two repo
  configs. The extension config is upstream's example `config.assets-controllers.json`
  renamed, with the `completionFile` key dropped (the skill's baseline-diff workflow
  replaces completion tracking — see "Completion file" below) and `output` omitted (the
  wrapper always sets it). The mobile config follows the dashboard's locally authored
  one: same scripts, mobile root.

Not shipped from the upstream directory: `prompts/` (upstream's agent instructions —
this skill replaces them), `completed.txt` and `completion-file.example.txt` (upstream
example completion lists), `output/` (upstream sample reports), `README.md` and
`CONFIG.md` (upstream docs, condensed into this file).

## Config format

Configs are JSON, consumed by `trace-usage.js --config <path>` with the repo root as
the working directory:

| Field            | Type   | Required | Description |
|------------------|--------|----------|-------------|
| `output`         | string | No       | Path for the markdown report, relative to the repo root. Default: `trace-selectors/output/selector-usage-trace-<config-file-name>.md`. The JSON summary and CSVs always land beside it (see "Outputs"). |
| `roots`          | array  | Yes      | Root entries: `{ "file": <repo-relative path>, "selectors"?: string[] }`. Without `selectors`, every export of the file is tracked. |
| `completionFile` | string | No       | One migrated file path per line; listed files are excluded from the report so re-runs show remaining work. Completed non-terminal files stay in the walk so their consumers are still reported. |

`TRACE_MAX_LAYERS` caps walk depth (omit or `0` for no limit). A capped or otherwise
incomplete run sets the JSON `status` to `attention`; the wrapper scripts treat that as
a failed baseline, not a partial one.

## Outputs (written by `trace-usage.js`)

Given a config `output` of `<dir>/<name>.<ext>`, the markdown report is written to that
exact path, and the machine outputs to `<dir>/<name>` with their own extensions:
`<name>.json`, `<name>.by-type.csv`, `<name>.by-selector.csv`,
`<name>.by-migration-selector.csv`.

| File | Purpose |
|------|---------|
| `.md` | Human-readable layer-by-layer trace. |
| `.json` | Machine summary, schema version 3. `status` is `ok` or `attention`. `remaining.files` is the cleanup total. `edges` is the import tree; `files` the per-file roll-up. |
| `.by-type.csv` | Columns `type,files`. |
| `.by-selector.csv` | Columns `selector,files` — the imported names. |
| `.by-migration-selector.csv` | Columns `selector,files` — the root exports those names trace back to. |

A second run with the same tree rewrites the same bytes; the JSON carries no timestamp
or commit, so baselines and fresh runs compare cleanly. `selectors` are the names as
imported (aliases stay aliases); `migrationSelectors` are the root exports behind them.
`edges[].lines` / `files[].lines` are 1-based lines of the `import`/`export ... from`
keyword in the consumer. (The dashboard's mobile config points `output` at a `.json`
path, which makes the JSON land there and the markdown get overwritten by it — a
dashboard quirk, not one this skill copies; the wrapper always sets a distinct `.md`
path.)

Exit codes for `trace-usage.js`: `0` report complete; `1` bad config or missing root;
`2` `rg` missing; `3` JSON `status` is `attention` (summary files are still written).
The wrapper scripts exit `0` on success/`PASS`, `1` on a failed baseline or `FAIL`
verdict, `2` on usage or environment errors.

## Known limitations

- Name-based matching: an import is attributed by specifier text and imported names,
  not by resolved types. A local module that happens to share a path suffix with the
  root can only appear if the specifier literally matches; false positives are filtered
  by resolving relative imports against the source file.
- Default and namespace imports show as `(default or *)` / `* as name` and keep the
  file in the report without attributing specific migration selectors.
- Directory-specifier imports of a `selectors`/`ducks` barrel (e.g.
  `from '../selectors'`) are only followed when the barrel resolves under `ui/`
  (`ui/selectors/index.*`, `ui/ducks/index.*`) and the importer also lives under
  `ui/` — the extension layout. metamask-mobile has no `app/selectors/index.ts`
  and no directory-barrel imports of `app/selectors`, so nothing is missed there
  today; a new directory-barrel import outside `ui/` would be invisible to the
  trace. Importers that spell the module path itself (e.g.
  `from '../selectors/wallet'`) are always found.
- `importedSymbolSlots` counts distinct imported names per file, not call sites.
- `summary.js` hardcodes the metamask-extension root path inside the report's
  `metricsNote` string, so a mobile run carries the extension path in that one
  descriptive field. Every field that drives counts or the cleanup prompts is derived
  from the config.
- The alias/wrapper warm-up in `migration-seeds.js` walks extension-shaped directories
  (`ui/selectors`, `ui/ducks`, `shared/lib/selectors`, `app/scripts`); files outside
  them, including all of mobile's `app/selectors`, are indexed lazily during the walk
  and still traced fully.
- Test files (`*.test.*`, `*.spec.*`, `*.stories.*`, `__tests__`, `__snapshots__`), the
  `trace-selectors/` directory itself, `node_modules`, `dist` and `build` trees are
  excluded from discovery, so a selector used only from tests is invisible to the
  trace.

## Completion file (migrated files)

The dashboard tracks cross-scan progress with a `completionFile` listing already
migrated paths, so its reports show only remaining work. This skill does not ship one:
the baseline-diff workflow replaces it (the report reflects the actual code, so a
migrated file drops out on its own), and the wrapper never reads a completion file. To
reproduce a dashboard count locally, account for its current completion list; as of the
snapshots at extension `4f43cc1` / mobile `2bc18ed` that list is empty and local counts
match the dashboard exactly.
