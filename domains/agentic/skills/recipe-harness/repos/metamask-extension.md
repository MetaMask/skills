---
repo: metamask-extension
parent: recipe-harness
---

# MetaMask Extension

Use the Extension adapter for `metamask-extension` checkouts, especially historical commits or slots where the recipe runner is absent.

## Commands

```bash
.agents/skills/mms-recipe-harness/scripts/recipe-harness.sh extension install --target .
.agents/skills/mms-recipe-harness/scripts/recipe-harness.sh extension launch --target . --cdp-port <port>
.agents/skills/mms-recipe-harness/scripts/recipe-harness.sh extension live --target . --cdp-port <port> --launch-existing-dist
.agents/skills/mms-recipe-harness/scripts/recipe-harness.sh extension verify --target . --cdp-port <port>
.agents/skills/mms-recipe-harness/scripts/recipe-harness.sh extension verify --target . --static-only
.agents/skills/mms-recipe-harness/scripts/recipe-harness.sh extension cleanup --target .
```

The same `scripts/recipe-harness.sh` path is also mirrored under `.claude/skills/mms-recipe-harness/` and `.cursor/rules/mms-recipe-harness/` for Claude/Cursor operators; examples use `.agents/skills` because Codex reads that tree.

If running from the source skills checkout instead, use:

```bash
domains/agentic/skills/recipe-harness/scripts/recipe-harness.sh extension install --target /path/to/metamask-extension
domains/agentic/skills/recipe-harness/scripts/recipe-harness.sh extension launch --target /path/to/metamask-extension --cdp-port 9222
domains/agentic/skills/recipe-harness/scripts/recipe-harness.sh extension live --target /path/to/metamask-extension --cdp-port 9222 --launch-existing-dist
domains/agentic/skills/recipe-harness/scripts/recipe-harness.sh extension verify --target /path/to/metamask-extension --cdp-port 9222
```

Use `mme-4` for Extension validation when available.

## Runtime readiness (deterministic)

Slots run `watch=off` (frozen, no watcher). Don't hand-debug — the runner decides.
Full reference: `<harness>/extension/runner/docs/extension-runtime-commands.md`.

- need? → `runtime-decision … --cdp-port <port> --json`; branch `.decision` (`install`|`build`|`relaunch`|`ready`). Don't re-parse webpack logs.
- id? → `resolve-extension …` (deterministic from dist `key`; never `serviceWorkers()[0]`).
- one healthy tab → `ensure-ready … --cdp-port <port>` after launch/reopen.

After editing source: `runtime-decision → build? → refresh-build.sh` (one-shot, no watcher) `→ ensure-ready`. Human hot-reload instead: relaunch `--watch on`.

## Runtime Dependencies

The copied Extension runner expects the target checkout to provide its normal Node dependency set, including `@playwright/test`, `@metamask/client-mcp-core`, and `ws`. If verify fails with module-resolution errors, run the repo's package install/bootstrap first; do not treat that as product behavior failure.

## Adapter Behavior

Install copies the current Extension recipe runtime under the ignored `temp/agentic/**` harness path and writes `${RECIPE_HARNESS_ROOT:-temp/agentic/recipe-harness}/extension/manifest.json`.

## Validation

See references/contract.md for the full verification checklist. Extension-specific: use `dist/chrome/manifest.json` as the build contract (not hardcoded filenames like `scripts/app-init.js` or `service-worker.js`) so historical MV2/MV3 commits are handled correctly.

## Prepare Compatibility Notes

When an orchestrator prepares an Extension checkout before running this harness:

- Strip editor-only `BUNDLED_DEBUGPY_PATH` through the orchestrator/project
  environment layer, not with product code changes. The Extension webpack CLI
  reads `BUNDLE_*` environment variables and treats that Cursor/VS Code variable
  as an unknown build option.
- Treat CDP as ready only after a `chrome-extension://<id>/...` target exists
  for the intended extension; a listening CDP port alone is not sufficient.
- Use `adapters/extension/scripts/extension-readiness.js --target <repo>
--cdp-port <port>` as the source-of-truth readiness probe when wiring
  caller-owned runners.
- If a prepare command would trigger a full rebuild, say so before starting and ask the human to approve.
