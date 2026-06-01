# Examples

Use these as composition patterns. Keep the recipe small: proof targets first, then setup, action, assertion, evidence, teardown.

## Mobile Composition Pattern

For MetaMask Mobile PRs, compose existing flows instead of inventing raw evals:

1. **Preflight/status** — prove the intended simulator/device and debug app are reachable.
2. **Setup** — load or assert the wallet/network fixture needed by the claim.
3. **Navigate** — use a route or existing flow to reach the screen under test.
4. **Wait/assert** — wait on state or UI, not a fixed sleep.
5. **Capture** — screenshot/video/log only after the assertion proves the screen settled.
6. **Teardown** — reset wallet/app state when a run changes balances, permissions, txs, or network.

Good Mobile recipes compose the v1 manifest's semantic actions instead of shelling to scripts. Prefer, where the installed manifest advertises them:

- `metamask.wallet.setup`, `metamask.wallet.ensure_unlocked`, `metamask.wallet.select_account`, `metamask.wallet.read_state` for wallet setup/start-state.
- `metamask.perps.start_state`, `metamask.perps.ensure_positions`, `metamask.perps.ensure_orders`, `metamask.perps.place_order`, `metamask.perps.close_positions`, `metamask.perps.read_positions`, `metamask.perps.assert_positions` for Perps flows.
- `ui.navigate`, `ui.wait_for`, `ui.press`, `ui.set_input`, `ui.scroll`, `ui.screenshot`, `app.status`, `app.hud` for the user path and evidence.

`call`/flow-catalog composition is valid only when the installed runner manifest advertises a flow catalog; do not point at in-repo flow files (the legacy `scripts/perps/agentic/teams/perps/flows/*` recipes are not part of the v1 model). When reusing an action or flow, state which proof target it covers and add only the nodes needed for the PR-specific claim.

## Mobile Direct Smoke Recipe

Use this for live-device validation of the recipe plumbing itself. It intentionally avoids wallet-specific dependencies.

```json
{
  "schema_version": 1,
  "title": "Mobile direct smoke — reach a settled wallet screen",
  "description": "Proves the Mobile debug app is reachable and the v1 runner can drive the bridge to a settled wallet screen. Intentionally avoids wallet-specific assertions beyond reachability.",
  "validate": {
    "workflow": {
      "pre_conditions": ["Run from the metamask-mobile checkout", "Debug app is already running on the intended simulator"],
      "entry": "status",
      "nodes": {
        "status": {
          "action": "app.status",
          "description": "PT-1: read app route/device/platform through the v1 app.status action",
          "timeout_ms": 30000,
          "next": "ensure-unlocked"
        },
        "ensure-unlocked": {
          "action": "metamask.wallet.ensure_unlocked",
          "description": "PT-1: idempotently reach an unlocked wallet",
          "timeout_ms": 45000,
          "next": "navigate-wallet"
        },
        "navigate-wallet": {
          "action": "ui.navigate",
          "description": "PT-2: open the wallet view through the navigation layer",
          "route": "WalletView",
          "timeout_ms": 30000,
          "next": "wait-wallet"
        },
        "wait-wallet": {
          "action": "ui.wait_for",
          "description": "PT-2: the wallet screen is present after navigation settles",
          "test_id": "wallet-screen",
          "expected": "present",
          "timeout_ms": 30000,
          "next": "capture"
        },
        "capture": {
          "action": "ui.screenshot",
          "description": "PT-2: reviewer-visible settled wallet screen",
          "path": "screenshots/mobile-direct-smoke-wallet.png",
          "next": "index-artifacts"
        },
        "index-artifacts": {
          "action": "index_artifacts",
          "description": "Index the screenshot proof",
          "artifacts": ["screenshots/"],
          "next": "done"
        },
        "done": { "action": "end", "status": "pass" }
      },
      "teardown": []
    }
  }
}
```

## Mobile Flow-Based Recipe

This pattern composes a real Mobile flow and adds a PR-specific assertion. It is stronger than a direct smoke recipe because it proves the user path plus the state after the path settles.

```json
{
  "schema_version": 1,
  "title": "Perps market detail shows a loaded BTC price",
  "description": "Proves the market list can open BTC details and the price is loaded after navigation settles.",
  "inputs": {
    "symbol": {
      "type": "string",
      "default": "BTC",
      "description": "Perps market symbol to open and assert"
    }
  },
  "validate": {
    "workflow": {
      "pre_conditions": ["wallet.unlocked", "perps.feature_enabled"],
      "entry": "open-market",
      "nodes": {
        "open-market": {
          "action": "ui.navigate",
          "description": "PT-1: open the BTC market detail through the raw Perps market route",
          "route": "PerpsMarketDetails",
          "params": { "market": { "symbol": "{{symbol}}" } },
          "timeout_ms": 30000,
          "next": "wait-market"
        },
        "wait-market": {
          "action": "ui.wait_for",
          "description": "PT-2: after navigation settles, the BTC market detail content is present",
          "text": "{{symbol}}",
          "expected": "present",
          "timeout_ms": 30000,
          "next": "capture-detail"
        },
        "capture-detail": {
          "action": "ui.screenshot",
          "description": "PT-2: reviewer-visible settled market detail screen",
          "path": "screenshots/perps-btc-detail.png",
          "next": "index-artifacts"
        },
        "index-artifacts": {
          "action": "index_artifacts",
          "description": "Index state and screenshot evidence",
          "artifacts": ["screenshots/"],
          "next": "done"
        },
        "done": { "action": "end", "status": "pass" }
      },
      "teardown": []
    }
  }
}
```

## Backend or Non-UI Recipe

Use command assertions when the PR claim is not user-facing.

```json
{
  "schema_version": 1,
  "title": "Validate token metadata normalization",
  "description": "Proves the changed parser preserves symbol and decimals for malformed metadata responses.",
  "inputs": {},
  "validate": {
    "workflow": {
      "pre_conditions": ["PR branch is checked out"],
      "setup": [],
      "entry": "run-focused-test",
      "nodes": {
        "run-focused-test": {
          "action": "command",
          "description": "PT-1: focused unit test covers malformed metadata",
          "cmd": "mkdir -p reports && yarn test --runInBand app/core/token-service/metadata.test.ts --json --outputFile reports/jest-token-metadata.json",
          "timeout_ms": 120000,
          "next": "assert-pass"
        },
        "assert-pass": {
          "action": "assert_json",
          "description": "PT-1: Jest reports zero failed tests",
          "path": "reports/jest-token-metadata.json",
          "assert": { "path": "$.numFailedTests", "operator": "eq", "value": 0 },
          "next": "index-artifacts"
        },
        "index-artifacts": {
          "action": "index_artifacts",
          "description": "Index the test report",
          "artifacts": ["reports/jest-token-metadata.json"],
          "next": "done"
        },
        "done": { "action": "end", "status": "pass" }
      },
      "teardown": []
    }
  }
}
```

## Weak Recipe to Avoid

```json
{
  "schema_version": 1,
  "title": "Check send works",
  "validate": {
    "workflow": {
      "entry": "test",
      "nodes": {
        "test": { "action": "wait", "duration_ms": 10000, "next": "done" },
        "done": { "action": "end", "status": "pass" }
      }
    }
  }
}
```

Problems: no proof target, no user path, sleep instead of state wait, no assertion, no artifact, and success is unconditional.
