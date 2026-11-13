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
a new documented patch here. `references/vendored-checksums.json` records the SHA-256
of every vendored file and the skills-repo test suite
(`test/asset-selector-cleanup.test.mjs`) asserts the copies match, so accidental
edits fail the build, and a deliberate re-vendor has to consciously update the
checksum record, which review sees. The recorded hashes were verified against the
vendored copy in the dashboard repo at the time of vendoring; they do not
continuously prove equivalence to upstream in CI, and the inline diff below remains
the authoritative statement of the delta — the fork link is convenience. Validate an
installed copy any time:

```bash
node --test .agents/skills/mms-asset-selector-cleanup/scripts/tooling.test.js
```

That vendored self-test covers the upstream scripts' own fixtures. The patch below is
not exercised by it; it is exercised by the skills-repo test suite (the fixture's
`../selectors/wallet` importers resolve through the patched tree-root search), which
is what actually guards this delta.

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
`4f43cc1cdf39cfdada1c478faeab70acb0faa1ee` gained one genuinely missed file
(`ui/ducks/index.js`, reached through the sibling import
`ui/ducks/bridge/selectors.ts` -> `../metamask/metamask`): remaining files went
from 145 to 146 at that commit, at the time of vendoring. Any commit-specific
number in this file is a point-in-time regression anchor, not a live fact.

The tree-root search requires the `selectors`/`ducks` segment to be nested under a
parent directory (`treeIndex > 0`): a source file directly inside a top-level
`selectors/` or `ducks/` tree gets no tree-root search. Neither configured root has
that shape (extension uses `ui/` and `shared/lib/`, mobile uses `app/`).

To check the vendored bytes against upstream yourself, where `<upstream>` is a
checkout of metamask-extension:

```bash
git -C <upstream> show 44caf77473de8813090f6efa2081b213cfb0cf51:trace-selectors/scripts/<file> | shasum -a 256
```

applied for every file except `find-importers.js`, whose upstream hash must be
compared after applying the diff above; the results should match
`references/vendored-checksums.json`.

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

Wrapper behavior worth knowing:

- Default output directory: `$XDG_CACHE_HOME/asset-selector-cleanup/<repoId>-<sha256-8 of the repo root>`
  (falling back to `~/.cache/...`), one directory per checkout, outside the repo so
  runs never dirty the working tree. `--out-dir` overrides it.
- `baseline.mjs --save <path>` creates missing parent directories and writes a
  `<baseline>.meta.json` sidecar recording `{repoId, repoRoot, head}`. `verify.mjs`
  reads it when present and reports warnings when the baseline came from another
  checkout, or from before a commit or pull. A baseline without a sidecar — anything
  not written by `baseline.mjs`, e.g. a dashboard snapshot — also warns about its
  unknown provenance. Warnings never change the verdict — but take a fresh baseline
  when they appear.
- Relative `--baseline` values are file paths resolved against the current
  directory. Relative `--expect-file` and `--expect-selector` paths resolve against
  the current directory and then normalize to repo-relative module paths; absolute
  `--expect-*` values normalize the same way, with symlinked prefixes resolved so a
  logical `$PWD` from a symlinked checkout still matches.

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
- Only `import` / `export ... from` statements are discovered. `require()` and dynamic
  `import()` are not; switching import syntax is not a migration.
- Default and namespace imports show as `(default or *)` / `* as name` and keep the
  file in the report without attributing specific migration selectors. Verify's
  `new broad import` check recognizes those sentinel spellings via
  `isBroadImportSymbol` in `run-trace.mjs`, which centralizes the wrapper's copy;
  the vendored scripts carry their own copies of the same three spellings
  (`trace-usage.js`, `find-importers.js`) and must stay in sync — a re-vendor that
  renames them breaks loudly in the tests, not silently in verdicts.
- Importers of `index.*` intermediates that spell the import without the trailing
  `/index` are always missed, in any directory: the non-barrel rg pattern requires
  the specifier to end with the module path including `/index`, and the relative
  fallback (own directory, plus the patched tree-root search) resolves the
  specifier to the directory and filters it out against the module key, which
  keeps the `/index`. Confirmed against mobile at commit `2bc18ed`, at the time of
  vendoring: every consumer of
  `app/selectors/bridge/index.ts` spells it `../selectors/bridge` and is missing
  from the trace, and the consumers of `app/core/redux/slices/bridge/index.ts`
  (`app/util/bridge/hooks/useSubmitBridgeTx.ts`,
  `app/components/Views/Homepage/components/HomepageActionButtonsGrid/buttons/BatchSwapButton.tsx`,
  `app/selectors/bridgeController/index.ts`,
  `app/core/DeeplinkManager/handlers/legacy/handleBatchSellUrl.ts`) are missing
  the same way. The dashboard runs the same scripts, so its counts share the gap;
  the reference counts in this skill's evidence match the dashboard because both
  miss the same files.
- Independently of the above, relative importers of a non-`index` intermediate
  from another directory are only found when the specifier contains the
  module's repo-relative path (the non-barrel pattern matches full path suffixes)
  or the intermediate sits in the importer's own directory or `selectors`/`ducks`
  tree (the patched searches). A `../../util/assets`-style specifier for
  `app/util/assets.ts` from elsewhere is invisible.
- `classify-file.js` marks any file named `use*.ts(x)`/`use*.js(x)` (case-insensitive)
  or under a `hooks/` directory as a terminal hook before considering its `selectors/`
  path, so a non-hook selector file with a `use…` name (mobile's `app/selectors/user.ts`)
  would be classified terminal and its own dependents never walked. No traced file in
  either repo is affected today; the shape is a live footgun for new files.
- The alias/wrapper warm-up in `migration-seeds.js` walks extension-shaped directories
  (`ui/selectors`, `ui/ducks`, `shared/lib/selectors`, `app/scripts`); files outside
  them — all of mobile's `app/selectors` — are indexed lazily, once, in walk order.
  A wrapper file whose seeds are computed before a same-layer file it imports from
  never records that import's derived exports, so consumers importing those exports
  through it are dropped. Reproduced: with `app/selectors/a.ts` importing both the
  root and `./z` (itself importing the root), `a.ts` is ensured before `z.ts`
  (alphabetical, same layer) and a consumer importing only `a.ts`'s `aBalance`
  (derived from `z`'s `zBalance`) never enters the trace, while the equivalent
  consumer of `z.ts` does. Chains where the imported wrapper was already indexed —
  earlier layers, or alphabetical order that puts the dependency first — are traced
  fully (the skills-repo test pins such a chain: `portfolio.ts` -> `wallet.ts` ->
  root, with the layer-4 consumer present). The dashboard shares this gap.
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
  from the config. The same is true of the report header's self-reference to
  `trace-selectors/scripts/trace-usage.js`, a path that exists upstream but not in an
  installed copy of this skill.
- Test files (`*.test.*`, `*.spec.*`, `*.stories.*`, `__tests__`, `__snapshots__`), the
  `trace-selectors/` directory itself, `node_modules`, `dist` and `build` trees are
  excluded from discovery, so a selector used only from tests is invisible to the
  trace.

## Completion file (migrated files)

The dashboard tracks cross-scan progress with a `completionFile` listing already
migrated paths, so its reports show only remaining work. This skill does not ship one:
the baseline-diff workflow replaces it (the report reflects the actual code, so a
migrated file drops out on its own), and the wrapper never reads a completion file. To
reproduce a dashboard count locally, account for its current completion list; at the
time of vendoring, the snapshots at extension `4f43cc1` / mobile `2bc18ed` carried an
empty list and local counts matched the dashboard exactly.
