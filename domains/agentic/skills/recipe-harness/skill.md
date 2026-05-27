---
name: recipe-harness
description: Install, verify, and clean up MetaMask recipe runtimes for Mobile and Extension checkouts. Use before recipe-cook, recipe-wallet-control, recipe-evidence, or recipe-quality when runtime evidence needs CDP/browser/mobile recipe execution, especially on historical commits or fresh checkouts.
maturity: experimental
---

# Recipe Harness

`recipe-harness` makes a product checkout recipe-capable without making the product repo permanently own the runtime files.

This is an extraction/overlay of the working runtimes, not a downgraded generic runner. Installed skills mirror the shared `adapters/` bundle for self-contained use; follow the target repo overlay to choose `mobile` or `extension`.

## Rules

- Run `install` before claiming runtime recipe proof.
- Run `verify`; failed harness verification blocks runtime claims and is not a product failure.
- Keep product diffs/evidence separate from harness overlay files.
- Record the harness manifest path, source version when available, adapter, verification status, and artifacts in PR evidence. If installed from a copied skill, `source.revision` may be `unknown`; record the installed skill path and PR/branch instead.
- Call direct injected scripts for automation. `yarn a:*` aliases are developer convenience only.
- Treat "app/browser is open" as insufficient. Verification must prove the ADR58 observability layer is present: CDP target, recipe bridge, log capture, screenshot capture, fixture/profile status, and cleanup ownership.
- Avoid full rebuilds by default. Reuse an already-compatible harness runtime, installed app, shared build cache, Expo/native build artifacts, or Extension watch output before starting expensive builds. Mobile verify defaults to `--preflight-mode fast`; only use `auto`, `rebuild-native`, or `clean` after the caller/human explicitly opts into a rebuild.
- Report fixture status before long runtime debugging. If fixtures are missing, tell the human the run may spend time repairing wallet/perps state manually and give the exact fixture setup path.

## Command Shape

For humans, prefer the portable smart wrapper from either the source skill checkout or the installed target skill. Do not require personal shell aliases; call the skill-owned script by path:

```bash
<skill-dir>/scripts/recipe-harness                  # auto-detect current repo and install
<skill-dir>/scripts/recipe-harness launch --platform ios --preflight-mode fast
<skill-dir>/scripts/recipe-harness live --platform ios --preflight-mode fast
<skill-dir>/scripts/recipe-harness launch --platform android --preflight-mode fast
<skill-dir>/scripts/recipe-harness live --cdp-port <port> --launch-existing-dist
<skill-dir>/scripts/recipe-harness verify --static-only
<skill-dir>/scripts/recipe-harness verify --cdp-port <port>
<skill-dir>/scripts/recipe-harness verify --preflight-mode fast
```

`recipe-harness` auto-detects `metamask-mobile` vs `metamask-extension`, defaults `--target` to the current directory, prints progress, and defaults to `install` when no action is supplied. `launch` starts or reuses the app/browser runtime and waits for app-control readiness; it does not run a recipe or claim validation evidence.

Use `live` when a developer wants the easiest manual validation command: it runs `launch` and then live `verify` in one skill-owned command, writing a top-level `summary.json` that links to both phases.

For Mobile launch/live verification, `--preflight-mode fast` is the default cache-first mode: it can reuse an installed matching app or a shared cache artifact, but it fails instead of launching a native rebuild. If a rebuild is genuinely needed, the caller should rerun explicitly with `--preflight-mode auto` after the human accepts the rebuild cost.

For Extension launch/live, the skill does not encode local farm aliases. Reuse an already-open CDP runtime with `--cdp-port`, pass a caller-owned startup command through `--prepare-cmd` / `RECIPE_HARNESS_EXTENSION_LAUNCH_CMD`, or use `live --cdp-port <port> --launch-existing-dist` to launch Chrome against an already-built `dist/chrome`. If no compatible `dist/chrome` exists, `live --cdp-port <port> --start-test-watch` starts the repo's test watch before launching Chrome; use that only when the caller/human accepted the build/watch cost.

For orchestration or explicit automation, keep using the low-level stable form:

```bash
<skill-dir>/scripts/recipe-harness.sh <mobile|extension> <install|launch|live|verify|cleanup> --target <repo> [...]
```

See `references/contract.md` for the manifest and validation contract.
