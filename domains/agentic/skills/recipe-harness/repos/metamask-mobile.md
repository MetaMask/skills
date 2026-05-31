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
first-party agentic harness, it writes metadata only and does not overwrite
tracked product files unless `--force-overlay` is explicit. On older commits
without a product-owned harness, install overlays the recipe runtime only when
`METAMASK_MOBILE_AGENTIC_SOURCE` (or `METAMASK_RECIPE_MOBILE_BRIDGE_SOURCE`) points
to a reviewed product/farm checkout or directly to its `scripts/perps/agentic`
directory. The skills repo does not bundle that product harness. Overlay install
then idempotently patches:

- `scripts/perps/agentic/**`, copied from the external Mobile bridge source.
- `package.json` with optional `a:*` aliases pointing at injected scripts.
- `app/core/NavigationService/NavigationService.ts` to install `AgenticService`.
- `app/components/Nav/App/App.tsx` to render `AgentStepHud`.

## Validation

See references/contract.md for the full verification checklist. Mobile-specific: `scripts/perps/agentic/**` backing scripts must be present from the product checkout or an explicit external Mobile bridge source (not bundled in the skills repo); direct script entrypoints must work independently of `yarn a:*`.

Use `--static-only` only for install/idempotency checks when the simulator, Metro, or CDP is unavailable.

```bash
bash scripts/perps/agentic/preflight.sh --platform ios --mode fast
bash scripts/perps/agentic/preflight.sh --platform ios --mode fast --wallet-setup --wallet-fixture .agent/wallet-fixture.json
bash scripts/perps/agentic/app-state.sh status
<external-runner>/bin/metamask-recipe run <recipe> --target <metamask-mobile>
```
