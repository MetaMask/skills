---
repo: metamask-extension
parent: recipe-harness
---

# MetaMask Extension

Use the Extension adapter for `metamask-extension` checkouts, especially historical commits or slots where the recipe runner is absent.

## Commands

```bash
.agents/skills/mms-recipe-harness/scripts/recipe-harness.sh extension install --target .
.agents/skills/mms-recipe-harness/scripts/recipe-harness.sh extension verify --target . --cdp-port <port>
.agents/skills/mms-recipe-harness/scripts/recipe-harness.sh extension cleanup --target .
```

The same `scripts/recipe-harness.sh` path is also mirrored under `.claude/skills/mms-recipe-harness/` and `.cursor/rules/mms-recipe-harness/` for Claude/Cursor operators; examples use `.agents/skills` because Codex reads that tree.

If running from the source skills checkout instead, use:

```bash
domains/coding/skills/recipe-harness/scripts/recipe-harness.sh extension verify --target /path/to/metamask-extension --cdp-port 9222
```

Use `mme-4` for Extension validation when available.

## Runtime Dependencies

The copied Extension runner expects the target checkout to provide its normal Node dependency set, including `@playwright/test`, `@metamask/client-mcp-core`, and `ws`. If verify fails with module-resolution errors, run the repo's package install/bootstrap first; do not treat that as product behavior failure.

## Adapter Behavior

Install copies the current Extension recipe runtime under the ignored `temp/agentic/**` harness path and writes `.agent/recipe-harness/extension/manifest.json`.

## Validation

For live runtime proof, verify that:

- CDP connects to the intended browser;
- the extension service worker is discoverable;
- one non-UI sample recipe passes;
- one UI/browser target-inspect sample passes when feasible;
- product diffs exclude `temp/agentic/**` and harness files.

Use command recipes for reducers, selectors, controllers, migrations, build/config checks, and other non-UI claims. Use browser/UI actions only for visible Extension behavior.
