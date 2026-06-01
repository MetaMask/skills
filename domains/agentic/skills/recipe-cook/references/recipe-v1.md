# Recipe v1

Canonical source of truth: `$FARMSLOT_ROOT/docs/RECIPE-PROTOCOL-V1.md`. This file is a skill-local summary and must not redefine the protocol differently.

Use this shape unless the target repo already publishes a stricter schema.

```json
{
  "schema_version": 1,
  "title": "Human-readable validation title",
  "description": "What this recipe proves",
  "inputs": {},
  "proofTargets": [
    { "id": "PT-1", "claim": "The changed behavior is visible and settled." }
  ],
  "validate": {
    "workflow": {
      "pre_conditions": [],
      "setup": [],
      "entry": "start",
      "nodes": {
        "start": {
          "action": "command",
          "description": "Run a project-native check",
          "cmd": "mkdir -p logs && yarn test --runInBand path/to/test > logs/test.log 2>&1; status=$?; cat logs/test.log; exit $status",
          "timeout_ms": 120000,
          "next": "assert-result"
        },
        "assert-result": {
          "action": "assert_exit_code",
          "description": "Check the project-native check passed",
          "expected": 0,
          "next": "assert-output"
        },
        "assert-output": {
          "action": "assert_output",
          "description": "Check the project-native output looked successful",
          "source": "start",
          "stream": "stdout",
          "contains": "PASS",
          "next": "index-artifacts"
        },
        "index-artifacts": {
          "action": "index_artifacts",
          "description": "Write the artifact manifest",
          "artifacts": ["logs/test.log"],
          "next": "done"
        },
        "done": { "action": "end", "status": "pass" }
      },
      "teardown": []
    }
  }
}
```


## Composition and start-state fields

Recipe v1 authoring should support reusable flow composition. When the installed runner publishes flow catalogs, prefer `call` nodes over repeated raw setup.

Recommended metadata:

- `proofTargets`: small claims derived from ACs.
- `phase`: one of `setup`, `start_state`, `proof`, `assert`, or `teardown`.
- `proofTarget`: the AC/proof target a proof or assertion node validates.
- `record`: use `proof_window` for the smallest reviewer-visible interaction.

Recommended current MetaMask setup action shape:

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

An `ensure_*` or `start_state` action/flow is idempotent: it inspects the current app state, performs only required transitions, and fails unless its postcondition is proved. Use it for unlock, network/provider selection, navigation, fixtures, and domain-specific starting state. Use `call` only when the installed manifest explicitly advertises flow-catalog support.

Minimum required fields:

- `schema_version: 1`
- `title`
- `description`
- `validate.workflow.entry`
- non-empty `validate.workflow.nodes`

Node rules:

- Every node key is a stable id.
- Every node has `action` and `description`, except a minimal terminal `end` node.
- Every non-terminal node has `next`, `cases`, or `default`.
- Transition targets exist.
- At least one node reaches `action: "end"`.
- Assertions name the proof target they validate, either in `description` or a `proofTarget` field.
- Setup/start-state flows should be declared separately from proof nodes so evidence can focus on the AC interaction.

Action classes:

- Portable/base: `command`, `wait`, `assert_json`, `assert_file`, `assert_exit_code`, `assert_output`, `watch_logs`, `index_artifacts`, `end`.
- Manifest-declared UI/app/CDP: `ui.press`, `ui.set_input`, `ui.scroll`, `ui.wait_for`, `ui.screenshot`, `app.status`, `app.hud`, supported `ui.navigate`, supported `cdp.target`.
- Flow composition: manifest-declared `call` when the runner publishes reusable flow catalogs.
- MetaMask custom: manifest-declared `metamask.wallet.*` and `metamask.perps.*`; prefer `metamask.wallet.ensure_unlocked` and `metamask.perps.start_state` for setup when available. `metamask.debug.*` is reserved but should not be used unless the target manifest declares an E2E-validated debug action.

Prefer named project actions over raw eval. If raw eval is unavoidable, keep it to inspection/setup and explain why the user-facing claim is still proven.

Runner expectations:

- `command` runs from the target repo root and returns stdout/stderr/exitCode in node output. If a recipe needs a durable log artifact, redirect output explicitly in `cmd`, for example `> logs/test.log 2>&1`. Use `timeout_ms` for commands that can hang or take unbounded time.
- `assert_exit_code` checks the previous command with `expected` as a number, for example `"expected": 0`. Use `expected`; do not use ambiguous fields such as `code`.
- `assert_json` reads a JSON file and evaluates an `assert` object, for example `{ "path": "$.status", "operator": "eq", "value": "pass" }`.
- `assert_file` checks that an expected artifact exists.
- `index_artifacts` writes or updates `artifact-manifest.json`. For the portable overlay, list recipe-authored artifacts that already exist before the graph ends, such as logs, reports, screenshots, and runner metadata. Do not list runner-generated `summary.json` or `trace.json` in this node unless the target runner explicitly writes the manifest after those files exist.
- Recipes that assert an error is absent from logs should record a baseline before the user action, prove the watched stream advanced after the action, and write the searched strings plus baseline/end offsets into the evidence package.
- Every runner should emit `summary.json` and `trace.json` after the graph completes.
