---
name: recipe-harness
description: Install, verify, and clean up MetaMask recipe runtimes for Mobile and Extension checkouts. Use before recipe-cook, recipe-wallet-control, recipe-evidence, or recipe-quality when runtime evidence needs CDP/browser/mobile recipe execution, especially on historical commits or fresh checkouts.
maturity: experimental
---

# Recipe Harness

`recipe-harness` makes a product checkout recipe-capable without making the product repo permanently own the runtime files.

The skill is a thin UX wrapper. It does **not** define the graph executor or final runtime source. Install resolves a MetaMask recipe runner package/source, copies that runner into the ignored checkout overlay, and records the resolved source in `${RECIPE_HARNESS_ROOT:-temp/agentic/recipe-harness}/<adapter>/manifest.json`.

Runner source resolution order:

1. `METAMASK_RECIPE_RUNNER_SOURCE`
2. `RECIPE_RUNNER_SOURCE`
3. `METAMASK_RECIPE_RUNNER_PACKAGE_DIR`
4. sibling checkout `../metamask-recipe-runner` next to `metamask-skills`

The runner is a separate project. It only resolves a runner source, copies it into `${RECIPE_HARNESS_ROOT:-temp/agentic/recipe-harness}/<adapter>/runner/`, and records the source path/revision in the install manifest.

## Rules

- Run `install` before claiming runtime recipe proof.
- Run `verify`; failed harness verification blocks runtime claims and is not a product failure.
- Keep product diffs/evidence separate from harness overlay files.
- Record the harness manifest path, source version, adapter, verification status, and artifacts in PR evidence. See references/contract.md (source revision caveat).
- Call direct injected scripts for automation. `yarn a:*` aliases are developer convenience only.
- Treat "app/browser is open" as insufficient. Verification must prove the Recipe v1 observability layer is present: CDP target, recipe bridge, log capture, screenshot capture, fixture/profile status, and cleanup ownership.
- Avoid full rebuilds by default. Reuse an already-compatible harness runtime, installed app, shared build cache, Expo/native build artifacts, or Extension watch output before starting expensive builds. Mobile verify defaults to `--preflight-mode fast`; only use `auto`, `rebuild-native`, or `clean` after the caller/human explicitly opts into a rebuild.
- Report fixture status before long runtime debugging. If fixtures are missing, tell the human the run may spend time repairing wallet/perps state manually and give the exact fixture setup path.

## Consent gates (ask the human first)

`recipe-harness` runs headless and never prompts. Two install actions change local state outside the ignored overlay and **require explicit user confirmation before you invoke them** — surface exactly what will change and wait for a yes:

1. **Overwriting the in-repo agentic bridge/HUD** (`install --force-overlay`). This replaces tracked product files (`scripts/perps/agentic`, `app/core/AgenticService`, `package.json`, `app/core/NavigationService/NavigationService.ts`, `app/components/Nav/App/App.tsx`) with the skills overlay. It is the intended way to refresh a stale or older-commit checkout to the current bridge/HUD, but it mutates product-owned source — confirm first. Files are backed up and restored by `cleanup`.
2. **Adding local `.git/info/exclude` entries.** Install appends harness paths (`${RECIPE_HARNESS_ROOT:-temp/agentic/recipe-harness}/`, `.skills-cache/`, `temp/agentic/recipe-harness/`, and on a full install `scripts/perps/agentic/`, `app/core/AgenticService/`) to the checkout's local exclude so overlay files don't surface as untracked. Entries are tracked and removed by `cleanup`. Pass `--no-git-exclude` to skip. Confirm before mutating a checkout's git config.

Default (no `--force-overlay`) is non-destructive: a product-owned checkout keeps its own source and install writes only ignored metadata. Prefer that path unless the human approved an overwrite.

## Command Shape

For humans, prefer the portable smart wrapper from either the source skill checkout or the installed target skill. Do not require personal shell aliases; call the skill-owned script by path:

```bash
<skill-dir>/scripts/recipe-harness                  # auto-detect current repo and install
<skill-dir>/scripts/recipe-harness launch --platform ios --preflight-mode fast
<skill-dir>/scripts/recipe-harness live --platform ios --preflight-mode fast
<skill-dir>/scripts/recipe-harness launch --platform android --preflight-mode fast
<skill-dir>/scripts/recipe-harness live --cdp-port <port> --out <task-local-recipes>
<skill-dir>/scripts/recipe-harness verify --static-only
<skill-dir>/scripts/recipe-harness verify --cdp-port <port>
<skill-dir>/scripts/recipe-harness verify --preflight-mode fast
```

`recipe-harness` auto-detects `metamask-mobile` vs `metamask-extension`, defaults `--target` to the current directory, prints progress, and defaults to `install` when no action is supplied. `launch` starts or reuses the app/browser runtime and waits for app-control readiness; it does not run a recipe or claim validation evidence.

Use `live` when a developer wants the easiest manual validation command: it runs `launch` and then live `verify` in one skill-owned command, writing a top-level `summary.json` that links to both phases.

For Mobile launch/live verification, `--preflight-mode fast` is the default cache-first mode: it can reuse an installed matching app or a shared cache artifact, but it fails instead of launching a native rebuild. If a rebuild is genuinely needed, the caller should rerun explicitly with `--preflight-mode auto` after the human accepts the rebuild cost.

For Extension launch/live:

- Reuse an open CDP runtime with `--cdp-port`, or pass a startup command via `--prepare-cmd` / `RECIPE_HARNESS_EXTENSION_LAUNCH_CMD`.
- Or provide `RECIPE_RUNTIME_CONTEXT` / `temp/runtime/agentic-runtime.json` with `runtimeStart.approved: true` and `runtimeStart.command`; the wrapper forwards it as `--prepare-cmd`. Outside managed runtimes, set `RECIPE_RUNTIME_START_APPROVED=1` plus `RECIPE_RUNTIME_START_CMD`.
- If recipes were installed to a task-local path, pass it with `live --out <task-local-recipes>` to avoid falling back to stale defaults.
- Do not invent a build command if no startup approval is present.
- `live --cdp-port <port> --launch-existing-dist` launches Chrome against an already-built `dist/chrome`.
- `live --cdp-port <port> --start-test-watch` starts test watch then Chrome; use only after caller/human accepted the build cost.

For orchestration or explicit automation, keep using the low-level stable form:

```bash
<skill-dir>/scripts/recipe-harness.sh <mobile|extension> <install|launch|live|verify|cleanup> --target <repo> [...]
```

See `references/contract.md` for the manifest and validation contract.
