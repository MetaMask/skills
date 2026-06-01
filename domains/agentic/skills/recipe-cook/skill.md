---
name: recipe-cook
description: Author, run, and refine executable per-PR validation recipes for MetaMask work. Use when an agent needs to turn acceptance criteria, changed behavior, or reviewer requests into a portable recipe graph with concrete proof targets, project-native actions, and reviewable artifacts. Recipes may use recipe-wallet-control when available, but must not depend on it.
maturity: experimental
---

# Recipe Cook

`recipe-cook` turns PR claims into executable validation recipes: small graphs that map acceptance criteria to project-native actions, assertions, and reviewable artifacts.

Load only the files needed for the target repo:

- Canonical protocol: `$FARMSLOT_ROOT/docs/RECIPE-PROTOCOL-V1.md`
- Skill-local recipe format summary: `references/recipe-v1.md`
- Mobile-first recipe examples and composition patterns: `references/examples.md`
- Evidence package shape: `references/evidence-package.md`
- Runtime harness: use `/recipe-harness` before claiming live Mobile or Extension recipe proof.
- Action catalog: after `/recipe-harness install`, read `${RECIPE_HARNESS_ROOT:-temp/agentic/recipe-harness}/<adapter>/action-manifest.json`; use only manifest-declared v1 action names.
- Runner CLI: run recipes through `${RECIPE_HARNESS_ROOT:-temp/agentic/recipe-harness}/<adapter>/runner/bin/metamask-recipe run ...`, then validate artifacts with `farmslot-recipe validate ...`.
- Target-repo instructions are appended below when installed.



## Composition and Start-State Contract

Production recipes should be composed like small programs, not written as one long automation script. The default shape is:

1. declare proof targets from ACs;
2. call idempotent `ensure_*` setup/start-state flows;
3. run the smallest AC-specific proof flow;
4. assert the settled result;
5. capture reviewer-visible evidence;
6. teardown only what the recipe created.

Use parameterized `ensure_*` flows for reusable convergence; do not create separate positive/negative or route-specific flows when one typed parameter covers the same domain concept. An ensure flow may inspect current state, perform only the transitions needed, and must prove its postcondition before continuing. Do not inline repeated wallet unlock, network/provider selection, navigation, or position setup in every recipe when the runner publishes a domain flow.

For MetaMask Perps, prefer the installed manifest's current executable actions. Today that means direct `metamask.*` action nodes; use `call` only when the installed manifest explicitly advertises flow-catalog support.

```json
{
  "action": "metamask.perps.start_state",
  "phase": "start_state",
  "network": "testnet",
  "provider": "hyperliquid",
  "page": "positions",
  "market": "BTC",
  "positions": { "state": "none", "mode": "matching" },
  "orders": { "state": "none", "mode": "matching" }
}
```

`metamask.perps.start_state` is the Perps convergence point for starting page, mainnet/testnet, provider selection, optional market, and optional position/order precondition. Other teams should publish equivalent domain start-state actions or catalogs, for example `checkout.ensure_cart`, `orders.ensure_seeded`, or `cli.ensure_logged_in`.

## Mobile-First Quick Example

For Mobile, start with a small proof-target map, then compose existing flows or actions:

- PT-1: app is reachable on the intended simulator/device.
- PT-2: the target screen can be opened through the UI/navigation layer.
- PT-3: the changed state is asserted after a real wait condition.
- PT-4: reviewer-visible evidence is captured after the assertion.

Minimal Mobile smoke recipe shape:

```json
{
  "schema_version": 1,
  "title": "Mobile smoke — wallet view is reachable",
  "description": "Proves the debug Mobile app is reachable and the v1 runner can drive the bridge to a settled wallet screen.",
  "validate": {
    "workflow": {
      "pre_conditions": ["mm-4 or another intended simulator is booted", "debug app is installed"],
      "entry": "status",
      "nodes": {
        "status": {
          "action": "app.status",
          "description": "PT-1: read app status (device, platform, route) through the v1 app.status action",
          "timeout_ms": 30000,
          "next": "ensure-unlocked"
        },
        "ensure-unlocked": {
          "action": "metamask.wallet.ensure_unlocked",
          "description": "PT-1: idempotently reach an unlocked wallet before navigating",
          "timeout_ms": 45000,
          "next": "navigate-wallet"
        },
        "navigate-wallet": {
          "action": "ui.navigate",
          "description": "PT-2: open the wallet view through the UI/navigation layer",
          "route": "WalletView",
          "timeout_ms": 30000,
          "next": "wait-wallet"
        },
        "wait-wallet": {
          "action": "ui.wait_for",
          "description": "PT-3: after navigation settles, the wallet screen is present",
          "test_id": "wallet-screen",
          "expected": "present",
          "timeout_ms": 30000,
          "next": "capture"
        },
        "capture": {
          "action": "ui.screenshot",
          "description": "PT-4: reviewer-visible settled wallet screen",
          "path": "screenshots/mobile-smoke-wallet.png",
          "next": "index-artifacts"
        },
        "index-artifacts": {
          "action": "index_artifacts",
          "description": "Index the screenshot proof",
          "artifacts": ["screenshots/"],
          "next": "done"
        },
        "done": { "action": "end", "status": "pass" }
      }
    }
  }
}
```

For product recipes, replace the smoke nodes with the v1 actions for the PR's claim: navigate first (`ui.navigate`), wait for settled state (`ui.wait_for`), assert state/UI (`assert_json`, or a `metamask.*` read + assert action), then capture evidence (`ui.screenshot`). Compose reusable `metamask.wallet.*` / `metamask.perps.*` setup/start-state actions where the installed manifest advertises them. See `references/examples.md` for concrete Mobile composition patterns.

## When to Use

Use this skill for PRs that need runtime proof, reproducible evidence, or a repeatable reviewer flow. Skip recipe authoring only when the change is static-only and ordinary lint/type/unit checks fully prove it.

## Hard Rules

- Start from acceptance criteria or changed behavior, not from available tooling.
- Each proof target must have an action path, an assertion, and evidence when the result is reviewer-visible.
- Production recipes must declare a setup/start-state contract. Prefer idempotent `ensure_*` flows instead of repeated inline setup.
- User-visible UI claims need visual evidence. A recipe that only asserts state
  or passes unit tests is incomplete for a visible banner, modal, button, route,
  balance, form, or error-message claim unless the visual gap is explicitly
  marked blocked.
- Runtime proof is not complete until the run emits `summary.json`,
  `trace.json`, and an `artifact-manifest.json`/evidence manifest that indexes
  the screenshots, videos, logs, or state files used as proof.
- Prefer manifest-declared runner actions, existing repo fixtures, page objects, selectors, and test helpers.
- Recipes may use `/recipe-wallet-control` where installed, but must remain understandable without that skill.
- Do not include SRPs, private keys, bearer tokens, production account dumps, or private user data.
- Do not mark a recipe proven unless it was run or the unrun gap is explicit.

## Workflow

1. **Extract proof targets**
   - Read the PR/task, changed files, issue, and acceptance criteria.
   - Write 1-5 concrete proof targets: each should be observable, executable, and small enough to fail clearly.
   - Mark any manual or environment-only target explicitly; do not hide untestable claims.

2. **Choose the execution surface**
   - Prefer the MetaMask v1 runner manifest installed by `/recipe-harness`.
   - Use the installed repo overlay before inventing actions; recipe graph execution should go through the v1 runner.
   - Use UI/mobile/browser actions only for user-facing behavior.
   - Use command and JSON assertions for backend, static, or artifact-only behavior.

3. **Author the recipe graph**
   - Use the v1 envelope in `references/recipe-v1.md`.
   - Start with reusable `ensure_*` flows for setup/start-state when the runner publishes them.
   - Keep setup/start-state/proof/assert/teardown boundaries explicit.
   - Give every node a stable `id`, an `action`, and a human-readable `description`.
   - Every non-terminal node must transition with `next`, `cases`, or `default`.
   - Every assertion should point back to a proof target.
   - Put proof recording/screenshots around the AC interaction, not around generic setup unless setup is the claim.
   - For `assert_exit_code`, use `"expected": 0` or another numeric expected code. Do not use `"code"`.
   - Add `timeout_ms` to commands that can hang, such as focused Jest, build, simulator, or browser checks.

4. **Run or dry-run what you can**
   - Execute non-destructive commands on the target device/session when available.
   - For historical commits or fresh checkouts, run `/recipe-harness install` and `/recipe-harness verify` before judging runner support.
   - Treat dry-run as schema validation only; a recipe is not proven until the run emits `summary.json`, `trace.json`, and the named artifacts.
   - Runtime proof must record the harness adapter, source/version, verification status, and artifact paths.
   - Save artifacts under `/tmp` or a repo-ignored evidence directory unless the user asks to commit them.
   - If a runner is missing, still produce the recipe plus the exact command or adapter work needed to run it.

5. **Package evidence**
   - Follow `references/evidence-package.md`.
   - Include screenshots/videos/logs/reports only when they prove a named target.

6. **Quality loop**
   - Use `/recipe-quality` before calling the recipe done.
   - Fix must-fix critique items, rerun if possible, then summarize remaining gaps honestly.
   - If the critique says visual evidence is missing for a visible UI claim,
     improve the recipe/evidence package or mark the proof target as blocked;
     do not downgrade the claim to unit-test-only proof.

## Output Format

When cooking, return:

1. `Proof Targets` — numbered claims and how each is proven.
2. `Recipe` — path plus important graph nodes, or the full JSON if short.
3. `Run Command` — exact command(s) used or needed.
4. `Artifacts` — paths and what each proves.
5. `Quality Loop` — critique verdict, improvement made, and rerun status.
6. `Gaps / Follow-ups` — only if something remains unrun, manual, flaky, or blocked.
