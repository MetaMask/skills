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
          "next": "assert-result"
        },
        "assert-result": {
          "action": "assert_json",
          "description": "Check the command produced the expected result",
          "path": "reports/result.json",
          "equals": { "status": "pass" },
          "next": "index-artifacts"
        },
        "index-artifacts": {
          "action": "artifact_index",
          "description": "Write the artifact manifest",
          "artifacts": ["reports/result.json"],
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
