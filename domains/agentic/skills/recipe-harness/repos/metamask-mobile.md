---
repo: metamask-mobile
parent: recipe-harness
---

# MetaMask Mobile

Use the Mobile adapter for `metamask-mobile` checkouts, especially historical commits where the checked-out runner may be stale or absent.

## Commands

```bash
.agents/skills/mms-recipe-harness/scripts/recipe-harness install
.agents/skills/mms-recipe-harness/scripts/recipe-harness verify
.agents/skills/mms-recipe-harness/scripts/recipe-harness launch --platform ios --preflight-mode fast
.agents/skills/mms-recipe-harness/scripts/recipe-harness live --platform ios --preflight-mode fast
.agents/skills/mms-recipe-harness/scripts/recipe-harness verify --static-only
.agents/skills/mms-recipe-harness/scripts/recipe-harness cleanup
```

The same `scripts/recipe-harness.sh` path is also mirrored under `.claude/skills/mms-recipe-harness/` and `.cursor/rules/mms-recipe-harness/` for Claude/Cursor operators; examples use `.agents/skills` because Codex reads that tree.

If running from the source skills checkout instead, use:

```bash
domains/agentic/skills/recipe-harness/scripts/recipe-harness mobile install --target /path/to/metamask-mobile
domains/agentic/skills/recipe-harness/scripts/recipe-harness mobile launch --target /path/to/metamask-mobile --platform ios --preflight-mode fast
domains/agentic/skills/recipe-harness/scripts/recipe-harness mobile live --target /path/to/metamask-mobile --platform ios --preflight-mode fast
```

## Adapter Behavior

Install is conservative by default. On Mobile commits that already track the
in-app bridge/HUD, it writes metadata only and does not overwrite tracked
product files unless `--force-overlay` is explicit. On newer commits without a
product-owned bridge, install writes the runner into the ignored harness root
and overlays only the minimal in-app bridge/HUD needed for React Native runtime
control:

- `app/core/AgenticService/**` from the skills overlay, excluding test/spec files.
- `app/core/NavigationService/NavigationService.ts` to install `AgenticService`.
- `app/components/Nav/App/App.tsx` to render `AgentStepHud`.

Mobile CDP, wallet setup, fixture handling, screenshot, and recipe execution run
from the installed runner, not from Mobile-owned `scripts/` entries.

## Validation

See references/contract.md for the full verification checklist. Mobile-specific: the runner-owned bridge must be present through `${RECIPE_HARNESS_ROOT:-temp/agentic/recipe-harness}/mobile/runner/bin/metamask-recipe`; the Mobile checkout must not own harness control scripts.

Use `--static-only` only for install/idempotency checks when the simulator, Metro, or CDP is unavailable.

```bash
${RECIPE_HARNESS_ROOT:-temp/agentic/recipe-harness}/mobile/runner/bin/metamask-recipe actions --adapter mobile --action app.status --json
${RECIPE_HARNESS_ROOT:-temp/agentic/recipe-harness}/mobile/runner/bin/metamask-recipe run <recipe> --adapter mobile --project-root <metamask-mobile>
```
