---
repo: metamask-mobile
parent: recipe-harness
---

# MetaMask Mobile

Use the Mobile adapter for `metamask-mobile` checkouts, especially historical commits where the checked-out runner may be stale or absent.

## Commands

```bash
.agents/skills/mms-recipe-harness/scripts/recipe-harness.sh mobile install --target .
.agents/skills/mms-recipe-harness/scripts/recipe-harness.sh mobile verify --target .
.agents/skills/mms-recipe-harness/scripts/recipe-harness.sh mobile verify --target . --static-only
.agents/skills/mms-recipe-harness/scripts/recipe-harness.sh mobile cleanup --target .
```

The same `scripts/recipe-harness.sh` path is also mirrored under `.claude/skills/mms-recipe-harness/` and `.cursor/rules/mms-recipe-harness/` for Claude/Cursor operators; examples use `.agents/skills` because Codex reads that tree.

If running from the source skills checkout instead, use:

```bash
domains/agentic/skills/recipe-harness/scripts/recipe-harness.sh mobile install --target /path/to/metamask-mobile
```

## Adapter Behavior

Install overlays the current Mobile recipe runtime and idempotently patches:

- `scripts/perps/agentic/**`, including start/preflight, CDP, wallet, screenshot, and recipe scripts.
- `package.json` with optional `a:*` aliases pointing at injected scripts.
- `app/core/NavigationService/NavigationService.ts` to install `AgenticService`.
- `app/components/Nav/App/App.tsx` to render `AgentStepHud`.

## Validation

For live runtime proof, verify that:

- the simulator/device and Metro state are known;
- CDP connects;
- `globalThis.__AGENTIC__` exists;
- route read and `app-state.sh status` work;
- wallet fixture setup/unlock works when fixture data exists;
- screenshot capture works;
- a tiny recipe emits `summary.json`, `trace.json`, and `artifact-manifest.json`.

Use `--static-only` only for install/idempotency checks when the simulator,
Metro, or CDP is unavailable. Static verification is intentionally not runtime
proof.

Harness automation should call direct scripts, for example:

```bash
bash scripts/perps/agentic/preflight.sh --platform ios --wallet-setup --mode fast
bash scripts/perps/agentic/app-state.sh status
bash scripts/perps/agentic/validate-recipe.sh <recipe> --artifacts-dir <dir>
```

Use `yarn a:*` only after install, and only as a human convenience.
