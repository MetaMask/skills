---
name: asset-selector-cleanup
description: Remove the remaining usages of the legacy assets-migration selector module one file at a time in metamask-extension (shared/lib/selectors/assets-migration.ts) or metamask-mobile (app/selectors/assets/assets-migration.ts), and prove each removal with a local selector-usage trace. Use when migrating a file off assets-migration selectors such as getTokensControllerAllTokens, checking which files still import the legacy assets selectors or what still depends on assets-migration, working the asset selector cleanup epic, or verifying that a selector deprecation or removal actually dropped its dependents.
maturity: experimental
---

# Asset selector cleanup

Migrate files off the legacy `assets-migration` selector module, one file at a time, and prove each removal with a trace. The trace is the source of truth: a removal is done because the file dropped out of the dependency report, not because the reasoning was sound.

The root modules:

- metamask-extension: `shared/lib/selectors/assets-migration.ts`
- metamask-mobile: `app/selectors/assets/assets-migration.ts`

Every file that imports one of these directly, or reaches it through wrappers, barrels and re-exports, is a remaining dependent. The trace walks that graph with ripgrep and writes a report; migrating a file shrinks it.

Requires `node` and `rg` (ripgrep) on `PATH`. Scripts live under `.agents/skills/mms-asset-selector-cleanup/scripts/`. Trace outputs are written outside the repo (a per-user cache directory, keyed per checkout), so a run never dirties the working tree; pass `--out-dir` to place them somewhere specific.

## When To Use

- Migrating a consumer file off an assets-migration selector, or deprecating/removing an export from the root module.
- Answering "what still depends on assets-migration" — files, layers, and which migration selectors flow through each.
- Verifying a cleanup change: expected dependents gone, no new dependents, no new legacy flows.

Not for authoring new selectors (`coding/selector-patterns`) or React Compiler bail-outs (`assets/react-compiler-migration`).

## Workflow

### 1. Baseline

From the repo root (the scripts locate the repo root from any subdirectory, but the installed path below is repo-root relative):

```bash
node .agents/skills/mms-asset-selector-cleanup/scripts/baseline.mjs
```

The repo is auto-detected from the git remote or the checkout name; pass `--repo extension` or `--repo mobile` to override. The run records the commit, prints the remaining counts, and saves the trace JSON as the baseline — its path is printed (default: `<user cache>/asset-selector-cleanup/<repo>-<hash>/baseline.json`). Pass `--save <path>` to keep the baseline with the task's artifacts (missing parent directories are created). A `<baseline>.meta.json` sidecar records the checkout and commit the baseline came from; verify warns when the tree has moved on since.

Read the baseline before editing: which files remain, their layers, which migration selectors flow through each. Layer 2 rows import the root module directly; deeper layers reach it through other files. Terminal rows (components, hooks) are leaves. `remaining.files` is the cleanup total.

Exit codes: `0` baseline saved; `1` the trace ran but its status is `attention` (nothing saved — resolve what it reports, e.g. a `TRACE_MAX_LAYERS` cap, and re-run); `2` usage or environment error.

### 2. Make one change

Migrate one file off the legacy selectors — import from the module that owns the selector now. One file (or one tightly-coupled set) per verify cycle. Do not remove exports from the root module while consumers remain, and do not silence a usage by re-exporting it elsewhere.

### 3. Verify

```bash
node .agents/skills/mms-asset-selector-cleanup/scripts/verify.mjs \
  --baseline <baseline.json> \
  --expect-file ui/pages/some-page.tsx
```

Re-runs the trace on the current tree and diffs it against the baseline.

- `--expect-file <path>` (repeatable): the file must have dropped out of the report. Paths can be repo-relative, absolute, or relative to the current directory.
- `--expect-selector <path>:<migration-selector>` (repeatable): that root export must no longer flow through that path — for partial removals where the file legitimately stays in the report.

`PASS` (exit `0`) requires: every expected removal happened, no new dependents, no new legacy flows through remaining files, no new default/namespace imports of the module, and trace status `ok`. Removals beyond the expected files are reported as cascades — files that reached the root only through the file you migrated; check that they make sense. Layer shifts and shrunk imports on remaining files are reported as informational. Warnings (a baseline from another checkout, or one taken before a commit or pull) never change the verdict — take a fresh baseline when they appear.

`FAIL` (exit `1`) prints each violation (an expected file still remaining, a new dependent, a new flow). Fix or revert, then re-verify. Exit `2` is a usage or environment error.

Take a fresh baseline before the next change — each verify cycle compares against the tree as it stood before that one change.

### 4. Run the repo's own checks

The trace proves the dependency graph, not the code. Run the repo's lint, type check and focused tests on the touched files — the commands for this repo are in the overlay section at the end of this skill.

## Limitations

The trace is name-based (ripgrep plus import-statement parsing), not type-aware. Read past these known behaviors:

- Default and namespace imports are recorded as `(default or *)` (or `* as name`): the file stays a dependent of the module even when no specific migration selector is attributed to it.
- Only `import` / `export ... from` statements are discovered; `require()` and dynamic `import()` are not — switching import syntax is not a migration.
- Discovery has gaps, shared with the dashboard because it runs the same scripts: importers that reach an intermediate through a cross-directory relative path outside the `selectors`/`ducks` trees (e.g. mobile's `app/core/redux/slices/bridge` consumers), same-layer wrapper chains under mobile's `app/selectors` whose walk order loses one transitive consumer, and files whose name matches the hook pattern without being hooks (e.g. mobile's `app/selectors/user.ts`). If a `PASS` looks suspicious for a file that reaches the root through such a shape, cross-check with `rg` before trusting it. Details and reproductions: [references/tooling.md](references/tooling.md).
- `importedSymbolSlots` counts distinct imported names per file, not call sites.
- Tests, stories, spec files, snapshots, `node_modules`, `dist`, `build` and the `trace-selectors/` directory itself are excluded from discovery.

Provenance (vendored from metamask-extension `trace-selectors` with one documented patch), config format, exit codes and output files: [references/tooling.md](references/tooling.md).

## Dashboard (optional)

An unofficial, personally hosted cleanup dashboard shows the current state of `main`: https://metamask-extension-asset-selector-cleanup.vercel.app. Its API is read-only: `/api/extension/report`, `/api/mobile/report`, plus `/files` and `/graph` under each. Use it to see how `main` is trending or to sanity-check a count against your local run; verification always runs locally against your working tree, never against the dashboard.
