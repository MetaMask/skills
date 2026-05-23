# Examples

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
          "cmd": "yarn test --runInBand app/core/token-service/metadata.test.ts",
          "outputs": { "json": "reports/jest-token-metadata.json" },
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
          "action": "artifact_index",
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

## Mobile UI Recipe

Use project actions for wallet state and UI. `/recipe-wallet-control` may supply these primitives, but the recipe still states the action intent.

```json
{
  "schema_version": 1,
  "title": "Confirm send amount error clears after editing",
  "description": "Proves the Send flow clears an invalid amount error when the user enters a valid amount.",
  "validate": {
    "workflow": {
      "pre_conditions": ["Simulator is booted", "Test wallet is unlocked"],
      "setup": [
        { "action": "fixture", "description": "Load a wallet with ETH on the target test network", "fixture": "send-eth-basic" }
      ],
      "entry": "open-send",
      "nodes": {
        "open-send": {
          "action": "navigate",
          "description": "PT-1: open the Send amount screen through the wallet UI",
          "route": "send.amount",
          "next": "enter-invalid"
        },
        "enter-invalid": {
          "action": "set_input",
          "description": "PT-1: enter an amount larger than balance",
          "target": "send.amount.input",
          "value": "999999",
          "next": "wait-error"
        },
        "wait-error": {
          "action": "wait_for",
          "description": "PT-1: wait for insufficient funds error",
          "target": "send.amount.error.insufficientFunds",
          "next": "enter-valid"
        },
        "enter-valid": {
          "action": "set_input",
          "description": "PT-2: replace invalid amount with a valid value",
          "target": "send.amount.input",
          "value": "0.001",
          "next": "assert-error-cleared"
        },
        "assert-error-cleared": {
          "action": "eval_ref",
          "description": "PT-2: error is absent and Continue is enabled",
          "ref": "send.amount.validState",
          "expect": { "errorVisible": false, "continueEnabled": true },
          "next": "capture"
        },
        "capture": {
          "action": "screenshot",
          "description": "PT-2: settled valid amount screen",
          "path": "screenshots/send-valid-amount.png",
          "next": "done"
        },
        "done": { "action": "end", "status": "pass" }
      },
      "teardown": [
        { "action": "reset_fixture", "description": "Return simulator to clean wallet state" }
      ]
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
