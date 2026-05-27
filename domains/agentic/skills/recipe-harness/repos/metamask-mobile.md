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
without a product-owned harness, install overlays the recipe runtime and
idempotently patches:

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
- if Metro/app was started by Expo, direct `yarn watch`, or another shell, it is
  reused only when the ADR58 bridge and screenshots work; otherwise the harness
  explains the missing observability and reconnects through preflight.
- fixture status is printed before long debugging (`READY`,
  `MISSING_FIXTURES`, or `STALE_OR_INVALID`).
- cache/build policy is recorded in `summary.json`.

Use `--static-only` only for install/idempotency checks when the simulator,
Metro, or CDP is unavailable. Static verification is intentionally not runtime
proof.

Harness automation should call direct scripts, for example:

```bash
bash scripts/perps/agentic/preflight.sh --platform ios --mode fast
bash scripts/perps/agentic/preflight.sh --platform ios --mode fast --wallet-setup --wallet-fixture .agent/wallet-fixture.json
bash scripts/perps/agentic/app-state.sh status
bash scripts/perps/agentic/validate-recipe.sh <recipe> --artifacts-dir <dir>
```

Build rule: start with `--mode fast`. It reuses an installed matching app or
shared cache artifact and fails before a native rebuild. Escalate to
`--mode auto`, `--rebuild`, or `--clean` only after the caller/human explicitly
opts into a rebuild.

Use `yarn a:*` only after install, and only as a human convenience.
