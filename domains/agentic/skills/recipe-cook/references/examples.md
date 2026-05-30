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

Good Mobile recipes usually reference existing checked-in flows such as:

- `scripts/perps/agentic/teams/perps/flows/market-discovery.json`
- `scripts/perps/agentic/teams/perps/flows/trade-open-market.json`
- `scripts/perps/agentic/teams/perps/flows/trade-close-position.json`
- `scripts/perps/agentic/teams/perps/flows/tpsl-create.json`
- `scripts/perps/agentic/teams/perps/recipes/provider-smoke.json`
- `scripts/perps/agentic/teams/perps/recipes/app-lifecycle.json`

When reusing a flow, state which proof target it covers and add only the nodes needed for the PR-specific claim.

## Mobile Direct Smoke Recipe

Use this for live-device validation of the recipe plumbing itself. It intentionally avoids wallet-specific dependencies.

```json
{
  "schema_version": 1,
  "title": "Mobile direct smoke — status and harmless scroll",
  "description": "Proves the Mobile debug app is reachable and the UI adapter accepts a harmless scroll command.",
  "validate": {
    "workflow": {
      "pre_conditions": ["Run from the metamask-mobile checkout", "Debug app is already running on the intended simulator"],
      "entry": "status",
      "nodes": {
        "status": {
          "action": "command",
          "description": "PT-1: read app route/device/account status",
          "cmd": "bash scripts/perps/agentic/app-state.sh status",
          "timeout_ms": 30000,
          "stdout": "logs/status.json",
          "next": "assert-status"
        },
        "assert-status": {
          "action": "assert_json",
          "description": "PT-1: status includes platform and route",
          "path": "logs/status.json",
          "equals": { "platform": "ios" },
          "next": "scroll"
        },
        "scroll": {
          "action": "command",
          "description": "PT-2: perform a harmless scroll through the UI adapter",
          "cmd": "bash scripts/perps/agentic/app-state.sh scroll --offset 40",
          "timeout_ms": 30000,
          "stdout": "logs/scroll.json",
          "next": "assert-scroll"
        },
        "assert-scroll": {
          "action": "assert_json",
          "description": "PT-2: scroll reports ok=true",
          "path": "logs/scroll.json",
          "equals": { "ok": true },
          "next": "index-artifacts"
        },
        "index-artifacts": {
          "action": "index_artifacts",
          "description": "Index command outputs used as proof",
          "artifacts": ["logs/status.json", "logs/scroll.json"],
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
          "action": "metamask.perps.navigate",
          "description": "PT-1: open the BTC market detail through the manifest-declared Perps navigation action",
          "target": "market",
          "market": "{{symbol}}",
          "timeout_ms": 30000,
          "next": "wait-market"
        },
        "wait-market": {
          "action": "ui.wait_for",
          "description": "PT-2: after navigation settles, the BTC market detail content is present",
          "text_contains": ["{{symbol}}"],
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
          "cmd": "mkdir -p \"$RECIPE_ARTIFACT_DIR/reports\" && yarn test --runInBand app/core/token-service/metadata.test.ts --json --outputFile \"$RECIPE_ARTIFACT_DIR/reports/jest-token-metadata.json\"",
          "timeout_ms": 120000,
          "next": "assert-pass"
        },
        "assert-pass": {
          "action": "assert_json",
          "description": "PT-1: Jest reports zero failed tests",
          "path": "reports/jest-token-metadata.json",
          "equals": { "numFailedTests": 0 },
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
        "test": { "action": "wait", "ms": 10000, "next": "done" },
        "done": { "action": "end", "status": "pass" }
      }
    }
  }
}
```

Problems: no proof target, no user path, sleep instead of state wait, no assertion, no artifact, and success is unconditional.
