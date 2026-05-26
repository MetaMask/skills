# Recipe v1

Use this shape unless the target repo already publishes a stricter schema.

```json
{
  "schema_version": 1,
  "title": "Human-readable validation title",
  "description": "What this recipe proves",
  "inputs": {},
  "validate": {
    "workflow": {
      "pre_conditions": [],
      "setup": [],
      "entry": "start",
      "nodes": {
        "start": {
          "action": "command",
          "description": "Run a project-native check",
          "cmd": "yarn test --runInBand path/to/test",
          "stdout": "logs/test.log",
          "timeout_ms": 120000,
          "next": "assert-result"
        },
        "assert-result": {
          "action": "assert_exit_code",
          "description": "Check the project-native check passed",
          "expected": 0,
          "log_must_contain": ["PASS"],
          "next": "index-artifacts"
        },
        "index-artifacts": {
          "action": "artifact_index",
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
- Assertions name the proof target they validate, either in `description` or a `proof_target` field.

Action classes:

- Portable: `command`, `wait`, `assert_json`, `assert_file`, `assert_exit_code`, `artifact_index`, `log`, `end`.
- UI/browser/mobile: `navigate`, `press`, `set_input`, `scroll`, `wait_for`, `screenshot`, `playwright`, `maestro`, `detox`, `xcode_test`, `adb_shell`.
- Project-owned: `eval_ref`, `eval_sync`, `eval_async`, `service_worker`, or documented repo actions.

Prefer named project actions over raw eval. If raw eval is unavoidable, keep it to inspection/setup and explain why the user-facing claim is still proven.

Runner expectations:

- `command` runs from the target repo root and may capture `stdout`/`stderr` files under the artifact directory. If only `stdout` is declared, runners should capture combined stdout+stderr because many test runners print results to stderr. Use `timeout_ms` for commands that can hang or take unbounded time.
- `assert_exit_code` checks the previous command with `expected` as a number, for example `"expected": 0`. Do not use legacy fields such as `code`.
- `assert_json` reads an artifact JSON file and compares fields from `equals`.
- `assert_file` checks that an expected artifact exists.
- `artifact_index` writes or updates `artifact-manifest.json`. For the portable overlay, list recipe-authored artifacts that already exist before the graph ends, such as logs, reports, screenshots, and runner metadata. Do not list runner-generated `summary.json` or `trace.json` in this node unless the target runner explicitly writes the manifest after those files exist.
- Recipes that assert an error is absent from logs should record a baseline before the user action, prove the watched stream advanced after the action, and write the searched strings plus baseline/end offsets into the evidence package.
- Every runner should emit `summary.json` and `trace.json` after the graph completes.
